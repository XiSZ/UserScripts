// ==UserScript==
// @name         Twitch Clip Downloader
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add a download button to Twitch clips for easy downloading
// @author       XiSZ
// @icon         https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png
// @homepage     https://github.com/XiSZ/UserScripts
// @updateURL    https://cdn.jsdelivr.net/gh/XiSZ/UserScripts@main/Twitch/download-clips.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/XiSZ/UserScripts@main/Twitch/download-clips.js
// @supportURL   https://github.com/XiSZ/UserScripts/issues
// @match        https://www.twitch.tv/*/clip/*
// @match        https://clips.twitch.tv/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  console.log("[Twitch Clip Downloader] Script initializing...");

  // Wait for the page to fully load
  const waitForElement = (selector, timeout = 10000) => {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  };

  const createDownloadButton = () => {
    // Look for the more options button area
    const moreButton = document.querySelector(
      '[data-test-selector="more-options-button"]'
    );

    if (
      !moreButton ||
      document.querySelector('[data-twitch-clip-downloader="true"]')
    ) {
      return; // Already added or button not found
    }

    // Create download button with similar styling
    const downloadBtn = document.createElement("button");
    downloadBtn.setAttribute("data-twitch-clip-downloader", "true");
    downloadBtn.setAttribute("type", "button");
    downloadBtn.className = moreButton.className;
    downloadBtn.style.marginLeft = "8px";

    downloadBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9H13V5.5h-2V11H8.5l3.5 3.5 3.5-3.5z"/>
      </svg>
    `;

    downloadBtn.title = "Download Clip";

    downloadBtn.addEventListener("click", downloadClip);

    // Insert button next to more options button
    moreButton.parentNode.insertBefore(downloadBtn, moreButton.nextSibling);
  };

  const downloadClip = async () => {
    try {
      // Extract clip slug from URL
      const url = window.location.href;
      const clipMatch = url.match(
        /(?:clips\.twitch\.tv|twitch\.tv\/[^/]+\/clip)\/([a-zA-Z0-9_-]+)/
      );

      if (!clipMatch) {
        alert(
          "Could not identify clip. Make sure you're on a Twitch clip page."
        );
        return;
      }

      const clipSlug = clipMatch[1];
      console.log("[Twitch Clip Downloader] Clip slug:", clipSlug);

      // Fetch clip data from Twitch API
      const query = `
        query {
          clip(slug: "${clipSlug}") {
            id
            title
            slug
            createdAt
            broadcaster {
              displayName
            }
            videoQualities {
              frameRate
              resolution
              sourceURL
            }
          }
        }
      `;

      const response = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
          "Client-ID": await getClientId(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!data.data || !data.data.clip) {
        alert("Failed to fetch clip data. Please try again.");
        return;
      }

      const clip = data.data.clip;
      const qualities = clip.videoQualities || [];

      if (qualities.length === 0) {
        alert("No video qualities available for download.");
        return;
      }

      // Sort by resolution and get the highest quality
      const sortedQualities = qualities.sort((a, b) => {
        const resA = parseInt(a.resolution) || 0;
        const resB = parseInt(b.resolution) || 0;
        return resB - resA;
      });

      const bestQuality = sortedQualities[0];
      const videoUrl = bestQuality.sourceURL;

      // Generate filename
      const filename = `${clip.broadcaster.displayName}_${clip.slug}_${
        clip.createdAt.split("T")[0]
      }.mp4`;

      // Download the video
      downloadFile(videoUrl, filename);
      console.log("[Twitch Clip Downloader] Download started:", filename);
    } catch (error) {
      console.error("[Twitch Clip Downloader] Error:", error);
      alert(
        "An error occurred while downloading the clip. Check console for details."
      );
    }
  };

  const getClientId = async () => {
    // Try to extract Client-ID from page context
    const scripts = document.querySelectorAll("script");

    for (const script of scripts) {
      if (script.textContent.includes("clientID")) {
        const match = script.textContent.match(/"clientID":"([^"]+)"/);
        if (match) return match[1];
      }
    }

    // Fallback to known Client-ID (may expire)
    return "kj8061a4pouxjn4acxae3o84aluamz";
  };

  const downloadFile = (url, filename) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.onload = () => {
      const blobUrl = URL.createObjectURL(xhr.response);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    };
    xhr.onerror = () => {
      alert(
        "Failed to download the clip. The clip may be protected or unavailable."
      );
    };
    xhr.open("GET", url);
    xhr.send();
  };

  // Add button when page loads
  waitForElement('[data-test-selector="more-options-button"]').then(() => {
    createDownloadButton();
  });

  // Re-check for button every few seconds in case of dynamic content
  const checkInterval = setInterval(() => {
    createDownloadButton();
  }, 5000);

  // Clean up on page unload
  window.addEventListener("unload", () => {
    clearInterval(checkInterval);
  });
})();
