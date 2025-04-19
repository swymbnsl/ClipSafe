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
let monitorStart = Date.now()

function updateStatsUI() {
  document.getElementById('safe-count').textContent = stats.safe
  document.getElementById('warning-count').textContent = stats.warning
  document.getElementById('blocked-count').textContent = stats.blocked
}
function updateMonitorTime() {
  const ms = Date.now() - monitorStart
  const min = Math.floor(ms / 60000)
  const hr = Math.floor(min / 60)
  document.getElementById('monitor-time').textContent = hr > 0 ? `${hr}h ${min % 60}m` : `${min}m`
}
setInterval(updateMonitorTime, 10000)
updateMonitorTime()

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
    // Handle structured log messages
    const msgData = typeof data.message === 'string' ? JSON.parse(data.message) : data.message
    const type = data.type === 'log' ? (msgData.severity || 'info') : data.type
    const iconClass = type === 'warning' ? 'fa-exclamation-triangle' : 
                     type === 'danger' ? 'fa-ban' : 'fa-check-circle'
    
    let content = `<div class="log-section content-preview">
      <strong>Copied Content:</strong><br>
      <pre>${msgData.content || msgData.content_preview || 'N/A'}</pre>
    </div>`

    if (msgData.groq_analysis) {
      const groq = msgData.groq_analysis
      content += `<div class="log-section">
        <strong>AI Analysis:</strong><br>
        • Category: ${groq.category || 'N/A'}<br>
        • Confidence: ${groq.confidence ? (groq.confidence * 100).toFixed(1) + '%' : 'N/A'}<br>
        • Assessment: ${groq.explanation || 'N/A'}<br>
        ${groq.potential_threat && groq.potential_threat !== 'None identified' ? 
          `• <span class="threat">Threat: ${groq.potential_threat}</span>` : ''}
      </div>`
    }

    activityItem.innerHTML = `
      <div class="activity-icon ${type}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-title">${data.title || 'Activity Log'}</div>
        <div class="activity-message">${content}</div>
        <div class="activity-time">${msgData.timestamp || new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
      </div>`

    // Insert at the beginning of the list
    if (activityList.firstChild) {
      activityList.insertBefore(activityItem, activityList.firstChild)
    } else {
      activityList.appendChild(activityItem)
    }

    // Keep only last 50 items
    while (activityList.children.length > 50) {
      activityList.removeChild(activityList.lastChild)
    }

    // Update stats based on severity
    updateStats(type)
    
  } catch (e) {
    console.error('Error adding activity item:', e)
    // Fallback for unparseable messages
    activityItem.innerHTML = `
      <div class="activity-icon info">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="activity-content">
        <div class="activity-title">Log Entry</div>
        <div class="activity-message">${data.message || 'No message available'}</div>
        <div class="activity-time">${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
      </div>`
    activityList.insertBefore(activityItem, activityList.firstChild)
  }
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
  document.getElementById('safe-count').textContent = stats.safe
  document.getElementById('warning-count').textContent = stats.warning
  document.getElementById('blocked-count').textContent = stats.blocked
}

// Listen for notifications from main process
window.api.onNotification((data) => {
  if (showNotificationsCheckbox.checked) {
    // Get or create notification container
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'notification-container';
      document.body.appendChild(notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = `custom-notification ${data.type}`;
    
    const iconClass = data.type === 'success' ? 'fa-check-circle' :
                      data.type === 'warning' ? 'fa-exclamation-triangle' :
                      data.type === 'danger' ? 'fa-ban' : 'fa-info-circle';

    notification.innerHTML = `
      <div class="custom-notification-header">
        <i class="fas ${iconClass} custom-notification-icon"></i>
        <h3 class="custom-notification-title">${data.title}</h3>
        <button class="custom-notification-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="custom-notification-content">
        <p class="custom-notification-message">${data.message}</p>
      </div>
    `;

    notificationContainer.appendChild(notification);

    // Remove older notifications if more than 3
    const notifications = notificationContainer.querySelectorAll('.custom-notification');
    if (notifications.length > 3) {
      notifications[0].remove();
    }

    // Handle close button
    const closeBtn = notification.querySelector('.custom-notification-close');
    closeBtn.addEventListener('click', () => {
      notification.style.animation = 'slideOutNotification 0.3s ease-out forwards';
      setTimeout(() => notification.remove(), 300);
    });

    // Auto remove after 5 seconds for success messages
    if (data.type === 'success') {
      setTimeout(() => {
        if (notification.parentElement) {
          notification.style.animation = 'slideOutNotification 0.3s ease-out forwards';
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
    }
  }

  // Always add to activity list
  addActivityItem({
    type: data.type,
    title: data.title,
    message: data.message,
    severity: data.type === 'success' ? 'info' : data.type
  });
});

// Add domain analysis result handler
window.api.onDomainAnalysis((result) => {
  const notification = document.querySelector('.custom-notification');
  if (notification) {
    const messageEl = notification.querySelector('.custom-notification-message');
    const loadingEl = notification.querySelector('.loading-indicator');
    if (messageEl && loadingEl) {
      messageEl.textContent = result.explanation;
      loadingEl.remove();
      
      // Add safety indicator
      const safetyIndicator = document.createElement('div');
      safetyIndicator.className = `safety-indicator ${result.is_safe ? 'safe' : 'unsafe'}`;
      safetyIndicator.textContent = result.is_safe ? 'Safe' : 'Unsafe';
      notification.querySelector('.custom-notification-content').appendChild(safetyIndicator);
    }
  }
});

// Listen for logs from main process (fixed to use addActivityItem)
window.api.onLog((data) => {
  addActivityItem({
    type: 'info', // Default type for logs
    title: 'Log Entry',
    message: data.message,
    severity: 'info'
  })
})

// Listen for show logs request
window.api.onShowLogs(() => {
  // Switch to activity tab
  tabButtons.forEach((btn) => {
    if (btn.getAttribute("data-tab") === "activity") {
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

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle')
const themeIcon = themeToggle.querySelector('i')

// Detect initial theme (optional: can use system preference)
let isDarkTheme = !document.documentElement.classList.contains('light-theme')

themeToggle.addEventListener('click', () => {
  isDarkTheme = !isDarkTheme
  document.documentElement.classList.toggle('light-theme', !isDarkTheme)
  themeIcon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun'
})

// Update monitoring time
let startTime = Date.now()
setInterval(() => {
  const hours = Math.floor((Date.now() - startTime) / 3600000)
  document.getElementById('monitor-time').textContent = `${hours}h`
}, 60000)

// Monitor status indicator
const monitorStatus = document.getElementById('monitor-status');
let isMonitoring = true;

monitorStatus.addEventListener('click', () => {
  window.api.toggleMonitoring();
});

// Handle monitoring state changes
window.api.onMonitoringStateChange((isActive) => {
  isMonitoring = isActive;
  monitorStatus.classList.toggle('inactive', !isActive);
  monitorStatus.querySelector('span:last-child').textContent = 
    isActive ? 'Monitoring' : 'Not Monitoring';
});

window.api.onMonitoringStatus((isActive) => {
  monitorStatus.classList.toggle('inactive', !isActive)
  monitorStatus.querySelector('span:last-child').textContent = 
    isActive ? 'Monitoring' : 'Inactive'
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
  // On load, initialize stats UI
  updateStatsUI()
})