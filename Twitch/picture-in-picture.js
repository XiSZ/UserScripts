// ==UserScript==
// @name        Twitch Picture in Picture
// @match       https://www.twitch.tv/*
// @grant       none
// @version     1.5
// @icon        https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png
// @author      benjammin4dayz
// @homepage    https://github.com/benjammin4dayz/userscripts
// @updateURL   https://raw.githubusercontent.com/benjammin4dayz/userscripts/main/twitch.tv/picture-in-picture.js
// @description Allow Picture in Picture mode to be activated by selecting a button on the top nav bar.
// ==/UserScript==
// @ts-check
(() => {
  const insertPipButton = () => {
    const topNavMenu = document.querySelector(".top-nav__menu");
    if (!topNavMenu) return;

    const insertLocation = topNavMenu.children[0];
    const pipButton = createButton();

    pipButton.onclick = () => {
      const videoPlayer = document.querySelector("video");

      if (!videoPlayer) {
        alert("Couldn't find the video player..");
        return;
      }

      void videoPlayer.requestPictureInPicture();
    };

    pipButton.appendChild(createIcon());
    insertLocation.appendChild(pipButton);

    return true;
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const didInsert = insertPipButton();
        if (didInsert) {
          observer.disconnect();
          break;
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ---
  /** @returns {HTMLButtonElement} a styled button element */
  function createButton() {
    const button = document.createElement("button");
    button.title = "Picture in Picture";

    button.style.height = "30px";
    button.style.margin = "auto 10px";

    button.onmouseenter = () => {
      button.style.transform = "scale(1.2)";
    };
    button.onmouseleave = () => {
      button.style.transform = "scale(1)";
    };

    return button;
  }

  /** @returns {SVGSVGElement} a custom PiP icon */
  function createIcon() {
    const assignAttributes = (element, attributes) => {
      Object.keys(attributes).forEach((attr) =>
        element.setAttribute(attr, attributes[attr])
      );
    };

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    assignAttributes(svg, {
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });

    const rect1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    assignAttributes(rect1, {
      x: "13",
      y: "3",
      width: "8",
      height: "8",
      rx: "2",
      ry: "2",
    });
    svg.appendChild(rect1);

    const rect2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    assignAttributes(rect2, {
      x: "3",
      y: "13",
      width: "10",
      height: "10",
      rx: "2",
      ry: "2",
    });
    svg.appendChild(rect2);

    return svg;
  }
})();
