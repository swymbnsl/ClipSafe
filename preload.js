const { ipcRenderer } = require("electron")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
window.api = {
  // Send settings to main process
  saveSettings: (settings) => {
    ipcRenderer.send("save-settings", settings)
  },

  // Request to view logs
  viewLogs: () => {
    ipcRenderer.send("view-logs")
  },

  // Listen for notifications from main process
  onNotification: (callback) => {
    ipcRenderer.on("notification", (event, data) => callback(data))
  },

  // Listen for logs from main process
  onLog: (callback) => {
    ipcRenderer.on("log", (event, data) => callback(data))
  },

  // Listen for show logs request from main process
  onShowLogs: (callback) => {
    ipcRenderer.on("show-logs", () => callback())
  },
}
