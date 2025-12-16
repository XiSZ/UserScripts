// ==UserScript==
// @name         Twitch Bypass Subscriber-Only VODs
// @namespace    http://tampermonkey.net/
// @version      0.05
// @description  Bypass subscriber-only VOD viewing restrictions on Twitch
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

  console.log("[Twitch VOD Bypass] Script initializing...");

  // Store original functions
  const originalFetch = window.fetch;
  const originalDefineProperty = Object.defineProperty;
  const originalJSONParse = JSON.parse;

  // Intercept JSON.parse to modify GraphQL responses
  JSON.parse = function (text) {
    const result = originalJSONParse.apply(this, arguments);

    try {
      // Check if this is a GraphQL response with extensions
      if (result && result.data && result.extensions) {
        // Look for channel data
        if (result.data.channel) {
          // Remove subscriber-only restrictions
          if (result.data.channel.viewersOnly === "SUBSCRIBERS") {
            result.data.channel.viewersOnly = "PUBLIC";
            console.log("[Twitch VOD Bypass] Changed viewersOnly to PUBLIC");
          }
        }

        // Handle user data - spoof subscription status
        if (result.data.currentUser) {
          if (!result.data.currentUser.subscriptionBenefit) {
            result.data.currentUser.subscriptionBenefit = { tier: "1000" };
          }
        }

        // Handle video restrictions - CRITICAL for VODs
        if (result.data.video) {
          if (result.data.video.viewableBy === "SUBSCRIBERS") {
            result.data.video.viewableBy = "PUBLIC";
            console.log(
              "[Twitch VOD Bypass] Changed video viewableBy to PUBLIC"
            );
          }
          if (result.data.video.restrictedReason) {
            result.data.video.restrictedReason = null;
          }
          if (result.data.video.previewThumbnailURL) {
            // Ensure preview is accessible
            console.log(
              "[Twitch VOD Bypass] Video data intercepted and modified"
            );
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }

    return result;
  };

  // Intercept fetch to modify responses
  window.fetch = async function (...args) {
    const url = args[0];
    const response = await originalFetch.apply(this, args);

    // Only intercept Twitch GraphQL and Helix API requests
    if (
      typeof url === "string" &&
      (url.includes("gql.twitch.tv") || url.includes("api.twitch.tv/helix"))
    ) {
      const clonedResponse = response.clone();

      try {
        const data = await clonedResponse.json();

        // Modify the response data
        let modified = false;

        if (data && data.data) {
          // Remove VOD restrictions - PRIMARY FUNCTION
          if (data.data.video?.viewableBy === "SUBSCRIBERS") {
            data.data.video.viewableBy = "PUBLIC";
            modified = true;
            console.log(
              "[Twitch VOD Bypass] Modified fetch response: changed viewableBy to PUBLIC"
            );
          }

          // Handle playback access tokens for VODs
          if (data.data.videoPlaybackAccessToken) {
            console.log(
              "[Twitch VOD Bypass] Intercepted video playback access token"
            );
            modified = true;
          }

          // Make user appear subscribed for permission checks
          if (data.data.channel?.self) {
            if (!data.data.channel.self.subscription) {
              data.data.channel.self.subscription = { tier: "1000" };
              modified = true;
            }
          }

          // Handle channel subscription checks
          if (data.data.channel?.viewersOnly === "SUBSCRIBERS") {
            data.data.channel.viewersOnly = "PUBLIC";
            modified = true;
          }
        }

        // Return modified response if we changed anything
        if (modified) {
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch (e) {
        // Not JSON or error, return original
      }
    }

    return response;
  };

  // Remove subscriber-only overlays on VODs
  function removeVODRestrictions() {
    let removed = false;

    // Remove subscriber-only overlay
    const overlays = document.querySelectorAll(
      '[data-a-target="player-overlay-gate"], [data-a-target="content-gate"]'
    );
    overlays.forEach((overlay) => {
      if (overlay && overlay.textContent.toLowerCase().includes("subscribe")) {
        overlay.remove();
        removed = true;
      }
    });

    // Remove any content gate by class
    const contentGates = document.querySelectorAll(
      '.content-overlay-gate, .content-gate, [class*="SubscriberOnly"], [class*="subscriber-only"]'
    );
    contentGates.forEach((gate) => {
      gate.remove();
      removed = true;
    });

    // Enable video player if it's disabled
    const videoPlayer = document.querySelector("video");
    if (videoPlayer) {
      videoPlayer.removeAttribute("disabled");
      videoPlayer.style.pointerEvents = "auto";
      videoPlayer.style.opacity = "1";
      videoPlayer.style.display = "block";
    }

    // Remove "Subscribe to watch" buttons and their containers
    const subscribeButtons = document.querySelectorAll("button");
    subscribeButtons.forEach((button) => {
      const text = button.textContent.toLowerCase();
      if (
        text.includes("subscribe to watch") ||
        text.includes("subscribe to view") ||
        text.includes("subscriber-only")
      ) {
        const parent = button.closest(
          '[class*="overlay"], [class*="gate"], [class*="restriction"]'
        );
        if (parent) {
          parent.remove();
          removed = true;
        }
      }
    });

    if (removed) {
      console.log(
        "[Twitch VOD Bypass] Removed subscriber-only overlays and restrictions"
      );
    }
  }

  // Use MutationObserver to watch for VOD restrictions
  function watchForRestrictions() {
    let attempts = 0;
    const maxAttempts = 50;

    const intervalId = setInterval(() => {
      attempts++;
      removeVODRestrictions();

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
      }
    }, 500);

    // Also use MutationObserver for dynamic changes
    const observer = new MutationObserver(() => {
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

  // Aggressive property interception for VOD access
  Object.defineProperty = function (obj, prop, descriptor) {
    // Intercept subscription and VOD permission checks
    if (typeof prop === "string") {
      const lowerProp = prop.toLowerCase();

      if (
        lowerProp.includes("viewable") ||
        lowerProp.includes("subscriber") ||
        lowerProp.includes("restriction") ||
        lowerProp.includes("vodaccess")
      ) {
        if (descriptor && descriptor.get) {
          const originalGetter = descriptor.get;
          descriptor.get = function () {
            const result = originalGetter.apply(this);
            if (result === "SUBSCRIBERS") {
              console.log(
                `[Twitch VOD Bypass] Overriding ${prop}: SUBSCRIBERS -> PUBLIC`
              );
              return "PUBLIC";
            }
            if (result === false && lowerProp.includes("access")) {
              return true;
            }
            return result;
          };
        } else if (descriptor && "value" in descriptor) {
          if (descriptor.value === "SUBSCRIBERS") {
            descriptor.value = "PUBLIC";
            console.log(`[Twitch VOD Bypass] Changed ${prop} value to PUBLIC`);
          } else if (
            descriptor.value === false &&
            lowerProp.includes("access")
          ) {
            descriptor.value = true;
          }
        }
      }
    }

    return originalDefineProperty.apply(this, [obj, prop, descriptor]);
  };

  // Initialize watchers
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
      console.log(
        "[Twitch VOD Bypass] Page changed, re-checking VOD restrictions"
      );
      setTimeout(() => {
        removeVODRestrictions();
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  console.log("[Twitch VOD Bypass] Script fully loaded - VOD bypass active");
})();
