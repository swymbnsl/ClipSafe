// DOM Elements
const tabButtons = document.querySelectorAll(".tab-btn")
const tabPanes = document.querySelectorAll(".tab-pane")
const activityList = document.getElementById("activity-list")
const logsContainer = document.getElementById("logs-container")
const clearLogsBtn = document.getElementById("clear-logs")
const startMinimizedCheckbox = document.getElementById("start-minimized")
const startMonitoringCheckbox = document.getElementById("start-monitoring")
const showNotificationsCheckbox = document.getElementById("show-notifications")
const saveSettingsBtn = document.getElementById("save-settings")

// Stats
let stats = {
  safe: 0,
  warning: 0,
  blocked: 0,
}

// Create toast container
const toastContainer = document.createElement("div")
toastContainer.className = "toast-container"
document.body.appendChild(toastContainer)

// Tab Switching
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((btn) => btn.classList.remove("active"))
    tabPanes.forEach((pane) => pane.classList.remove("active"))
    button.classList.add("active")
    const tabId = button.getAttribute("data-tab")
    document.getElementById(tabId).classList.add("active")
  })
})

// Save Settings
saveSettingsBtn.addEventListener("click", async () => {
  const settings = {
    start_minimized: startMinimizedCheckbox.checked,
    start_monitoring: startMonitoringCheckbox.checked,
    show_notifications: showNotificationsCheckbox.checked,
  }

  try {
    await window.api.saveSettings(settings)
    showToast(
      "Settings Saved",
      "Your preferences have been updated successfully",
      "success"
    )
  } catch (error) {
    showToast(
      "Settings Error",
      "Failed to save settings. Please try again.",
      "danger"
    )
  }
})

// Clear Logs
clearLogsBtn.addEventListener("click", () => {
  activityList.innerHTML = ""
  showToast("Logs Cleared", "Activity logs have been cleared", "success")
})

// Show Toast Notification
function showToast(title, message, type = "info", actions = null) {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`

  let iconClass
  switch (type) {
    case "success":
      iconClass = "fa-check-circle"
      break
    case "warning":
      iconClass = "fa-exclamation-triangle"
      break
    case "danger":
      iconClass = "fa-ban"
      break
    default:
      iconClass = "fa-info-circle"
  }

  let actionsHtml = ""
  if (actions) {
    actionsHtml = `
      <div class="toast-actions">
        ${actions
          .map(
            (action) => `
          <button class="toast-button ${
            action.primary ? "primary" : "secondary"
          }">${action.text}</button>
        `
          )
          .join("")}
      </div>
    `
  }

  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas ${iconClass} toast-icon"></i>
      <h3 class="toast-title">${title}</h3>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    </div>
    <p class="toast-message">${message}</p>
    ${actionsHtml}
  `

  toastContainer.appendChild(toast)

  // Handle close button
  const closeBtn = toast.querySelector(".toast-close")
  closeBtn.addEventListener("click", () => {
    toast.style.animation = "slideOut 0.3s ease-out forwards"
    setTimeout(() => toast.remove(), 300)
  })

  // Handle action buttons if present
  if (actions) {
    const actionButtons = toast.querySelectorAll(".toast-button")
    actionButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        if (actions[index].onClick) {
          actions[index].onClick()
        }
        toast.style.animation = "slideOut 0.3s ease-out forwards"
        setTimeout(() => toast.remove(), 300)
      })
    })
  }

  // Auto dismiss after 5 seconds for success messages
  if (type === "success") {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = "slideOut 0.3s ease-out forwards"
        setTimeout(() => toast.remove(), 300)
      }
    }, 5000)
  }
}

// Add Activity Item
function addActivityItem(data) {
  const activityItem = document.createElement("div")
  activityItem.className = "activity-item"

  try {
    const msgData = typeof data.message === 'string' ? JSON.parse(data.message) : data.message
    const type = msgData.local_check?.is_safe === false || msgData.groq_analysis?.is_safe === false ? 'warning' : 'success'
    const iconClass = type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle'
    
    let content = `<div class="log-section content-preview">
      <strong>Copied Content:</strong><br>
      <pre>${msgData.details?.content_preview || 'N/A'}</pre>
    </div>`

    if (msgData.local_check) {
      content += `<div class="log-section">
        <strong>Local Check:</strong> ${msgData.local_check.message}
      </div>`
    }

    if (msgData.groq_analysis) {
      const groq = msgData.groq_analysis
      content += `<div class="log-section">
        <strong>AI Analysis:</strong><br>
        • Category: ${groq.category}<br>
        • Confidence: ${(groq.confidence * 100).toFixed(1)}%<br>
        • Assessment: ${groq.explanation}<br>
        ${groq.potential_threat !== 'None identified' ? `• <span class="threat">Threat: ${groq.potential_threat}</span>` : ''}
      </div>`
    }

    activityItem.innerHTML = `
      <div class="activity-icon ${type}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-title">${data.title}</div>
        <div class="activity-message">${content}</div>
        <div class="activity-time">${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
      </div>`
  } catch (e) {
    // Fallback for unparseable messages
    activityItem.innerHTML = `
      <div class="activity-icon ${data.type || 'info'}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-title">${data.title || 'Log Entry'}</div>
        <div class="activity-message">${data.message}</div>
        <div class="activity-time">${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
      </div>`
  }

  activityList.insertBefore(activityItem, activityList.firstChild)

  // Keep only last 50 items for performance
  if (activityList.children.length > 50) {
    activityList.removeChild(activityList.lastChild)
  }

  // Update stats
  updateStats(type)
}

// Update Stats
function updateStats(type) {
  switch (type) {
    case "success":
      stats.safe++
      break
    case "warning":
      stats.warning++
      break
    case "danger":
      stats.blocked++
      break
  }
}

// Listen for notifications from main process
window.api.onNotification((data) => {
  // Only add to activity list, skip toast notifications
  addActivityItem({
    type: data.type,
    title: data.title,
    message: data.message,
  })
})

// Handle custom notifications
window.api.onNotification((data) => {
  if (showNotificationsCheckbox.checked) {
    const notification = document.createElement('div')
    notification.className = `custom-notification ${data.type}`
    
    const iconClass = data.type === 'success' ? 'fa-check-circle' :
                      data.type === 'warning' ? 'fa-exclamation-triangle' :
                      data.type === 'danger' ? 'fa-ban' : 'fa-info-circle'
    
    notification.innerHTML = `
      <div class="custom-notification-header">
        <i class="fas ${iconClass} custom-notification-icon"></i>
        <h3 class="custom-notification-title">${data.title}</h3>
        <button class="custom-notification-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <p class="custom-notification-message">${data.message}</p>
    `

    document.body.appendChild(notification)

    // Add click handler for close button
    const closeBtn = notification.querySelector('.custom-notification-close')
    closeBtn.addEventListener('click', () => {
      notification.style.animation = 'slideOut 0.3s ease-out forwards'
      setTimeout(() => notification.remove(), 300)
    })

    // Auto remove after 5 seconds for success messages
    if (data.type === 'success') {
      setTimeout(() => {
        if (notification.parentElement) {
          notification.style.animation = 'slideOut 0.3s ease-out forwards'
          setTimeout(() => notification.remove(), 300)
        }
      }, 5000)
    }
  }

  // Always add to activity list
  addActivityItem({
    type: data.type,
    title: data.title,
    message: data.message,
  })
})

// Listen for logs from main process
window.api.onLog((data) => {
  addLogEntry({
    time: new Date().toLocaleTimeString(),
    message: data.message,
  })
})

// Listen for show logs request
window.api.onShowLogs(() => {
  // Switch to logs tab
  tabButtons.forEach((btn) => {
    if (btn.getAttribute("data-tab") === "logs") {
      btn.click()
    }
  })
})

// Add handler for showing log details
window.api.onLogDetails((details) => {
  // Switch to activity tab
  tabButtons.forEach((btn) => {
    if (btn.getAttribute("data-tab") === "activity") {
      btn.click();
    }
  });
  
  // Highlight the relevant log entry
  const logEntries = activityList.querySelectorAll('.activity-item');
  logEntries.forEach(entry => {
    if (entry.querySelector('.activity-time').textContent === details.timestamp) {
      entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      entry.classList.add('highlight');
      setTimeout(() => entry.classList.remove('highlight'), 2000);
    }
  });
})

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const savedSettings = await window.api.getSettings()
    if (savedSettings) {
      startMinimizedCheckbox.checked = savedSettings.start_minimized || false
      startMonitoringCheckbox.checked = savedSettings.start_monitoring || false
      showNotificationsCheckbox.checked =
        savedSettings.show_notifications !== false // Default to true
    }

    showToast(
      "Welcome to ClipSafe",
      "Your clipboard is now protected. We'll notify you of any potential risks.",
      "success"
    )
  } catch (error) {
    showToast(
      "Settings Error",
      "Failed to load saved settings. Please check your configuration.",
      "warning"
    )
  }
})
