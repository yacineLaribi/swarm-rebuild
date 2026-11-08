// Clicking the toolbar icon (or Alt+Shift+S) injects the swarm into the active tab.
// Injecting again while it is running toggles it off.

// For one screenshot frame, show only the pixels the DOM can't give back
// (WebGL canvases, playing video, cross-origin iframes) so the swarm can crop them cleanly.
const MEDIA_ONLY_CSS = `
html body *:not(canvas):not(video):not(iframe):not(embed):not(object) { visibility: hidden !important; }
html body canvas, html body video, html body iframe, html body embed, html body object { visibility: visible !important; }
`;

// Instant obsidian blank curtain for seamless multi-page transitions.
// Covers the screen completely before page navigation and during initial load/capture
// so the user sees blanks only and never sees the raw un-rebuilt web page flash.
const PLATFORM_BLANK_CSS = `
html::before {
  content: "" !important;
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background-color: #0d0d12 !important;
  z-index: 2147483645 !important;
  pointer-events: none !important;
}
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rebuild(tab) {
  if (!tab || tab.id == null) return;
  const target = { tabId: tab.id };
  let hidden = false;
  try {
    const [probe] = await chrome.scripting.executeScript({
      target,
      func: () => {
        const running = !!(window.__swarmRebuild && window.__swarmRebuild.app);
        let media = false;
        if (!running) {
          for (const el of document.querySelectorAll("canvas, video, iframe, embed, object")) {
            const r = el.getBoundingClientRect();
            if (r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) {
              media = true;
              break;
            }
          }
        }
        return { running, media };
      },
    });
    const { running, media } = probe.result || {};
    if (!running && media) {
      try {
        await chrome.scripting.insertCSS({ target, css: MEDIA_ONLY_CSS });
        hidden = true;
        await sleep(90);
        const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
        await chrome.scripting.executeScript({
          target,
          func: (s) => {
            window.__swarmShot = s;
            window.__swarmHidden = true;
          },
          args: [shot],
        });
      } catch (_) {
        // no screenshot: those regions fall back to placeholders
        if (hidden) {
          await chrome.scripting.removeCSS({ target, css: MEDIA_ONLY_CSS }).catch(() => {});
          hidden = false;
        }
      }
    }
    const pState = platformRebuilds.get(tab.id);
    if (pState && pState.active) {
      await chrome.scripting.executeScript({
        target,
        func: (idx, steps) => {
          window.__swarmPlatformState = {
            stepIndex: idx,
            isPlatformRebuild: true,
            steps: steps,
          };
          if (window.__swarmRebuild && window.__swarmRebuild.app) {
            window.__swarmRebuild.stop(false);
          }
        },
        args: [pState.currentIndex, pState.steps],
      }).catch(() => {});
    }
    await chrome.scripting.executeScript({ target, files: ["swarm.js"] });
  } catch (err) {
    if (hidden) await chrome.scripting.removeCSS({ target, css: MEDIA_ONLY_CSS }).catch(() => {});
    // chrome://, the Web Store, PDFs and other protected pages can't be scripted.
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#F24822" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "×" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Swarm Rebuild can't run on this page" });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: "" });
      chrome.action.setTitle({ tabId: tab.id, title: "Swarm Rebuild (Alt+Shift+S)" });
    }, 2500);
  }
}

chrome.action.onClicked.addListener(rebuild);

async function openStepsGuide(tab) {
  if (!tab || tab.id == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["swarm-steps-guide.js"],
    });
  } catch (err) {
    console.error("[swarm-steps-guide] Failed to inject steps guide:", err);
  }
}

// Active platform rebuilds tracker: tabId -> { steps: [...], currentIndex: 0, active: true }
const platformRebuilds = new Map();

async function injectPlatformWatcher(tabId, stepIndex, steps) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (index, allSteps) => {
        // Remove existing watcher if present
        const existing = document.getElementById("__swarm_platform_hud_host");
        if (existing) existing.remove();

        const current = allSteps[index] || { title: "Page " + (index + 1), path: window.location.pathname };
        const total = allSteps.length;
        const pct = Math.round(((index + 1) / total) * 100);

        const host = document.createElement("div");
        host.id = "__swarm_platform_hud_host";
        host.setAttribute("data-swarm-ignore", "true");
        host.style.cssText = "all: initial; position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; pointer-events: auto;";
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `
          <style>
            .bar {
              display: flex;
              align-items: center;
              gap: 12px;
              background: rgba(13, 14, 18, 0.94);
              border: 1px solid rgba(201, 169, 110, 0.45);
              border-radius: 999px;
              padding: 8px 18px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 24px rgba(201, 169, 110, 0.25);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              color: #fff;
              font-size: 13px;
              user-select: none;
              animation: slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes slideDown {
              from { transform: translateY(-24px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .gem {
              color: #c9a96e;
              font-weight: 900;
              font-size: 15px;
            }
            .tag {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.06em;
              color: #c9a96e;
              text-transform: uppercase;
            }
            .sep {
              width: 1px;
              height: 14px;
              background: rgba(255, 255, 255, 0.18);
            }
            .info {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .step-num {
              background: rgba(201, 169, 110, 0.2);
              color: #c9a96e;
              padding: 2px 7px;
              border-radius: 5px;
              font-size: 11px;
              font-weight: 700;
            }
            .title {
              font-weight: 700;
              color: #fff;
            }
            .path {
              color: #8c909e;
              font-size: 11px;
              font-family: monospace;
            }
            .track {
              width: 80px;
              height: 5px;
              background: rgba(255, 255, 255, 0.12);
              border-radius: 999px;
              overflow: hidden;
            }
            .fill {
              height: 100%;
              background: linear-gradient(90deg, #1abcfe, #c9a96e 50%, #0acf83);
              border-radius: 999px;
              transition: width 0.35s ease;
            }
            .btn {
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.15);
              color: #c9ccd5;
              font-size: 11px;
              font-weight: 600;
              padding: 5px 11px;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.15s ease;
            }
            .btn:hover {
              background: rgba(255, 255, 255, 0.15);
              color: #fff;
              border-color: #c9a96e;
            }
            .btn-cancel:hover {
              background: rgba(242, 78, 30, 0.2);
              color: #ff7262;
              border-color: rgba(242, 78, 30, 0.4);
            }
          </style>
          <div class="bar">
            <span class="gem">✦</span>
            <span class="tag">Platform Rebuild</span>
            <div class="sep"></div>
            <div class="info">
              <span class="step-num">${index + 1}/${total}</span>
              <span class="title" id="hud-title">${current.title}</span>
              <span class="path">(${current.path || ""})</span>
            </div>
            <div class="track">
              <div class="fill" style="width: ${pct}%"></div>
            </div>
            <button class="btn" id="hud-next-btn" title="Skip to next page">Next Page ⏭</button>
            <button class="btn btn-cancel" id="hud-cancel-btn" title="Exit platform rebuild">✕</button>
          </div>
        `;
        (document.body || document.documentElement).appendChild(host);

        const nextBtn = shadow.querySelector("#hud-next-btn");
        const cancelBtn = shadow.querySelector("#hud-cancel-btn");
        const titleEl = shadow.querySelector("#hud-title");

        let advanceFired = false;
        const advance = () => {
          if (advanceFired) return;
          advanceFired = true;
          if (titleEl) titleEl.textContent = `✔ "${current.title}" Rebuilt! Navigating...`;
          chrome.runtime.sendMessage({ type: "swarm:platform_step_complete" });
        };

        nextBtn.addEventListener("click", advance);
        cancelBtn.addEventListener("click", () => {
          advanceFired = true;
          host.remove();
          chrome.runtime.sendMessage({ type: "swarm:cancel_platform_rebuild" });
        });

        // Watch for completion of current page rebuild
        let pollTimer = setInterval(() => {
          if (advanceFired) {
            clearInterval(pollTimer);
            return;
          }
          const app = window.__swarmRebuild && window.__swarmRebuild.app;
          if (app && app.complete) {
            clearInterval(pollTimer);
            if (titleEl) titleEl.textContent = `✔ "${current.title}" Rebuilt! Moving to next...`;
            setTimeout(advance, 1400);
          }
        }, 500);
      },
      args: [stepIndex, steps],
    });
  } catch (err) {
    console.error("[swarm-platform] Failed to inject platform watcher:", err);
  }
}

// Global keyboard commands listener
if (typeof chrome !== "undefined" && chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "open_steps_guide") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) openStepsGuide(tab);
    }
  });
}

// Listen for tab navigation when a platform rebuild is running
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const state = platformRebuilds.get(tabId);
  if (!state || !state.active) return;

  // As soon as the tab starts loading, immediately inject the blanking curtain CSS.
  // This guarantees that from the very first paint, the user sees blanks only
  // and NEVER sees the raw web page refreshing or flashing before the rebuild.
  if (changeInfo.status === "loading") {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        css: PLATFORM_BLANK_CSS,
      });
    } catch (_) {}
    return;
  }

  if (changeInfo.status === "complete") {
    try {
      // Re-ensure curtain covers the page during DOM scanning, fonts, and model capture
      await chrome.scripting.insertCSS({
        target: { tabId },
        css: PLATFORM_BLANK_CSS,
      });
    } catch (_) {}

    // Immediately trigger rebuild under the blank curtain (no raw page exposure)
    await rebuild(tab);
    await injectPlatformWatcher(tabId, state.currentIndex, state.steps);

    // Once swarm-rebuild view mounts and covers the canvas, clean up the curtain CSS
    setTimeout(async () => {
      try {
        await chrome.scripting.removeCSS({
          target: { tabId },
          css: PLATFORM_BLANK_CSS,
        });
      } catch (_) {}
    }, 1500);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  platformRebuilds.delete(tabId);
});

// Runtime messages listener
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Start full platform-wide rebuild sequence
  if (msg && msg.type === "swarm:start_platform_rebuild" && sender.tab) {
    platformRebuilds.set(sender.tab.id, {
      steps: msg.steps,
      currentIndex: 0,
      active: true,
    });
    rebuild(sender.tab).then(() => {
      injectPlatformWatcher(sender.tab.id, 0, msg.steps);
      reply(true);
    });
    return true;
  }

  // Current page rebuild completed in platform flow
  if (msg && msg.type === "swarm:platform_step_complete" && sender.tab) {
    const state = platformRebuilds.get(sender.tab.id);
    if (state && state.active) {
      state.currentIndex++;
      if (state.currentIndex < state.steps.length) {
        const nextStep = state.steps[state.currentIndex];
        const currentUrl = new URL(sender.tab.url);
        let nextUrl;
        try {
          nextUrl = new URL(nextStep.url, currentUrl.href);
        } catch (_) {
          nextUrl = currentUrl;
        }

        // Immediately blank current tab before navigation begins so user never sees
        // unbuilt content while transitioning
        chrome.scripting.insertCSS({
          target: { tabId: sender.tab.id },
          css: PLATFORM_BLANK_CSS,
        }).catch(() => {});

        if (nextUrl.origin === currentUrl.origin && nextUrl.pathname === currentUrl.pathname && nextUrl.hash) {
          // Same page section/hash change
          chrome.tabs.update(sender.tab.id, { url: nextStep.url }).then(async () => {
            // Stop prior swarm instance under the blank curtain
            await chrome.scripting.executeScript({
              target: { tabId: sender.tab.id },
              func: () => {
                if (window.__swarmRebuild && window.__swarmRebuild.app) {
                  window.__swarmRebuild.stop(false);
                }
              },
            }).catch(() => {});
            await rebuild(sender.tab);
            await injectPlatformWatcher(sender.tab.id, state.currentIndex, state.steps);
            setTimeout(async () => {
              await chrome.scripting.removeCSS({
                target: { tabId: sender.tab.id },
                css: PLATFORM_BLANK_CSS,
              }).catch(() => {});
            }, 1500);
            reply(true);
          });
        } else {
          // Full page navigation: chrome.tabs.onUpdated will catch loading and complete
          chrome.tabs.update(sender.tab.id, { url: nextStep.url }).then(() => reply(true));
        }
        return true;
      } else {
        // Entire platform rebuilt!
        platformRebuilds.delete(sender.tab.id);
        chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#0acf83" });
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: "✔" });
        setTimeout(() => {
          chrome.action.setBadgeText({ tabId: sender.tab.id, text: "" });
        }, 5000);
        reply(true);
        return true;
      }
    }
  }

  if (msg && msg.type === "swarm:cancel_platform_rebuild" && sender.tab) {
    platformRebuilds.delete(sender.tab.id);
    reply(true);
    return true;
  }

  if (msg && msg.type === "swarm:launch" && sender.tab) {
    rebuild(sender.tab);
    reply(true);
    return true;
  }

  if (msg && msg.type === "swarm:unhide" && sender.tab) {
    chrome.scripting
      .removeCSS({ target: { tabId: sender.tab.id }, css: MEDIA_ONLY_CSS })
      .catch(() => {})
      .then(() => reply(true));
    return true;
  }
});
