// ==UserScript==
// @name         URLScan by XiSZ
// @namespace    http://tampermonkey.net/
// @version      0.05
// @description  Scan URLs using urlscan.io API and display results with a GUI. Alt + right-click to open (on links to scan them directly). Alt+Shift+S also works.
// @author       XiSZ
// @icon         https://avatars.githubusercontent.com/u/40718990
// @homepage     https://github.com/XiSZ/UserScripts
// @updateURL    https://cdn.jsdelivr.net/gh/XiSZ/UserScripts@main/Global/url-scanner.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/XiSZ/UserScripts@main/Global/url-scanner.js
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
      #urlscan-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
        pointer-events: all;
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

      #urlscan-context-menu {
        position: fixed;
        display: none;
        min-width: 220px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 32px rgba(0,0,0,0.2);
        overflow: hidden;
        padding: 8px 0;
        pointer-events: all;
      }

      .urlscan-menu-item {
        display: flex;
        width: 100%;
        background: transparent;
        border: none;
        padding: 10px 14px;
        text-align: left;
        font-size: 14px;
        color: #1f2937;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .urlscan-menu-item:hover {
        background: #f3f4f6;
      }

      .urlscan-menu-item:disabled {
        color: #9ca3af;
        cursor: not-allowed;
        background: transparent;
      }

      .urlscan-menu-hint {
        padding: 6px 14px 4px;
        font-size: 12px;
        color: #6b7280;
        border-top: 1px solid #e5e7eb;
      }
    `);

  // Create UI
  const root = document.createElement("div");
  root.id = "urlscan-root";
  root.innerHTML = `
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
      <div id="urlscan-context-menu">
        <button class="urlscan-menu-item" data-action="open-panel">Open URL Scanner</button>
        <button class="urlscan-menu-item" data-action="scan-current">Scan Current Page</button>
        <button class="urlscan-menu-item urlscan-menu-link" data-action="scan-link">Scan Link Target</button>
        <div class="urlscan-menu-hint">Alt + right-click to open</div>
      </div>
    `;

  document.body.appendChild(root);

  // UI Elements
  const panel = document.getElementById("urlscan-panel");
  const closeBtn = document.querySelector(".urlscan-close");
  const urlInput = document.getElementById("urlscan-url");
  const submitBtn = document.getElementById("urlscan-submit");
  const currentBtn = document.getElementById("urlscan-current");
  const resultsDiv = document.getElementById("urlscan-results");
  const headerDiv = document.querySelector(".urlscan-header");
  const contextMenu = document.getElementById("urlscan-context-menu");
  const linkMenuItem = contextMenu.querySelector(".urlscan-menu-link");

  let lastLinkHref = null;

  // Drag state object for panel
  const panelDrag = {
    active: false,
    moved: false,
    xOffset: 0,
    yOffset: 0,
    initialX: 0,
    initialY: 0,
  };

  headerDiv.addEventListener("mousedown", panelDragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function drag(e) {
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
    if (panelDrag.active) {
      panelDrag.active = false;
      headerDiv.classList.remove("dragging");
    }
  }

  function panelDragStart(e) {
    if (e.target.classList.contains("urlscan-close")) return;

    // Initialize offsets from current panel position to avoid jumps on first drag
    panelDrag.xOffset = 0;
    panelDrag.yOffset = 0;
    panelDrag.initialX = e.clientX;
    panelDrag.initialY = e.clientY;
    panelDrag.active = true;
    panelDrag.moved = false;
    headerDiv.classList.add("dragging");
    e.preventDefault();
  }

  function openPanel(presetUrl, anchorX, anchorY) {
    if (presetUrl) {
      urlInput.value = presetUrl;
    }

    positionPanel(anchorX, anchorY);
    panel.classList.add("active");

    setTimeout(() => {
      urlInput.focus();
      urlInput.select();
    }, 0);
  }

  let lastContextX = 0;
  let lastContextY = 0;

  function showContextMenu(x, y) {
    lastContextX = x;
    lastContextY = y;

    const menuWidth = contextMenu.offsetWidth || 220;
    const menuHeight = contextMenu.offsetHeight || 170;
    const padding = 8;

    let left = Math.min(x, window.innerWidth - menuWidth - padding);
    let top = Math.min(y, window.innerHeight - menuHeight - padding);

    left = Math.max(padding, left);
    top = Math.max(padding, top);

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.display = "block";
  }

  function hideContextMenu() {
    contextMenu.style.display = "none";
  }

  function handleContextMenu(e) {
    if (!e.altKey) return;
    e.preventDefault();

    lastLinkHref = e.target.closest("a")?.href || null;
    linkMenuItem.disabled = !lastLinkHref;
    showContextMenu(e.clientX, e.clientY);
  }

  function handleMenuClick(e) {
    const actionButton = e.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    hideContextMenu();

    if (action === "open-panel") {
      openPanel(
        urlInput.value || window.location.href,
        lastContextX,
        lastContextY
      );
    } else if (action === "scan-current") {
      urlInput.value = window.location.href;
      openPanel(window.location.href, lastContextX, lastContextY);
      scanURL(window.location.href);
    } else if (action === "scan-link" && lastLinkHref) {
      urlInput.value = lastLinkHref;
      openPanel(lastLinkHref, lastContextX, lastContextY);
      scanURL(lastLinkHref);
    }
  }

  contextMenu.addEventListener("click", handleMenuClick);
  // Use capture phase so site-level handlers cannot block us
  document.addEventListener("contextmenu", handleContextMenu, true);
  window.addEventListener("contextmenu", handleContextMenu, true);
  if (document.body) {
    document.body.addEventListener("contextmenu", handleContextMenu, true);
  }
  // Fallback: capture right-button mousedown in case contextmenu is fully suppressed
  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button === 2 && e.altKey) {
        e.preventDefault();
        lastLinkHref = e.target.closest("a")?.href || null;
        linkMenuItem.disabled = !lastLinkHref;
        showContextMenu(e.clientX, e.clientY);
      }
    },
    true
  );
  document.addEventListener("click", (e) => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideContextMenu();
      panel.classList.remove("active");
    }
    // Keyboard fallback: Alt+Shift+S opens the panel
    if (e.altKey && e.shiftKey && (e.key === "S" || e.key === "s")) {
      openPanel(urlInput.value || window.location.href);
    }
  });

  // Position panel to stay within viewport
  function positionPanel(preferredX, preferredY) {
    const panelWidth = 420;
    const panelHeight = Math.min(650, window.innerHeight - 40);
    const padding = 16;

    let left =
      typeof preferredX === "number"
        ? preferredX - panelWidth / 2
        : window.innerWidth - panelWidth - padding;
    let top =
      typeof preferredY === "number"
        ? preferredY + 12
        : window.innerHeight - panelHeight - padding;

    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - panelWidth - padding)
    );
    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - panelHeight - padding)
    );

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
    "URLScan.io Helper loaded! Alt + right-click anywhere to open the URL scanner menu."
  );
})();
