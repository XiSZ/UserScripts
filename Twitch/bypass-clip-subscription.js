// ==UserScript==
// @name         Twitch Bypass Subscription Restrictions
// @namespace    http://tampermonkey.net/
// @version      0.02
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

  console.log("[Twitch Bypass] Script initializing...");

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
          // Enable clipping if disabled
          if (result.data.channel.self) {
            if (result.data.channel.self.canClip === false) {
              result.data.channel.self.canClip = true;
              console.log("[Twitch Bypass] Enabled canClip in channel data");
            }
            if (result.data.channel.self.subscriptionBenefit) {
              result.data.channel.self.subscriptionBenefit = null;
            }
          }

          // Remove subscriber-only restrictions
          if (result.data.channel.viewersOnly === "SUBSCRIBERS") {
            result.data.channel.viewersOnly = "PUBLIC";
            console.log("[Twitch Bypass] Changed viewersOnly to PUBLIC");
          }
        }

        // Handle user data
        if (result.data.currentUser) {
          if (result.data.currentUser.subscriptionBenefit) {
            // Make it seem like user is subscribed
            result.data.currentUser.subscriptionBenefit = { tier: "1000" };
          }
        }

        // Handle video restrictions
        if (result.data.video) {
          if (result.data.video.viewableBy === "SUBSCRIBERS") {
            result.data.video.viewableBy = "PUBLIC";
            console.log("[Twitch Bypass] Changed video viewableBy to PUBLIC");
          }
          if (result.data.video.restrictedreason) {
            result.data.video.restrictedreason = null;
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

    // Only intercept Twitch GraphQL requests
    if (typeof url === "string" && url.includes("gql.twitch.tv")) {
      const clonedResponse = response.clone();

      try {
        const data = await clonedResponse.json();

        // Modify the response data
        let modified = false;

        if (data && data.data) {
          // Enable clipping
          if (data.data.channel?.self?.canClip === false) {
            data.data.channel.self.canClip = true;
            modified = true;
            console.log(
              "[Twitch Bypass] Modified fetch response: enabled canClip"
            );
          }

          // Remove VOD restrictions
          if (data.data.video?.viewableBy === "SUBSCRIBERS") {
            data.data.video.viewableBy = "PUBLIC";
            modified = true;
            console.log(
              "[Twitch Bypass] Modified fetch response: changed viewableBy"
            );
          }

          // Make user appear subscribed for permission checks
          if (data.data.channel?.self) {
            if (!data.data.channel.self.subscription) {
              data.data.channel.self.subscription = { tier: "1000" };
              modified = true;
            }
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

  // Force enable clip button and remove restrictions
  function enableClipButton() {
    // Find all possible clip button selectors
    const clipButtons = [
      document.querySelector('[data-a-target="player-clip-button"]'),
      document.querySelector('[aria-label*="Clip"]'),
      ...document.querySelectorAll('button[class*="clip" i]'),
    ].filter(Boolean);

    let enabled = false;
    clipButtons.forEach((clipButton) => {
      if (clipButton) {
        // Force enable the button
        clipButton.removeAttribute("disabled");
        clipButton.removeAttribute("aria-disabled");
        clipButton.style.pointerEvents = "auto !important";
        clipButton.style.opacity = "1 !important";
        clipButton.style.cursor = "pointer";

        // Remove click event blockers
        const events = ["click", "mousedown", "mouseup"];
        events.forEach((event) => {
          clipButton.removeEventListener(
            event,
            (e) => e.stopPropagation(),
            true
          );
        });

        // Update aria-label
        if (clipButton.getAttribute("aria-label")?.includes("Subscribe")) {
          clipButton.setAttribute("aria-label", "Clip");
        }

        enabled = true;
      }
    });

    if (enabled) {
      console.log("[Twitch Bypass] Clip button(s) enabled");
    }
    return enabled;
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

  // Aggressive property interception
  Object.defineProperty = function (obj, prop, descriptor) {
    // Intercept subscription and permission checks
    if (typeof prop === "string") {
      const lowerProp = prop.toLowerCase();

      if (
        lowerProp.includes("canclip") ||
        lowerProp.includes("clippermission") ||
        lowerProp.includes("clipenabled")
      ) {
        // Force clip permission to true
        if (descriptor && descriptor.get) {
          const originalGetter = descriptor.get;
          descriptor.get = function () {
            const result = originalGetter.apply(this);
            if (result === false) {
              console.log(`[Twitch Bypass] Overriding ${prop}: false -> true`);
              return true;
            }
            return result;
          };
        } else if (descriptor && "value" in descriptor) {
          if (descriptor.value === false) {
            descriptor.value = true;
            console.log(`[Twitch Bypass] Changed ${prop} value to true`);
          }
        }
      }

      if (
        lowerProp.includes("viewable") ||
        lowerProp.includes("subscriber") ||
        lowerProp.includes("restriction")
      ) {
        if (descriptor && descriptor.get) {
          const originalGetter = descriptor.get;
          descriptor.get = function () {
            const result = originalGetter.apply(this);
            if (result === "SUBSCRIBERS") {
              console.log(
                `[Twitch Bypass] Overriding ${prop}: SUBSCRIBERS -> PUBLIC`
              );
              return "PUBLIC";
            }
            if (result === false) {
              return true;
            }
            return result;
          };
        } else if (descriptor && "value" in descriptor) {
          if (descriptor.value === "SUBSCRIBERS") {
            descriptor.value = "PUBLIC";
          } else if (descriptor.value === false) {
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
      console.log("[Twitch Bypass] Page changed, re-checking restrictions");
      setTimeout(() => {
        removeVODRestrictions();
        enableClipButton();
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  console.log("[Twitch Bypass] Script fully loaded - All bypasses active");
})();
