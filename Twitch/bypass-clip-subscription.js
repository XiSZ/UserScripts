// ==UserScript==
// @name         Twitch Bypass Subscription Restrictions
// @namespace    http://tampermonkey.net/
// @version      0.01
// @description  Bypass subscriber-only clip creation and VOD restrictions on Twitch
// @author       XiSZ
// @icon         https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png
// @homepage     https://github.com/XiSZ/UserScripts
// @updateURL    https://cdn.jsdelivr.net/gh/XiSZ/UserScripts@main/Twitch/bypass-clip-subscription.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/XiSZ/UserScripts@main/Twitch/bypass-clip-subscription.js
// @supportURL   https://github.com/XiSZ/UserScripts/issues
// @match        https://www.twitch.tv/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // Override the XHR and Fetch to intercept clip creation requests
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Intercept fetch requests
  window.fetch = function (...args) {
    const url = args[0];

    // Check if this is a GraphQL request (Twitch uses GraphQL)
    if (typeof url === "string" && url.includes("gql.twitch.tv")) {
      const options = args[1] || {};

      // Clone the request to modify it if needed
      if (options.body) {
        try {
          const body = JSON.parse(options.body);

          // Check if this is a clip creation request
          if (
            body.operationName === "CreateClip" ||
            (body.query && body.query.includes("createClip"))
          ) {
            console.log("[Twitch Bypass] Intercepted clip creation request");
          }

          // Check for VOD access requests
          if (
            body.operationName === "VideoAccessToken_Clip" ||
            body.operationName === "PlaybackAccessToken" ||
            body.operationName === "VideoMetadata" ||
            (body.query &&
              (body.query.includes("videoPlaybackAccessToken") ||
                body.query.includes("subscribersOnly")))
          ) {
            console.log("[Twitch Bypass] Intercepted VOD access request");
          }
        } catch (e) {
          // If parsing fails, continue normally
        }
      }

      // Intercept responses to modify subscription checks
      return originalFetch.apply(this, args).then((response) => {
        const clonedResponse = response.clone();

        // Try to read and modify the response for subscription checks
        clonedResponse
          .json()
          .then((data) => {
            if (data && data.data) {
              // Check for video/VOD data with subscription restrictions
              if (
                data.data.video &&
                data.data.video.viewableBy === "SUBSCRIBERS"
              ) {
                console.log(
                  "[Twitch Bypass] Detected subscriber-only VOD restriction"
                );
              }
            }
          })
          .catch(() => {
            // Not JSON or failed to parse, ignore
          });

        return response;
      });
    }

    return originalFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (data) {
    if (this._url && this._url.includes("gql.twitch.tv") && data) {
      try {
        const body = JSON.parse(data);
        if (
          body.operationName === "CreateClip" ||
          (body.query && body.query.includes("createClip"))
        ) {
          console.log("[Twitch Bypass] Intercepted clip creation XHR request");
        }

        // Check for VOD access requests
        if (
          body.operationName === "VideoAccessToken_Clip" ||
          body.operationName === "PlaybackAccessToken" ||
          body.operationName === "VideoMetadata"
        ) {
          console.log("[Twitch Bypass] Intercepted VOD access XHR request");
        }
      } catch (e) {
        // Continue normally if parsing fails
      }
    }
    return originalXHRSend.apply(this, [data]);
  };

  // Remove subscriber-only overlays on VODs
  function removeVODRestrictions() {
    // Remove subscriber-only overlay
    const overlays = document.querySelectorAll(
      '[data-a-target="player-overlay-gate"]'
    );
    overlays.forEach((overlay) => {
      if (overlay && overlay.textContent.toLowerCase().includes("subscribe")) {
        overlay.remove();
        console.log("[Twitch Bypass] Removed subscriber-only overlay");
      }
    });

    // Remove any content gate
    const contentGates = document.querySelectorAll(
      '.content-overlay-gate, .content-gate, [class*="SubscriberOnly"]'
    );
    contentGates.forEach((gate) => gate.remove());

    // Enable video player if it's disabled
    const videoPlayer = document.querySelector("video");
    if (videoPlayer) {
      videoPlayer.removeAttribute("disabled");
      // Remove any CSS that might be hiding or disabling it
      videoPlayer.style.pointerEvents = "auto";
      videoPlayer.style.opacity = "1";
    }

    // Check for "Subscribe to watch" buttons and remove them
    const subscribeButtons = document.querySelectorAll("button");
    subscribeButtons.forEach((button) => {
      if (
        button.textContent.toLowerCase().includes("subscribe to watch") ||
        button.textContent.toLowerCase().includes("subscribe to view")
      ) {
        const parent = button.closest('[class*="overlay"], [class*="gate"]');
        if (parent) parent.remove();
      }
    });
  }

  // Wait for page to load and modify the clip button behavior
  function enableClipButton() {
    // Find the clip button
    const clipButton = document.querySelector(
      '[data-a-target="player-clip-button"]'
    );

    if (clipButton) {
      // Remove disabled state if present
      clipButton.removeAttribute("disabled");
      clipButton.style.pointerEvents = "auto";
      clipButton.style.opacity = "1";

      // Remove any tooltip that says "Subscribe to clip"
      const tooltip = clipButton.closest("[data-a-target]");
      if (tooltip) {
        tooltip.removeAttribute("aria-label");
        tooltip.setAttribute("aria-label", "Clip");
      }

      console.log("[Clip Bypass] Clip button enabled");
      return true;
    }
    return false;
  }

  // Use MutationObserver to watch for restrictions
  function watchForRestrictions() {
    let attempts = 0;
    const maxAttempts = 50;

    const intervalId = setInterval(() => {
      attempts++;
      enableClipButton();
      removeVODRestrictions();

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
      }
    }, 500);

    // Also use MutationObserver for dynamic changes
    const observer = new MutationObserver(() => {
      enableClipButton();
      removeVODRestrictions();
    });

    // Start observing when DOM is ready
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } else {
      window.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      });
    }
  }

  // Patch the Twitch API responses
  function patchTwitchAPI() {
    // Override Object.defineProperty to intercept property definitions
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function (obj, prop, descriptor) {
      // Check if this is defining a subscription-related property
      if (
        typeof prop === "string" &&
        (prop.includes("subscription") ||
          prop.includes("canClip") ||
          prop.includes("clipPermission") ||
          prop.includes("viewableBy") ||
          prop.includes("subscribersOnly") ||
          prop.includes("restrictionInfo"))
      ) {
        // If it's a getter that might return false, override it
        if (descriptor && descriptor.get) {
          const originalGetter = descriptor.get;
          descriptor.get = function () {
            const result = originalGetter.apply(this);
            // If it's checking permissions, always return true/public access
            if (typeof result === "boolean" && !result) {
              return true;
            }
            // If it's checking viewableBy, return 'PUBLIC'
            if (result === "SUBSCRIBERS") {
              return "PUBLIC";
            }
            return result;
          };
        }

        // If it's a value that restricts access, override it
        if (descriptor && descriptor.value === false) {
          descriptor.value = true;
        }
        if (descriptor && descriptor.value === "SUBSCRIBERS") {
          descriptor.value = "PUBLIC";
        }
      }

      return originalDefineProperty.apply(this, [obj, prop, descriptor]);
    };
  }

  // Initialize
  console.log(
    "[Twitch Bypass] Script loaded - Bypassing clip and VOD restrictions"
  );
  patchTwitchAPI();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchForRestrictions);
  } else {
    watchForRestrictions();
  }

  // Additional check for when navigating between pages (Twitch is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("[Twitch Bypass] Page changed, re-checking restrictions");
      setTimeout(() => {
        removeVODRestrictions();
        enableClipButton();
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
