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

// Stats
let stats = {
  total: 0,
  safe: 0,
  warning: 0,
  blocked: 0,
};
let monitorStart = Date.now();

// Toast Container
const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

// Initialize threat stats with additional data
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

// Update Stats
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
  };
  try {
    await window.api.saveSettings(settings);
    showToast("Settings Saved", "Preferences updated successfully.", "success");
  } catch (error) {
    showToast("Settings Error", "Failed to save settings.", "danger");
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
  // Remove empty state if present
  const emptyState = activityList.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const activityItem = document.createElement("li");
  activityItem.className = "activity-item";

  try {
    // Parse message data
    let msgData;
    if (typeof data.message === "string") {
      try {
        // Find and parse JSON content
        const jsonMatches = data.message.match(/\{[^]*\}/g);
        if (jsonMatches) {
          // Try each match until we find valid JSON
          for (const match of jsonMatches) {
            try {
              msgData = JSON.parse(match);
              break;
            } catch (e) {
              continue;
            }
          }
        }
        if (!msgData) {
          msgData = { text: data.message };
        }
      } catch (e) {
        msgData = { text: data.message };
      }
    } else {
      msgData = data.message;
    }

    const type = msgData.severity || data.severity || "info";
    updateStats(type, msgData);

    const iconClass =
      type === "warning" ? "fa-exclamation-triangle" :
      type === "danger" ? "fa-ban" : "fa-check-circle";

    let content = "";

    // Handle content display
    if (msgData.content) {
      content += `<div class="log-section content-preview">
        <strong>Content:</strong>
        <pre>${msgData.content}</pre>
      </div>`;
    } else if (msgData.text) {
      content += `<div class="log-section">
        <pre>${msgData.text}</pre>
      </div>`;
    }

    // Add analysis section if present
    if (msgData.groq_analysis) {
      const groq = msgData.groq_analysis;
      content += `<div class="log-section">
        <strong>AI Analysis:</strong><br>
        • Category: ${groq.category || "N/A"}<br>
        • Confidence: ${groq.confidence ? (groq.confidence * 100).toFixed(1) + "%" : "N/A"}<br>
        • Assessment: ${groq.explanation || "N/A"}<br>
        ${groq.potential_threat ? 
          `• <span class="threat">Threat: ${groq.potential_threat}</span>` : ""}
      </div>`;

      if (!groq.is_safe) {
        const category = groq.category?.toLowerCase() || "other";
        updateThreatChart(
          category,
          msgData.content || msgData.text,
          groq
        );
      }
    }

    // Add local check results if present
    if (msgData.local_check) {
      content += `<div class="log-section">
        <strong>Local Check:</strong><br>
        <span class="${msgData.local_check.is_safe ? "safe" : "threat"}">
          ${msgData.local_check.message}
        </span>
      </div>`;
    }

    activityItem.innerHTML = `
      <div class="activity-icon ${type}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-message">${content || "No details available"}</div>
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
    // Fallback for unparseable messages
    activityItem.innerHTML = `
      <div class="activity-icon info">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="activity-content">
        <div class="activity-message">
          <div class="log-section">
            <pre>${data.message || "Error displaying message"}</pre>
          </div>
        </div>
        <div class="activity-time">${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
      </div>`;
  }

  // Insert at the top
  activityList.insertBefore(activityItem, activityList.firstChild);

  // Limit to 50 items
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

monitorStatus.addEventListener("click", () => {
  window.api.toggleMonitoring();
});

window.api.onMonitoringStateChange((isActive) => {
  isMonitoring = isActive;
  monitorStatus.classList.toggle("inactive", !isActive);
  monitorStatus.querySelector("span:last-child").textContent = isActive ? "Monitoring" : "Not Monitoring";
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
});