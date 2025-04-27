const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron")
const path = require("path")
const { PythonShell } = require("python-shell")
const Store = require("electron-store")
const notifier = require("node-notifier")
const fs = require("fs")
const dotenv = require("dotenv")
dotenv.config()

// Initialize store for settings
const store = new Store()

// Global variables
let mainWindow
let tray = null
let pythonProcess = null
let notificationWindow = null;
let isMonitoring = true;
let minimizeToTray = true; // default

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets/clipsafe_logo_white.png"),
    title: "ClipSafe",
    frame: true,
    show: false,
    backgroundColor: "#ffffff",
  })

  // Load the index.html file
  mainWindow.loadFile("index.html")

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  // Handle window close (minimize to tray logic)
  mainWindow.on("close", (e) => {
    if (minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      mainWindow = null;
      app.quit();
    }
  })
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, "assets/clipsafe_logo_white.png")
  const trayIcon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 32, height: 32 })

  tray = new Tray(trayIcon)
  tray.setToolTip("ClipSafe")

  function updateTrayMenu() {
    const monitoringLabel = isMonitoring ? "Stop Monitoring" : "Start Monitoring";
    const monitoringIcon = isMonitoring ? "🔴" : "🟢";
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open ClipSafe",
        click: () => {
          if (mainWindow === null) {
            createWindow()
          } else {
            mainWindow.show()
          }
        },
      },
      { type: "separator" },
      {
        label: `${monitoringIcon} ${monitoringLabel}`,
        click: () => {
          isMonitoring = !isMonitoring;
          if (!isMonitoring) {
            stopPythonProcess();
          } else {
            startPythonProcess();
          }
          updateTrayMenu();
          if (mainWindow) {
            mainWindow.webContents.send("monitoring-state-changed", isMonitoring);
          }
          if (notificationWindow) {
            notificationWindow.webContents.send("monitoring-state-changed", isMonitoring);
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          minimizeToTray = false;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
  }

  updateTrayMenu();

  // Show window on tray icon click
  tray.on("click", () => {
    if (mainWindow === null) {
      createWindow()
    } else {
      mainWindow.show()
    }
  });

  // Expose for monitoring toggle
  tray.updateTrayMenu = updateTrayMenu;
}

// Start Python process
function startPythonProcess() {
  if (pythonProcess || !isMonitoring) {
    return
  }

  const pythonPath = app.isPackaged
    ? path.join(process.resourcesPath, "python", "safety_scanner.py")
    : path.join(__dirname, "python", "safety_scanner.py")

  // Ensure the Python script exists
  if (!fs.existsSync(pythonPath)) {
    console.error("Python script not found at:", pythonPath)
    return
  }

  const options = {
    mode: "text",
    pythonPath: "python",
    pythonOptions: ["-u"],
    scriptPath: path.dirname(pythonPath),
    args: [process.env.GROQ_API_KEY],
  }

  pythonProcess = new PythonShell(path.basename(pythonPath), options)

  pythonProcess.on("message", (message) => {
    try {
      const data = JSON.parse(message)

      // Always send to main window for activity logs
      if (mainWindow) {
        if (data.type === "notification") {
          mainWindow.webContents.send("notification", data);
        } else if (data.type === "log") {
          mainWindow.webContents.send("log", data);
        }
      }

      // Only create notification window for harmful content
      if (data.type === "notification" && 
         (data.notification_type === 'warning' || data.notification_type === 'danger')) {
        console.log("Creating notification window for:", data.title);
        createNotificationWindow(() => {
          if (notificationWindow) {
            notificationWindow.webContents.send('show-notification', {
              title: data.title,
              message: data.message,
              type: data.notification_type,
              details: data.details || null // Ensure details are passed for click
            });
          }
        });
      }
    } catch (error) {
      console.error("Error parsing Python message:", error)
    }
  })

  pythonProcess.on("error", (error) => {
    console.error("Python process error:", error)
  })

  pythonProcess.on("close", () => {
    pythonProcess = null
  })
}

// Stop Python process
function stopPythonProcess() {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

// Create notification window
function createNotificationWindow(callback) {
  // If window already exists, just show notification
  if (notificationWindow) {
    console.log("Notification window already exists, reusing.");
    notificationWindow.show();
    callback();
    return;
  }

  notificationWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  notificationWindow.loadFile('notification.html');

  notificationWindow.webContents.once('did-finish-load', () => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    notificationWindow.setBounds({
      width: 400,
      height: 300,
      x: width - 400,
      y: height - 300
    });

    notificationWindow.setContentBounds({
      width: 400,
      height: 300,
      x: width - 400,
      y: height - 300
    });

    
    notificationWindow.showInactive(); // Use showInactive to avoid stealing focus
    notificationWindow.setAlwaysOnTop(true, "screen-saver");
    notificationWindow.setVisibleOnAllWorkspaces(true);

    console.log("Notification window shown.");
    callback();
  });

  notificationWindow.on('closed', () => {
    notificationWindow = null;
  });

  notificationWindow.on('ready-to-show', () => {
    notificationWindow.showInactive();
  });
}

// Handle monitoring toggle
ipcMain.on("toggle-monitoring", () => {
  isMonitoring = !isMonitoring;
  
  // Stop/start Python process based on monitoring state
  if (!isMonitoring) {
    stopPythonProcess();
  } else {
    startPythonProcess();
  }
  
  // Notify renderer about state change
  if (mainWindow) {
    mainWindow.webContents.send("monitoring-state-changed", isMonitoring);
  }
  if (notificationWindow) {
    notificationWindow.webContents.send("monitoring-state-changed", isMonitoring);
  }
  if (tray && tray.updateTrayMenu) {
    tray.updateTrayMenu();
  }
});

// Add domain analysis handler
ipcMain.on("analyze-domain", async (event, url) => {
  try {
    const response = await fetch("https://api.groq.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "compound-mini-beta",
        messages: [
          {
            role: "system",
            content: "You are a security analyst. Analyze the given URL for potential threats."
          },
          {
            role: "user",
            content: `Analyze this URL for safety: ${url}`
          }
        ],
        temperature: 0.1
      })
    });
    
    const result = await response.json();
    const analysis = {
      is_safe: !result.choices[0].message.content.toLowerCase().includes("unsafe"),
      explanation: result.choices[0].message.content
    };
    
    mainWindow.webContents.send("domain-analysis-result", analysis);
  } catch (error) {
    console.error("Domain analysis error:", error);
  }
});

// App ready event
app.whenReady().then(() => {
  createWindow()
  createTray()

  // Start monitoring by default
  startPythonProcess()
})

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// On macOS, recreate window when dock icon is clicked
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Handle IPC messages from renderer
ipcMain.on("save-settings", (event, settings) => {
  minimizeToTray = !!settings.minimize_to_tray;
  // Since we're using environment variables for Groq API key, we don't need to save it here
  // Restart Python process with new settings
  stopPythonProcess()
  startPythonProcess()
})

ipcMain.on("view-logs", () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.webContents.send("show-logs")
  }
})

ipcMain.on('show-details', (event, details) => {
  if (mainWindow === null) {
    createWindow();
  }
  mainWindow.show();
  mainWindow.focus();
  // Switch to activity tab and scroll to relevant log
  mainWindow.webContents.send('show-log-details', details);
});

ipcMain.on('notification-closed', () => {
  if (notificationWindow) {
    notificationWindow.destroy(); // Use destroy() instead of close() for immediate effect
    notificationWindow = null;
  }
});

// Clean up on exit
app.on("before-quit", () => {
  stopPythonProcess()
})
