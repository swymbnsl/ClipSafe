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

  // Toggle monitoring state
  toggleMonitoring: () => {
    ipcRenderer.send("toggle-monitoring")
  },

  // Listen for monitoring state changes
  onMonitoringStateChange: (callback) => {
    ipcRenderer.on("monitoring-state-changed", (event, isActive) => callback(isActive))
  },

  // Analyze domain
  analyzeDomain: (url) => {
    ipcRenderer.send("analyze-domain", url)
  },

  // Listen for domain analysis results
  onDomainAnalysis: (callback) => {
    ipcRenderer.on("domain-analysis-result", (event, result) => callback(result))
  }
}
