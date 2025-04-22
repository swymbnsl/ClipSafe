// DOM Elements
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");
const activityList = document.getElementById("activity-list");
const logsContainer = document.getElementById("logs-container");
const clearLogsBtn = document.getElementById("clear-logs");
const startMinimizedCheckbox = document.getElementById("start-minimized");
const startMonitoringCheckbox = document.getElementById("start-monitoring");
const showNotificationsCheckbox = document.getElementById("show-notifications");
const saveSettingsBtn = document.getElementById("save-settings");
const minimizeToTrayCheckbox = document.getElementById("minimize-to-tray");

let stats = {
  total: 0,
  safe: 0,
  warning: 0,
  blocked: 0,
};
let monitorStart = Date.now();

const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

let threatData = { 
  code: { count: 0, items: [] },
  command: { count: 0, items: [] },
  url: { count: 0, items: [] },
  other: { count: 0, items: [] }
};
let threatChart;
const chartColors = {
  code: "#FF6384",
  command: "#36A2EB",
  url: "#FFCE56",
  other: "#4BC0C0",
};

function updateStats(type, msgData) {
  if (msgData?.stats?.total_checks) {
    stats.total = msgData.stats.total_checks;
  }
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
  updateStatsUI();
}

function updateStatsUI() {
  document.getElementById("total-checks").textContent = stats.total;
  document.getElementById("safe-count").textContent = stats.safe;
  document.getElementById("warning-count").textContent = stats.warning;
  document.getElementById("blocked-count").textContent = stats.blocked;
}

function updateMonitorTime() {
  const ms = Date.now() - monitorStart;
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  document.getElementById("monitor-time").textContent =
    hr > 0 ? `${hr}h ${min % 60}m` : `${min}m`;
}
setInterval(updateMonitorTime, 10000);
updateMonitorTime();

// Tab Switching
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabPanes.forEach((pane) => pane.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.getAttribute("data-tab")).classList.add("active");
  });
});

// Save Settings
saveSettingsBtn.addEventListener("click", async () => {
  const settings = {
    start_minimized: startMinimizedCheckbox.checked,
    start_monitoring: startMonitoringCheckbox.checked,
    show_notifications: showNotificationsCheckbox.checked,
    minimize_to_tray: minimizeToTrayCheckbox ? minimizeToTrayCheckbox.checked : true,
  };

  // Show immediate feedback
  showToast("Saving...", "Please wait while settings are updated.", "info");

  try {
    await window.api.saveSettings(settings);
    showToast("Settings Saved", "Your preferences have been updated successfully.", "success");
  } catch (error) {
    showToast("Settings Error", "Failed to save settings. Please try again.", "danger");
  }
});

// Clear Logs
clearLogsBtn.addEventListener("click", () => {
  activityList.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-clipboard"></i>
      <h3>No Activity Yet</h3>
      <p>Clipboard events will appear here once detected</p>
    </div>`;
  showToast("Logs Cleared", "Activity logs cleared.", "success");
});

// Show Toast Notification
function showToast(title, message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const iconClass =
    type === "success" ? "fa-check-circle" :
    type === "warning" ? "fa-exclamation-triangle" :
    type === "danger" ? "fa-ban" : "fa-info-circle";

  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas ${iconClass} toast-icon"></i>
      <h3 class="toast-title">${title}</h3>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    </div>
    <p class="toast-message">${message}</p>
  `;
  toastContainer.appendChild(toast);

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    toast.style.animation = "slideOut 0.3s ease-out forwards";
    setTimeout(() => toast.remove(), 300);
  });

  if (type === "success") {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = "slideOut 0.3s ease-out forwards";
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }
}

// Initialize Threat Chart
function initThreatChart() {
  const ctx = document.getElementById("threatChart").getContext("2d");
  threatChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Code", "Command", "URL", "Other"],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: Object.values(chartColors),
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      cutout: "60%",
    },
  });
}

async function updateThreatChart(category, content, analysis) {
  if (category && threatData.hasOwnProperty(category)) {
    threatData[category].count++;
    // Store threat details for analysis
    threatData[category].items.push({
      content: content,
      timestamp: new Date().toLocaleString(),
      analysis: analysis
    });

    // Update chart
    threatChart.data.datasets[0].data = Object.values(threatData).map(d => d.count);
    threatChart.update();
    updateLegendCounts();
    updateThreatAnalysis(category);
  }
}

function updateLegendCounts() {
  document.querySelectorAll(".legend-item").forEach((item) => {
    const category = item.getAttribute("data-category");
    const countSpan = item.querySelector(".threat-count");
    if (countSpan && category) {
      countSpan.textContent = `(${threatData[category].count})`;
    }
  });
}

function updateThreatAnalysis(selectedCategory) {
  const analysisContent = document.getElementById("threatAnalysisContent");
  if (!analysisContent) return;

  const categoryData = threatData[selectedCategory];
  if (!categoryData || categoryData.items.length === 0) {
    analysisContent.innerHTML = `<div class="empty-state">
      <i class="fas fa-shield-alt"></i>
      <h3>No ${selectedCategory} threats detected</h3>
    </div>`;
    return;
  }

  let threatList = categoryData.items.map(item => `
    <div class="threat-item ${selectedCategory}">
      <div class="threat-header">
        <span class="threat-timestamp">${item.timestamp}</span>
        <span class="threat-category">${selectedCategory.toUpperCase()}</span>
      </div>
      <div class="threat-content">
        <div class="log-section">
          <strong>Content:</strong>
          <pre>${item.content}</pre>
        </div>
        ${item.analysis ? `
          <div class="log-section">
            <strong>Analysis:</strong>
            <p>${item.analysis.explanation || 'No explanation available'}</p>
            ${item.analysis.potential_threat ? 
              `<p class="threat">Potential Threat: ${item.analysis.potential_threat}</p>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  analysisContent.innerHTML = `
    <h3><i class="fas fa-chart-bar"></i> ${selectedCategory.toUpperCase()} Threat Analysis</h3>
    <div class="threat-list">${threatList}</div>
  `;
}

// Add Activity Item
function addActivityItem(data) {
  const emptyState = activityList.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const activityItem = document.createElement("li");
  activityItem.className = "activity-item";

  try {
    let msgData;

    // Try parsing incoming data
    if (typeof data.message === "string") {
      try {
        const jsonMatches = data.message.match(/\{[^]*\}/g);
        for (const match of jsonMatches || []) {
          try {
            msgData = JSON.parse(match);
            break;
          } catch {}
        }
        if (!msgData) msgData = { text: data.message };
      } catch {
        msgData = { text: data.message };
      }
    } else if (typeof data.message === "object" && data.message !== null) {
      msgData = data.message;
    } else {
      msgData = { text: String(data.message) };
    }

    // Extract relevant info
    const analysis = msgData.groq_analysis || {};
    const isSafe = analysis.is_safe;
    const explanation = analysis.explanation || "No explanation available.";
    const threat = analysis.potential_threat && analysis.potential_threat !== "None identified"
      ? analysis.potential_threat
      : null;

    // Get copied text (msgData.content or msgData.text)
    let copiedText = msgData.content || msgData.text || "[No content available]";
    if (typeof copiedText === "object") {
      copiedText = JSON.stringify(copiedText, null, 2);
    }

    const label = isSafe
      ? `<span class="label-safe"><i class="fas fa-check-circle"></i> Safe</span>`
      : `<span class="label-danger"><i class="fas fa-exclamation-triangle"></i> Threat Detected</span>`;

    // Final content layout
    let content = `
      <div class="log-section">
        <strong>Copied Text:</strong>
        <pre>${copiedText}</pre>
      </div>
      <div class="log-section">
        <strong>AI Assessment:</strong>
        <p>${explanation}</p>
      </div>
      ${threat ? `
        <div class="log-section">
          <strong class="threat">Potential Threat:</strong>
          <p>${threat}</p>
        </div>` : ""}
      <div class="log-section">
        ${label}
      </div>
    `;

    const iconClass = isSafe ? "fa-check-circle" : "fa-exclamation-triangle";
    const severityClass = isSafe ? "info" : "danger";

    activityItem.innerHTML = `
      <div class="activity-icon ${severityClass}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-message">${content}</div>
        <div class="activity-time">${
          msgData.timestamp || new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        }</div>
      </div>
    `;

  } catch (e) {
    console.error("Error processing activity item:", e);
    activityItem.innerHTML = `
      <div class="activity-icon info">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="activity-content">
        <div class="activity-message">
          <pre>${JSON.stringify(data.message, null, 2)}</pre>
        </div>
        <div class="activity-time">${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
      </div>`;
  }

  activityList.insertBefore(activityItem, activityList.firstChild);

  while (activityList.children.length > 50) {
    activityList.removeChild(activityList.lastChild);
  }
}

// Parse Log File
async function parseLogFile() {
  try {
    const response = await fetch("safety_scanner.log");
    const logText = await response.text();
    const logLines = logText.split("\n").filter(line => line.trim());

    for (const line of logLines) {
      try {
        // Try to find JSON content in the line
        const jsonMatch = line.match(/\{.*\}/);
        if (jsonMatch) {
          const logData = JSON.parse(jsonMatch[0]);
          addActivityItem({
            type: logData.type || "log",
            severity: logData.severity || logData.message?.severity || "info",
            message: logData.message
          });
        } else if (line.includes(" - INFO - ")) {
          // Handle standard log format
          const [timestamp, level, message] = line.split(" - ");
          addActivityItem({
            type: "log",
            severity: "info",
            message: {
              text: message,
              timestamp: new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            }
          });
        }
      } catch (e) {
        console.error("Error parsing log line:", e);
      }
    }
  } catch (e) {
    console.error("Error reading log file:", e);
    showToast("Log Error", "Failed to load log file", "warning");
  }
}

// Event Listeners for Main Process
window.api.onNotification((data) => {
  console.log("Renderer received notification event:", data);
  addActivityItem({
    type: data.type,
    severity: data.type === "success" ? "info" : data.type,
    message: data.message,
  });
});

window.api.onLog((data) => {
  addActivityItem({
    type: "log",
    severity: "info",
    message: data.message,
  });
});

window.api.onShowLogs(() => {
  tabButtons.forEach((btn) => {
    if (btn.getAttribute("data-tab") === "activity") btn.click();
  });
});

window.api.onLogDetails((details) => {
  tabButtons.forEach((btn) => {
    if (btn.getAttribute("data-tab") === "activity") btn.click();
  });
  const logEntries = activityList.querySelectorAll(".activity-item");
  logEntries.forEach((entry) => {
    if (entry.querySelector(".activity-time").textContent === details.timestamp) {
      entry.scrollIntoView({ behavior: "smooth", block: "center" });
      entry.classList.add("highlight");
      setTimeout(() => entry.classList.remove("highlight"), 2000);
    }
  });
});

// Theme Toggle
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = themeToggle.querySelector("i");
let isDarkTheme = !document.documentElement.classList.contains("light-theme");

themeToggle.addEventListener("click", () => {
  isDarkTheme = !isDarkTheme;
  document.documentElement.classList.toggle("light-theme", !isDarkTheme);
  themeIcon.className = isDarkTheme ? "fas fa-moon" : "fas fa-sun";
});

// Monitor Status
const monitorStatus = document.getElementById("monitor-status");
let isMonitoring = true;

function updateMonitorStatusUI() {
  monitorStatus.classList.toggle("inactive", !isMonitoring);
  const dot = monitorStatus.querySelector(".dot");
  const label = monitorStatus.querySelector("span:last-child");
  if (isMonitoring) {
    dot.style.background = "#40c057"; // green
    label.textContent = "Monitoring";
  } else {
    dot.style.background = "#fa5252"; // red
    label.textContent = "Not Monitoring";
  }
}

// Toggle monitoring and update UI immediately
monitorStatus.addEventListener("click", () => {
  isMonitoring = !isMonitoring;
  updateMonitorStatusUI();
  window.api.toggleMonitoring();
});

// Always sync with main process if state changes from elsewhere
window.api.onMonitoringStateChange((isActive) => {
  isMonitoring = isActive;
  updateMonitorStatusUI();
});

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  stats = { total: 0, safe: 0, warning: 0, blocked: 0 };
  updateStatsUI();
  initThreatChart();
  await parseLogFile();

  try {
    const savedSettings = await window.api.getSettings();
    if (savedSettings) {
      startMinimizedCheckbox.checked = savedSettings.start_minimized || false;
      startMonitoringCheckbox.checked = savedSettings.start_monitoring || false;
      showNotificationsCheckbox.checked = savedSettings.show_notifications !== false;
    }
    if (minimizeToTrayCheckbox) minimizeToTrayCheckbox.checked = true;
    showToast("Welcome to ClipSafe", "Clipboard protection started.", "success");
  } catch (error) {
    showToast("Settings Error", "Failed to load settings.", "warning");
  }

  document.querySelectorAll('.legend-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.getAttribute('data-category');
      updateThreatAnalysis(category);
    });
  });

  updateMonitorStatusUI();
});