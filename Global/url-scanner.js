// ==UserScript==
// @name         URLScan
// @namespace    http://tampermonkey.net/
// @version      0.01
// @description  Scan URLs using urlscan.io API and display results with a GUI
// @author       XiSZ
// @icon         https://avatars.githubusercontent.com/u/40718990
// @homepage     https://github.com/XiSZ/UserScripts
// @updateURL    https://github.com/XiSZ/UserScripts/raw/main/Global/url-scanner.js
// @downloadURL  https://github.com/XiSZ/UserScripts/raw/main/Global/url-scanner.js
// @supportURL   https://github.com/XiSZ/UserScripts/issues
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      urlscan.io
// ==/UserScript==

(function () {
  "use strict";

  // Configuration
  const API_KEY = "YOUR_API_KEY"; // Get your API key from https://urlscan.io/user/profile
  const API_BASE = "https://urlscan.io/api/v1";

  // Add CSS styles
  GM_addStyle(`
        #urlscan-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        #urlscan-toggle {
            background: transparent;
            color: #667eea;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 28px;
            cursor: move;
            transition: transform 0.2s ease, filter 0.2s ease;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: center;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }

        #urlscan-toggle:hover {
            transform: scale(1.1);
            filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
        }

        #urlscan-toggle.dragging {
            cursor: grabbing;
            transition: none;
        }

        #urlscan-panel {
            display: none;
            position: fixed;
            width: 420px;
            max-height: 650px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.25);
            overflow: hidden;
        }

        #urlscan-panel.active {
            display: flex;
            flex-direction: column;
        }

        .urlscan-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 16px;
            font-weight: 600;
            font-size: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        }

        .urlscan-header.dragging {
            cursor: grabbing;
        }

        .urlscan-close {
            background: transparent;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 28px;
            height: 28px;
            line-height: 1;
        }

        .urlscan-body {
            padding: 16px;
            overflow-y: auto;
            flex: 1;
        }

        .urlscan-input-group {
            margin-bottom: 12px;
        }

        .urlscan-input-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #333;
        }

        .urlscan-input {
            width: 100%;
            padding: 10px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
            transition: border-color 0.3s;
        }

        .urlscan-input:focus {
            outline: none;
            border-color: #667eea;
        }

        .urlscan-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 8px;
        }

        .urlscan-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .urlscan-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .urlscan-results {
            margin-top: 16px;
        }

        .urlscan-status {
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 13px;
        }

        .urlscan-status.loading {
            background: #fff3cd;
            color: #856404;
        }

        .urlscan-status.success {
            background: #d4edda;
            color: #155724;
        }

        .urlscan-status.error {
            background: #f8d7da;
            color: #721c24;
        }

        .urlscan-result-item {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 8px;
            font-size: 13px;
        }

        .urlscan-result-item strong {
            display: inline-block;
            min-width: 100px;
            color: #333;
        }

        .urlscan-result-item a {
            color: #667eea;
            text-decoration: none;
            word-break: break-all;
        }

        .urlscan-result-item a:hover {
            text-decoration: underline;
        }

        .urlscan-screenshot {
            width: 100%;
            border-radius: 6px;
            margin-top: 12px;
        }

        .urlscan-visibility {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .urlscan-radio {
            display: flex;
            align-items: center;
            cursor: pointer;
        }

        .urlscan-radio input {
            margin-right: 4px;
        }
    `);

  // Create UI
  const widget = document.createElement("div");
  widget.id = "urlscan-widget";
  widget.innerHTML = `
        <button id="urlscan-toggle" title="URLScan.io Helper">🔍</button>
        <div id="urlscan-panel">
            <div class="urlscan-header">
                <span>URL Scanner</span>
                <button class="urlscan-close">×</button>
            </div>
            <div class="urlscan-body">
                <div class="urlscan-input-group">
                    <label>URL to scan:</label>
                    <input type="text" id="urlscan-url" class="urlscan-input" placeholder="https://example.com">
                </div>
                <div class="urlscan-input-group">
                    <label>Visibility:</label>
                    <div class="urlscan-visibility">
                        <label class="urlscan-radio">
                            <input type="radio" name="visibility" value="public" checked>
                            <span>Public</span>
                        </label>
                        <label class="urlscan-radio">
                            <input type="radio" name="visibility" value="unlisted">
                            <span>Unlisted</span>
                        </label>
                        <label class="urlscan-radio">
                            <input type="radio" name="visibility" value="private">
                            <span>Private</span>
                        </label>
                    </div>
                </div>
                <button id="urlscan-submit" class="urlscan-btn">Scan URL</button>
                <button id="urlscan-current" class="urlscan-btn">Scan Current Page</button>
                <div id="urlscan-results"></div>
            </div>
        </div>
    `;

  document.body.appendChild(widget);

  // UI Elements
  const toggleBtn = document.getElementById("urlscan-toggle");
  const panel = document.getElementById("urlscan-panel");
  const closeBtn = document.querySelector(".urlscan-close");
  const urlInput = document.getElementById("urlscan-url");
  const submitBtn = document.getElementById("urlscan-submit");
  const currentBtn = document.getElementById("urlscan-current");
  const resultsDiv = document.getElementById("urlscan-results");
  const headerDiv = document.querySelector(".urlscan-header");

  // Drag state objects
  const buttonDrag = {
    active: false,
    moved: false,
    xOffset: 0,
    yOffset: 0,
    initialX: 0,
    initialY: 0,
  };

  const panelDrag = {
    active: false,
    moved: false,
    xOffset: 0,
    yOffset: 0,
    initialX: 0,
    initialY: 0,
  };

  toggleBtn.addEventListener("mousedown", dragStart);
  headerDiv.addEventListener("mousedown", panelDragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    if (e.target === toggleBtn) {
      buttonDrag.initialX = e.clientX - buttonDrag.xOffset;
      buttonDrag.initialY = e.clientY - buttonDrag.yOffset;
      buttonDrag.active = true;
      buttonDrag.moved = false;
      toggleBtn.classList.add("dragging");
    }
  }

  function drag(e) {
    if (buttonDrag.active) {
      e.preventDefault();

      const currentX = e.clientX - buttonDrag.initialX;
      const currentY = e.clientY - buttonDrag.initialY;

      if (
        Math.abs(currentX - buttonDrag.xOffset) > 5 ||
        Math.abs(currentY - buttonDrag.yOffset) > 5
      ) {
        buttonDrag.moved = true;
      }

      buttonDrag.xOffset = currentX;
      buttonDrag.yOffset = currentY;
      setTranslate(currentX, currentY, widget);
    }

    if (panelDrag.active) {
      e.preventDefault();

      const currentX = e.clientX - panelDrag.initialX;
      const currentY = e.clientY - panelDrag.initialY;
      const deltaX = currentX - panelDrag.xOffset;
      const deltaY = currentY - panelDrag.yOffset;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        panelDrag.moved = true;
      }

      panelDrag.xOffset = currentX;
      panelDrag.yOffset = currentY;

      const currentLeft = parseFloat(panel.style.left) || 0;
      const currentTop = parseFloat(panel.style.top) || 0;
      panel.style.left = `${currentLeft + deltaX}px`;
      panel.style.top = `${currentTop + deltaY}px`;
    }
  }

  function dragEnd() {
    if (buttonDrag.active) {
      buttonDrag.active = false;
      toggleBtn.classList.remove("dragging");
    }
    if (panelDrag.active) {
      panelDrag.active = false;
      headerDiv.classList.remove("dragging");
    }
  }

  function panelDragStart(e) {
    if (e.target.classList.contains("urlscan-close")) return;

    panelDrag.initialX = e.clientX - panelDrag.xOffset;
    panelDrag.initialY = e.clientY - panelDrag.yOffset;
    panelDrag.active = true;
    panelDrag.moved = false;
    headerDiv.classList.add("dragging");
    e.preventDefault();
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  // Toggle panel
  toggleBtn.addEventListener("click", () => {
    if (!buttonDrag.moved) {
      const isOpening = !panel.classList.contains("active");
      panel.classList.toggle("active");

      if (isOpening) {
        positionPanel();
      }
    }
  });

  // Position panel to stay within viewport
  function positionPanel() {
    const buttonRect = toggleBtn.getBoundingClientRect();
    const panelWidth = 420;
    const panelHeight = Math.min(650, window.innerHeight - 40);
    const padding = 10;
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;

    let left, top;

    // Calculate horizontal position - center the panel above/below the button
    left = buttonCenterX - panelWidth / 2;

    // Adjust if panel would go off left edge
    if (left < padding) {
      left = padding;
    }

    // Adjust if panel would go off right edge
    if (left + panelWidth > window.innerWidth - padding) {
      left = window.innerWidth - panelWidth - padding;
    }

    // Calculate vertical position - always try above first
    const spaceAbove = buttonRect.top;
    const spaceBelow = window.innerHeight - buttonRect.bottom;

    if (spaceAbove >= panelHeight + padding || spaceAbove >= spaceBelow) {
      // Place above the button
      top = buttonRect.top - panelHeight - padding;

      // Make sure it doesn't go off top
      if (top < padding) {
        top = padding;
      }
    } else {
      // Place below the button if not enough space above
      top = buttonRect.bottom + padding;

      // Make sure it doesn't go off bottom
      if (top + panelHeight > window.innerHeight - padding) {
        top = window.innerHeight - panelHeight - padding;
      }
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${panelHeight}px`;
  }

  closeBtn.addEventListener("click", () => {
    panel.classList.remove("active");
  });

  // Scan current page
  currentBtn.addEventListener("click", () => {
    urlInput.value = window.location.href;
    scanURL(window.location.href);
  });

  // Scan custom URL
  submitBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (url) {
      scanURL(url);
    } else {
      showStatus("Please enter a URL", "error");
    }
  });

  // Handle Enter key
  urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitBtn.click();
    }
  });

  // Show status message
  function showStatus(message, type = "loading") {
    resultsDiv.innerHTML = `<div class="urlscan-status ${type}">${message}</div>`;
  }

  // Toggle button states
  function setButtonsEnabled(enabled) {
    submitBtn.disabled = !enabled;
    currentBtn.disabled = !enabled;
  }

  // Scan URL function
  function scanURL(url) {
    showStatus("⏳ Submitting scan request...", "loading");
    setButtonsEnabled(false);

    const visibility = document.querySelector(
      'input[name="visibility"]:checked'
    ).value;

    // Submit scan
    GM_xmlhttpRequest({
      method: "POST",
      url: `${API_BASE}/scan/`,
      headers: {
        "Content-Type": "application/json",
        "API-Key": API_KEY,
      },
      data: JSON.stringify({ url, visibility }),
      onload: (response) => {
        if (response.status === 200) {
          const data = JSON.parse(response.responseText);
          showStatus(
            "⏳ Scanning in progress... This may take 10-30 seconds.",
            "loading"
          );
          setTimeout(() => getResults(data.uuid), 15000);
        } else {
          showStatus(`❌ Error: ${response.statusText}`, "error");
          setButtonsEnabled(true);
        }
      },
      onerror: () => {
        showStatus("❌ Network error. Please check your connection.", "error");
        setButtonsEnabled(true);
      },
    });
  }

  // Get scan results
  function getResults(uuid, attempts = 0) {
    GM_xmlhttpRequest({
      method: "GET",
      url: `${API_BASE}/result/${uuid}/`,
      onload: (response) => {
        if (response.status === 200) {
          const data = JSON.parse(response.responseText);
          displayResults(data);
          setButtonsEnabled(true);
        } else if (response.status === 404 && attempts < 5) {
          showStatus(
            `⏳ Still scanning... (attempt ${attempts + 1}/5)`,
            "loading"
          );
          setTimeout(() => getResults(uuid, attempts + 1), 5000);
        } else {
          showStatus(
            "❌ Failed to retrieve results. The scan may still be processing. Check urlscan.io directly.",
            "error"
          );
          setButtonsEnabled(true);
        }
      },
      onerror: () => {
        showStatus("❌ Network error while fetching results.", "error");
        setButtonsEnabled(true);
      },
    });
  }

  // Helper to create result items
  function createResultItem(label, value, isLink = false) {
    if (!value) return "";
    const content = isLink
      ? `<a href="${value}" target="_blank">${value}</a>`
      : value;
    return `<div class="urlscan-result-item"><strong>${label}:</strong> ${content}</div>`;
  }

  // Display results
  function displayResults(data) {
    const { page = {}, stats = {}, verdicts = {}, task } = data;

    const items = [
      '<div class="urlscan-status success">✅ Scan complete!</div>',
      '<div class="urlscan-results">',
      createResultItem("URL", task.url, true),
      `<div class="urlscan-result-item"><strong>Result Page:</strong> <a href="${task.reportURL}" target="_blank">View Full Report</a></div>`,
      createResultItem("Domain", page.domain),
      createResultItem("IP Address", page.ip),
      createResultItem("Country", page.country),
      createResultItem("Server", page.server),
    ];

    // Verdicts
    if (verdicts.overall) {
      const maliciousClass = verdicts.overall.malicious ? "error" : "success";
      const verdict = verdicts.overall.malicious ? "⚠️ MALICIOUS" : "✅ Clean";
      items.push(`<div class="urlscan-status ${maliciousClass}">
        <strong>Verdict:</strong> ${verdict} (Score: ${verdicts.overall.score}/100)
      </div>`);
    }

    // Stats
    items.push(
      createResultItem("Unique IPs", stats.uniqIPs),
      createResultItem("Total Links", stats.totalLinks),
      createResultItem("Malicious Items", stats.malicious)
    );

    // Screenshot
    if (task.screenshotURL) {
      items.push(`<div class="urlscan-result-item">
        <strong>Screenshot:</strong><br>
        <img src="${task.screenshotURL}" class="urlscan-screenshot" alt="Screenshot">
      </div>`);
    }

    items.push("</div>");
    resultsDiv.innerHTML = items.filter(Boolean).join("");
  }

  console.log(
    "URLScan.io Helper loaded! Click the search icon in the bottom-right corner."
  );
})();
