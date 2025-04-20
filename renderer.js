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
  total: 0,
  safe: 0,
  warning: 0,
  blocked: 0,
}
let monitorStart = Date.now()

function updateStats(type, msgData) {
  // Update total checks if available
  if (msgData?.stats?.total_checks) {
    stats.total = msgData.stats.total_checks;
  }

  // Update individual counters based on severity
  switch (type) {
    case "info":
      stats.safe++;
      break;
    case "warning":
      stats.warning++;
      break;
    case "danger":
      stats.blocked++;
      break;
  }

  // Update UI
  document.getElementById('total-checks').textContent = stats.total;
  document.getElementById('safe-count').textContent = stats.safe;
  document.getElementById('warning-count').textContent = stats.warning;
  document.getElementById('blocked-count').textContent = stats.blocked;
}

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

// Add after other constants
let threatChart;
const chartColors = {
  code: '#FF6384',
  command: '#36A2EB',
  url: '#FFCE56',
  other: '#4BC0C0'
};

// Initialize threat data
let threatData = {
  code: 0,
  command: 0,
  url: 0,
  other: 0
};

function updateLegendCounts() {
  document.querySelectorAll('.legend-item').forEach(item => {
    const category = item.getAttribute('data-category');
    const countSpan = item.querySelector('.threat-count');
    if (countSpan && category) {
      countSpan.textContent = `(${threatData[category]})`;
    }
  });
}

function initThreatChart() {
  const ctx = document.getElementById('threatChart').getContext('2d');
  threatChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Code', 'Command', 'URL', 'Other'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: Object.values(chartColors),
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          }
        }
      },
      cutout: '60%'
    }
  });
}

async function updateThreatChart(category) {
  if (category && threatData.hasOwnProperty(category)) {
    threatData[category]++;
    threatChart.data.datasets[0].data = Object.values(threatData);
    threatChart.update();
    updateLegendCounts();
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

    // Update stats with the new data
    updateStats(type, msgData);
    
    // Update threat chart if message contains groq analysis and is unsafe
    if (msgData.groq_analysis && !msgData.groq_analysis.is_safe) {
      const category = msgData.groq_analysis.category || 'other';
      updateThreatChart(category.toLowerCase());
    }

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

// Add log parser function
async function parseLogFile() {
  try {
    const response = await fetch('safety_scanner.log');
    const logText = await response.text();
    const logLines = logText.split('\n');
    
    for (const line of logLines) {
      if (line.includes('"type": "log"')) {
        try {
          const jsonStart = line.indexOf('{"type"');
          const jsonStr = line.substring(jsonStart);
          const logData = JSON.parse(jsonStr);
          
          if (logData.message.groq_analysis && !logData.message.groq_analysis.is_safe) {
            const category = logData.message.groq_analysis.category || 'other';
            await updateThreatChart(category.toLowerCase());
          }
        } catch (e) {
          console.error('Error parsing log line:', e);
        }
      }
    }
  } catch (e) {
    console.error('Error reading log file:', e);
  }
}

// Listen for notifications from main process
window.api.onNotification((data) => {
  // Only add to activity list, skip notifications
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
  // Reset stats on load
  stats = {
    total: 0,
    safe: 0,
    warning: 0,
    blocked: 0
  };
  
  // Update stats display
  updateStatsUI();
  
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

  // Initialize threat chart and parse logs
  initThreatChart();
  await parseLogFile();
})