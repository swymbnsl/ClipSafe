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
    icon: path.join(__dirname, "assets/icon.png"),
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

  // Handle window close
  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, "assets/icon.png")
  const trayIcon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip("ClipSafe")

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
      label: "Start Monitoring",
      click: () => {
        startPythonProcess()
      },
    },
    {
      label: "Stop Monitoring",
      click: () => {
        stopPythonProcess()
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Show window on tray icon click
  tray.on("click", () => {
    if (mainWindow === null) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
}

// Start Python process
function startPythonProcess() {
  if (pythonProcess) {
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

      if (data.type === "notification") {
        // Show notification
        notifier.notify({
          title: data.title,
          message: data.message,
          icon: path.join(__dirname, "assets/icon.png"),
          sound: true,
        })

        // Send to renderer process
        if (mainWindow) {
          mainWindow.webContents.send("notification", data)
        }
      } else if (data.type === "log") {
        // Send log to renderer process
        if (mainWindow) {
          mainWindow.webContents.send("log", data)
        }
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
    callback();
    return;
  }

  notificationWindow = new BrowserWindow({
    width: 380, // Increased from 380
    height: 100,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    focusable: false,
    show: false, // Start hidden
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
      width: 500, // Increased from 380
      height: 200, // Increased from 100
      x: width - 520, // Adjusted for new width
      y: height - 220 // Adjusted for new height
    });
    
    notificationWindow.show();
    callback();
  });
}

// Handle notification window cleanup
ipcMain.on('notification-closed', () => {
  if (notificationWindow) {
    notificationWindow.close();
    notificationWindow = null;
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

// Clean up on exit
app.on("before-quit", () => {
  stopPythonProcess()
})
