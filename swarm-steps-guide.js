/*
 * Swarm Rebuild — Multi-Page Steps Guide & Blueprint Pre-Flight Engine
 *
 * Scans internal routes across a multi-page site or application, generates
 * an actionable step-by-step rebuild pipeline, and simulates/pre-rebuilds
 * blueprints for each page (measuring DOM depth, typography, media, and agent
 * assignments) before launching the overall Swarm Rebuild animation.
 *
 * Features:
 *  - Automatic internal link & route discovery (nav, header, aside, links)
 *  - Step-by-step verification pipeline (DOM blueprint parsing & complexity scoring)
 *  - Simulated "Pre-Rebuild" wireframe generator with cursor agent assignments
 *  - Procedural Web Audio API soundscape (clicks, scan hums, chimes, launch fanfare)
 *  - Obsidian & Gold glassmorphic HUD hosted in isolated Shadow DOM
 *  - Seamless integration with window.__swarmRebuild and background.js
 *  - Optional multi-page sequential tour state machine (via sessionStorage)
 *
 * Usage:
 *  - Injected via Chrome Extension shortcut (Alt+Shift+G) or background.js
 *  - Or included standalone: <script src="swarm-steps-guide.js"></script>
 *  - Global API: window.__swarmStepsGuide.toggle(), .open(), .runChecks(), .launchOverall()
 */

(() => {
  "use strict";

  const KEY = "__swarmStepsGuide";
  if (window[KEY]) {
    window[KEY].toggle();
    return;
  }

  // ---------------------------------------------------------------- Constants
  const AGENT_NAMES = [
    "Ada", "Linus", "Grace", "Alan", "Margaret", "Ken", "Barbara", "Dennis",
    "Radia", "Guido", "Frances", "Bjarne", "Hedy", "Tim", "Katherine", "Edsger"
  ];

  const AGENT_COLORS = [
    "#c9a96e", "#1ABCFE", "#0ACF83", "#FF7262", "#FFC700",
    "#9747FF", "#E8467C", "#14AE5C", "#0D99FF", "#FF8A00"
  ];

  const STORAGE_TOUR_KEY = "__swarm_multipage_tour";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ------------------------------------------------------------ Sound Engine
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (this.ctx || this.muted) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        if (this.ctx.state === "suspended") {
          const resume = () => {
            this.ctx.resume().catch(() => {});
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("keydown", resume);
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
        }
      }
    }

    playTone(freq, type = "sine", dur = 0.08, gainVal = 0.08) {
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx || this.ctx.state !== "running") return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + dur);
      } catch (_) {}
    }

    click() {
      this.playTone(880, "triangle", 0.04, 0.04);
    }

    scan() {
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx || this.ctx.state !== "running") return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.12);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } catch (_) {}
    }

    stepSuccess() {
      this.playTone(659.25, "sine", 0.08, 0.06); // E5
      setTimeout(() => this.playTone(987.77, "sine", 0.14, 0.08), 60); // B5
    }

    allComplete() {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((f, i) => {
        setTimeout(() => this.playTone(f, "triangle", 0.22, 0.07), i * 85);
      });
    }

    launch() {
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx || this.ctx.state !== "running") return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.35);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
      } catch (_) {}
    }
  }

  // ---------------------------------------------------- Page Discovery Engine
  class DiscoveryEngine {
    static getInternalLinks() {
      const currentOrigin = window.location.origin;
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      const results = [];
      const seen = new Set();

      // Step 1 is always the primary target: current page
      const currentTitle = document.title ? document.title.split(/[-|–•]/)[0].trim() : "Current Page";
      results.push({
        id: "step_0",
        url: window.location.href,
        path: currentPath,
        title: currentTitle || "Overview",
        isCurrent: true,
        status: "pending", // pending | scanning | ready | error
        metrics: null,
        wireframe: null,
      });
      seen.add(currentPath);

      // Inspect document for internal anchors & navigation items
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      const isNavRelated = (el) =>
        !!el.closest("nav, header, aside, [role='navigation'], .nav, .menu, .sidebar");

      // Sort anchors: navigation anchors first
      anchors.sort((a, b) => (isNavRelated(b) ? 1 : 0) - (isNavRelated(a) ? 1 : 0));

      for (const a of anchors) {
        try {
          const rawHref = a.getAttribute("href") || "";
          if (rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
            continue;
          }

          let label = (a.textContent || "").trim();
          const inNav = isNavRelated(a);

          let resolvedUrl = "";
          let normPath = "";

          if (rawHref === "#" || rawHref === "") {
            // In nav/aside and has a distinct title (e.g. Overview, Projects, Agents in demo.html)
            if (inNav && label && label.length > 1 && label.length < 30) {
              const slug = label.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
              normPath = `#${slug}`;
              resolvedUrl = `${window.location.origin}${window.location.pathname}#${slug}`;
            } else {
              continue;
            }
          } else if (rawHref.startsWith("#/") || rawHref.startsWith("#!/")) {
            // SPA hash route
            normPath = rawHref;
            resolvedUrl = `${window.location.origin}${window.location.pathname}${rawHref}`;
          } else if (rawHref.startsWith("#")) {
            // Section anchor
            if (inNav && label && label.length > 1) {
              normPath = rawHref;
              resolvedUrl = `${window.location.origin}${window.location.pathname}${rawHref}`;
            } else {
              continue;
            }
          } else {
            const resolved = new URL(rawHref, window.location.href);
            if (resolved.origin !== currentOrigin) continue;

            // Disregard binary/media file downloads
            if (/\.(pdf|zip|tar|gz|dmg|exe|png|jpg|jpeg|gif|svg|mp4|webm|webp)$/i.test(resolved.pathname)) {
              continue;
            }

            normPath = resolved.pathname.replace(/\/+$/, "") || "/";
            if (resolved.search) normPath += resolved.search;
            resolvedUrl = resolved.href;
          }

          if (seen.has(normPath)) continue;
          seen.add(normPath);

          if (!label || label.length > 40) {
            label = normPath.split("/").filter(Boolean).pop() || "Page";
            label = label.replace(/^[#?]+/, "");
            label = label.charAt(0).toUpperCase() + label.slice(1);
          }

          results.push({
            id: `step_${results.length}`,
            url: resolvedUrl,
            path: normPath,
            title: label,
            isCurrent: false,
            status: "pending",
            metrics: null,
            wireframe: null,
          });

          // Limit automatic auto-discovery to top 8 distinct routes
          if (results.length >= 8) break;
        } catch (_) {}
      }

      return results;
    }
  }

  // -------------------------------------------------- Blueprint Pre-Rebuilder
  class BlueprintSimulator {
    /**
     * Inspects a live document or parsed DOM tree and computes a reconstructed blueprint.
     */
    static inspectDOM(doc, isLive = false) {
      const root = isLive ? doc.body || doc.documentElement : doc.body || doc.documentElement;
      if (!root) {
        return {
          nodeCount: 0,
          textBlocks: 0,
          mediaCount: 0,
          interactiveCount: 0,
          bentoCount: 0,
          estAgents: 8,
          estDuration: "4.5s",
          score: 80,
          wireframe: { hero: true, cards: 3, textLines: 4, hasMedia: false },
        };
      }

      const allNodes = root.querySelectorAll("*");
      const nodeCount = allNodes.length;

      const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const paragraphs = root.querySelectorAll("p, blockquote, li, dt, dd, span");
      const textBlocks = headings.length + paragraphs.length;

      const media = root.querySelectorAll("canvas, video, img, svg, iframe, embed, object");
      const mediaCount = media.length;

      const interactive = root.querySelectorAll("button, input, select, textarea, [role='button'], a");
      const interactiveCount = interactive.length;

      const bentoItems = root.querySelectorAll(".bento-item, .bento-grid > *, .card, .grid > *");
      const bentoCount = bentoItems.length;

      // Calculate estimated agent cursors & time to rebuild
      const estAgents = Math.min(48, Math.max(8, Math.round(nodeCount / 18) + (mediaCount * 2)));
      const estSeconds = Math.max(3.2, Math.min(22, (nodeCount * 0.025 + textBlocks * 0.04).toFixed(1)));

      // Generate wireframe layout model for blueprint preview
      const cards = Math.min(6, Math.max(2, bentoCount || Math.round(nodeCount / 60)));
      const textLines = Math.min(8, Math.max(3, Math.round(textBlocks / 10)));
      const hasMedia = mediaCount > 0;

      // Assign flock agents to blueprint layers
      const assigned = [];
      const shuffledNames = [...AGENT_NAMES].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(6, estAgents); i++) {
        assigned.push({
          name: shuffledNames[i % shuffledNames.length],
          color: AGENT_COLORS[i % AGENT_COLORS.length],
          role: i === 0 ? "Hero Typographer" : i === 1 ? "Bounding Layout" : i === 2 ? "Media Isolator" : "Grid Builder",
        });
      }

      return {
        nodeCount,
        textBlocks,
        mediaCount,
        interactiveCount,
        bentoCount,
        estAgents,
        estDuration: `${estSeconds}s`,
        score: Math.min(100, Math.round(85 + (nodeCount > 50 ? 10 : 0) + (mediaCount > 0 ? 5 : 0))),
        assigned,
        wireframe: {
          hero: headings.length > 0,
          cards,
          textLines,
          hasMedia,
          hasBento: bentoCount > 0,
        },
      };
    }

    /**
     * Executes the check and "supposed rebuild" of a step page.
     */
    static async checkAndRebuildStep(step) {
      if (step.isCurrent) {
        await sleep(350);
        const metrics = BlueprintSimulator.inspectDOM(document, true);
        return {
          ...step,
          status: "ready",
          title: document.title ? document.title.split(/[-|–•]/)[0].trim() : step.title,
          metrics,
        };
      }

      // If it's a section anchor / hash route on current page
      if (step.path && step.path.startsWith("#")) {
        await sleep(300);
        const targetId = step.path.slice(1);
        const section = document.getElementById(targetId) || document.querySelector(`[name="${targetId}"]`);
        const fullMetrics = BlueprintSimulator.inspectDOM(document, true);
        const subMetrics = section ? BlueprintSimulator.inspectDOM(section, true) : fullMetrics;
        return {
          ...step,
          status: "ready",
          metrics: {
            ...subMetrics,
            nodeCount: section ? subMetrics.nodeCount : Math.max(45, Math.round(fullMetrics.nodeCount * 0.4)),
            textBlocks: section ? subMetrics.textBlocks : Math.max(10, Math.round(fullMetrics.textBlocks * 0.35)),
            estAgents: Math.max(8, Math.min(24, Math.round(fullMetrics.estAgents * 0.6))),
          },
        };
      }

      // External / Secondary page on same origin
      try {
        const resp = await fetch(step.url, { credentials: "same-origin" });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let parsedTitle = doc.title ? doc.title.split(/[-|–•]/)[0].trim() : "";
        if (!parsedTitle) {
          const h1 = doc.querySelector("h1");
          if (h1 && h1.textContent.trim()) parsedTitle = h1.textContent.trim().slice(0, 32);
        }

        const metrics = BlueprintSimulator.inspectDOM(doc, false);
        return {
          ...step,
          status: "ready",
          title: parsedTitle || step.title,
          metrics,
        };
      } catch (err) {
        // Fallback simulated blueprint if local file:// restrictions or fetch fails
        await sleep(400);
        const fallbackMetrics = {
          nodeCount: 185 + Math.floor(Math.random() * 120),
          textBlocks: 32 + Math.floor(Math.random() * 20),
          mediaCount: 4 + Math.floor(Math.random() * 6),
          interactiveCount: 12 + Math.floor(Math.random() * 8),
          bentoCount: 3,
          estAgents: 16,
          estDuration: "6.8s",
          score: 92,
          isSimulatedFallback: true,
          assigned: [
            { name: "Ada", color: "#c9a96e", role: "Layout Architect" },
            { name: "Linus", color: "#1ABCFE", role: "Component Snapper" },
            { name: "Grace", color: "#0ACF83", role: "Vector Synthesizer" }
          ],
          wireframe: { hero: true, cards: 3, textLines: 4, hasMedia: true, hasBento: true },
        };
        return {
          ...step,
          status: "ready",
          metrics: fallbackMetrics,
        };
      }
    }
  }

  // ----------------------------------------------------- Steps Guide View UI
  class StepsGuideView {
    constructor(controller) {
      this.controller = controller;
      this.sfx = controller.sfx;
      this.host = null;
      this.root = null;
      this.expandedWireframes = new Set();
      this.buildDOM();
    }

    buildDOM() {
      const host = document.createElement("swarm-steps-guide");
      host.id = "__swarm_steps_guide_host";
      host.setAttribute("data-swarm-ignore", "true");
      const shadow = host.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = `
        :host {
          all: initial;
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SF Mono", monospace;
          color: #f0f0f5;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .backdrop {
          position: absolute;
          inset: 0;
          background: rgba(5, 6, 8, 0.72);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        .window {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -48%) scale(0.96);
          width: 92vw;
          max-width: 820px;
          max-height: 88vh;
          background: rgba(13, 14, 18, 0.95);
          border: 1px solid rgba(201, 169, 110, 0.3);
          border-radius: 16px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(201, 169, 110, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }

        .window.open {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
          pointer-events: auto;
        }

        /* Tour Floating Pill */
        .tour-toast {
          position: fixed;
          top: 20px;
          right: 24px;
          background: rgba(13, 14, 18, 0.95);
          border: 1px solid #c9a96e;
          border-radius: 40px;
          padding: 8px 18px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 24px rgba(201, 169, 110, 0.25);
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: #fff;
          z-index: 2147483647;
          pointer-events: auto;
          transition: transform 0.2s ease, opacity 0.2s ease;
          opacity: 0;
          transform: translateY(-10px);
        }

        .tour-toast.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .tour-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0acf83;
          box-shadow: 0 0 8px #0acf83;
          animation: pulse 1.2s infinite ease-in-out;
        }

        .tour-action-btn {
          background: linear-gradient(135deg, #c9a96e 0%, #a88448 100%);
          color: #0b0c10;
          border: 0;
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .tour-action-btn:hover {
          transform: scale(1.05);
        }

        .tour-cancel-btn {
          background: transparent;
          color: #8c909e;
          border: 0;
          cursor: pointer;
          font-size: 11px;
        }

        .tour-cancel-btn:hover {
          color: #ff7262;
        }

        /* Top Header Bar */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 22px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(201, 169, 110, 0.08) 0%, rgba(201, 169, 110, 0.01) 100%);
        }

        .header-title-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-gem {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, #c9a96e 0%, #826839 100%);
          display: grid;
          place-items: center;
          color: #0d0d12;
          font-weight: 900;
          font-size: 17px;
          box-shadow: 0 4px 12px rgba(201, 169, 110, 0.35);
        }

        .title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: #fff;
          text-transform: uppercase;
        }

        .subtitle {
          font-size: 11px;
          color: #c9a96e;
          letter-spacing: 0.05em;
          margin-top: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .icon-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #b0b4be;
          border-radius: 8px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          border-color: rgba(201, 169, 110, 0.5);
        }

        /* Overview Stat Ribbon */
        .ribbon {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          padding: 14px 22px;
          background: rgba(0, 0, 0, 0.35);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .stat-card {
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8c909e;
        }

        .stat-value {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          margin-top: 3px;
          font-feature-settings: "tnum";
        }

        .stat-value.accent {
          color: #c9a96e;
        }

        /* Content List */
        .content {
          padding: 18px 22px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Step Card */
        .step-card {
          background: rgba(20, 22, 28, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 14px 16px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .step-card:hover {
          border-color: rgba(201, 169, 110, 0.3);
          background: rgba(25, 28, 36, 0.85);
        }

        .step-card.active {
          border-color: #c9a96e;
          box-shadow: 0 0 16px rgba(201, 169, 110, 0.15);
        }

        .step-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .step-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .step-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(201, 169, 110, 0.15);
          color: #c9a96e;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .step-badge.current {
          background: rgba(26, 188, 254, 0.15);
          color: #1abcfe;
          border: 1px solid rgba(26, 188, 254, 0.3);
        }

        .step-title-wrap {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .step-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .step-path {
          font-size: 11px;
          color: #7b808e;
          font-family: monospace;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .step-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          letter-spacing: 0.03em;
        }

        .status-pending {
          background: rgba(255, 255, 255, 0.05);
          color: #8c909e;
        }

        .status-scanning {
          background: rgba(26, 188, 254, 0.15);
          color: #1abcfe;
          border: 1px solid rgba(26, 188, 254, 0.3);
          animation: pulse 1.2s infinite ease-in-out;
        }

        .status-ready {
          background: rgba(10, 207, 131, 0.15);
          color: #0acf83;
          border: 1px solid rgba(10, 207, 131, 0.3);
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        /* Step Metrics Chips */
        .step-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .chip {
          font-size: 10px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.04);
          color: #c9ccd5;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .chip b {
          color: #fff;
        }

        .chip.accent {
          background: rgba(201, 169, 110, 0.12);
          color: #c9a96e;
        }

        /* Step Actions & Wireframe Button */
        .step-tools {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 10px;
        }

        .tool-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #b0b4be;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s ease;
        }

        .tool-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-color: rgba(201, 169, 110, 0.4);
        }

        .tool-btn.danger:hover {
          background: rgba(242, 78, 30, 0.15);
          color: #ff7262;
          border-color: rgba(242, 78, 30, 0.4);
        }

        /* Blueprint Wireframe Drawer */
        .wireframe-box {
          margin-top: 12px;
          padding: 12px;
          border-radius: 8px;
          background: rgba(8, 9, 12, 0.85);
          border: 1px dashed rgba(201, 169, 110, 0.3);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .wireframe-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          color: #c9a96e;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .mock-page-canvas {
          height: 120px;
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          position: relative;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow: hidden;
        }

        .mock-nav {
          height: 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          width: 100%;
        }

        .mock-hero {
          height: 28px;
          background: rgba(201, 169, 110, 0.18);
          border: 1px solid rgba(201, 169, 110, 0.35);
          border-radius: 4px;
          display: flex;
          align-items: center;
          padding-left: 8px;
          gap: 6px;
        }

        .mock-cursor-pill {
          font-size: 8px;
          font-weight: 700;
          color: #fff;
          padding: 1px 5px;
          border-radius: 3px;
          background: #c9a96e;
          color: #000;
        }

        .mock-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          flex: 1;
        }

        .mock-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }

        .flock-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .flock-badge {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .flock-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        /* Add Step Section */
        .add-row {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }

        .add-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 14px;
          color: #fff;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .add-input:focus {
          border-color: #c9a96e;
        }

        .add-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 0 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-btn:hover {
          background: rgba(201, 169, 110, 0.2);
          border-color: #c9a96e;
        }

        /* Footer Toolbar */
        .footer {
          padding: 16px 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(8, 9, 12, 0.95);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #b0b4be;
          cursor: pointer;
          user-select: none;
        }

        .checkbox-label input {
          cursor: pointer;
          accent-color: #c9a96e;
        }

        .primary-btn-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-check-all {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
        }

        .btn-check-all:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(201, 169, 110, 0.5);
        }

        .btn-launch-overall {
          background: linear-gradient(135deg, #c9a96e 0%, #a88448 100%);
          border: 0;
          color: #0b0c10;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          padding: 10px 22px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(201, 169, 110, 0.35);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-launch-overall:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(201, 169, 110, 0.5);
          filter: brightness(1.08);
        }

        .btn-launch-overall:active {
          transform: translateY(0);
        }

        /* Progress Bar */
        .progress-track {
          height: 3px;
          background: rgba(255, 255, 255, 0.06);
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1abcfe, #c9a96e 50%, #0acf83);
          width: 0%;
          transition: width 0.3s ease;
        }
      `;

      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div class="tour-toast" id="sg-tour-toast">
          <div class="tour-pulse-dot"></div>
          <span id="sg-tour-toast-text">Tour Active</span>
          <button class="tour-action-btn" id="sg-tour-toast-action">Next →</button>
          <button class="tour-cancel-btn" id="sg-tour-toast-cancel" title="Exit Tour">✕</button>
        </div>
        <div class="backdrop"></div>
        <div class="window" role="dialog" aria-modal="true" aria-labelledby="sg-title">
          <div class="progress-track"><div class="progress-fill" id="sg-progress"></div></div>
          
          <header class="header">
            <div class="header-title-box">
              <div class="logo-gem">✦</div>
              <div>
                <h1 class="title" id="sg-title">Swarm Rebuild // Steps Guide</h1>
                <p class="subtitle"><span id="sg-status-text">Multi-Page Discovery & Pre-Flight Blueprint</span></p>
              </div>
            </div>
            <div class="header-actions">
              <button class="icon-btn" id="sg-mute-btn" title="Toggle Sound (M)">🔊</button>
              <button class="icon-btn" id="sg-close-btn" title="Close Guide (Esc)">✕</button>
            </div>
          </header>

          <div class="ribbon">
            <div class="stat-card">
              <div class="stat-label">Total Steps</div>
              <div class="stat-value" id="sg-stat-steps">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Verified Nodes</div>
              <div class="stat-value" id="sg-stat-nodes">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Typography</div>
              <div class="stat-value" id="sg-stat-text">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Swarm Flock</div>
              <div class="stat-value accent" id="sg-stat-agents">--</div>
            </div>
          </div>

          <main class="content" id="sg-steps-list">
            <!-- Dynamic step cards populated here -->
          </main>

          <div style="padding: 0 22px 14px 22px;">
            <div class="add-row">
              <input type="text" class="add-input" id="sg-new-path" placeholder="Add custom route or internal URL (e.g. /about, /projects, /contact)..." />
              <button class="add-btn" id="sg-add-btn">+ Add Step</button>
            </div>
          </div>

          <footer class="footer">
            <div class="footer-left">
              <label class="checkbox-label">
                <input type="checkbox" id="sg-auto-tour-toggle" checked />
                <span>Auto-build pages sequentially</span>
              </label>
            </div>
            <div class="primary-btn-group">
              <button class="btn-check-all" id="sg-check-all-btn">
                <span>▶</span> Check & Pre-Rebuild All
              </button>
              <button class="btn-launch-overall" id="sg-launch-btn">
                <span>✦</span> Build Entire Platform from Scratch
              </button>
            </div>
          </footer>
        </div>
      `;

      shadow.appendChild(style);
      shadow.appendChild(wrapper);

      this.host = host;
      this.root = shadow;
      this.bindEvents();
    }

    mount() {
      if (!document.body.contains(this.host)) {
        document.body.appendChild(this.host);
      }
    }

    bindEvents() {
      const q = (sel) => this.root.querySelector(sel);

      q("#sg-close-btn").addEventListener("click", () => this.controller.close());
      q(".backdrop").addEventListener("click", () => this.controller.close());

      q("#sg-mute-btn").addEventListener("click", () => {
        this.sfx.muted = !this.sfx.muted;
        q("#sg-mute-btn").textContent = this.sfx.muted ? "🔇" : "🔊";
      });

      q("#sg-add-btn").addEventListener("click", () => this.handleAddRoute());
      q("#sg-new-path").addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.handleAddRoute();
      });

      q("#sg-check-all-btn").addEventListener("click", () => {
        this.sfx.click();
        this.controller.runChecks();
      });

      q("#sg-launch-btn").addEventListener("click", () => {
        this.sfx.launch();
        this.controller.launchOverall();
      });
    }

    handleAddRoute() {
      const input = this.root.querySelector("#sg-new-path");
      const val = (input.value || "").trim();
      if (!val) return;
      this.controller.addStep(val);
      input.value = "";
      this.sfx.click();
    }

    renderSteps(steps) {
      const list = this.root.querySelector("#sg-steps-list");
      list.innerHTML = "";

      let totalNodes = 0;
      let totalText = 0;
      let maxAgents = 0;
      let readyCount = 0;

      steps.forEach((step, idx) => {
        const card = document.createElement("div");
        card.className = `step-card ${step.isCurrent ? "active" : ""}`;
        card.id = `card-${step.id}`;

        let statusClass = "status-pending";
        let statusText = "● Pending Check";
        if (step.status === "scanning") {
          statusClass = "status-scanning";
          statusText = "⟳ Rebuilding Blueprint...";
        } else if (step.status === "ready") {
          statusClass = "status-ready";
          statusText = "✔ Blueprint Rebuilt";
          readyCount++;
        }

        const m = step.metrics;
        if (m) {
          totalNodes += m.nodeCount || 0;
          totalText += m.textBlocks || 0;
          if (m.estAgents > maxAgents) maxAgents = m.estAgents;
        }

        const isExpanded = this.expandedWireframes.has(step.id);

        card.innerHTML = `
          <div class="step-header">
            <div class="step-info">
              <span class="step-badge ${step.isCurrent ? "current" : ""}">
                ${step.isCurrent ? "TARGET 01" : `STEP ${String(idx + 1).padStart(2, "0")}`}
              </span>
              <div class="step-title-wrap">
                <span class="step-name">${this.escapeHTML(step.title || "Page")}</span>
                <span class="step-path">${this.escapeHTML(step.path)}</span>
              </div>
            </div>

            <div style="display:flex; align-items:center;">
              <span class="step-status ${statusClass}">${statusText}</span>
              <div class="step-tools">
                ${m ? `<button class="tool-btn" data-action="toggle-wireframe" data-id="${step.id}">${isExpanded ? "Hide Wireframe" : "📐 Blueprint"}</button>` : ""}
                <button class="tool-btn" data-action="check-single" data-id="${step.id}" title="Re-check this step">↻</button>
                ${!step.isCurrent ? `<button class="tool-btn danger" data-action="remove-step" data-id="${step.id}" title="Remove step">✕</button>` : ""}
              </div>
            </div>
          </div>

          ${
            m
              ? `
            <div class="step-chips">
              <span class="chip">Nodes: <b>${m.nodeCount}</b></span>
              <span class="chip">Typography: <b>${m.textBlocks}</b></span>
              <span class="chip">Media: <b>${m.mediaCount}</b></span>
              <span class="chip accent">Agents: <b>${m.estAgents}</b></span>
              <span class="chip">Est. Time: <b>${m.estDuration}</b></span>
              ${m.isSimulatedFallback ? `<span class="chip" style="color:#ff8a00;">Simulation Mock</span>` : ""}
            </div>
          `
              : ""
          }

          ${
            m && isExpanded
              ? `
            <div class="wireframe-box">
              <div class="wireframe-header">
                <span>📐 Reconstructed Blueprint Wireframe</span>
                <span>${m.nodeCount} DOM Nodes Parsed</span>
              </div>
              <div class="mock-page-canvas">
                <div class="mock-nav"></div>
                ${m.wireframe.hero ? `<div class="mock-hero"><span class="mock-cursor-pill">Typewriter Hero</span></div>` : ""}
                <div class="mock-grid">
                  ${Array.from({ length: m.wireframe.cards }).map(() => `<div class="mock-card"></div>`).join("")}
                </div>
              </div>
              <div class="flock-tags">
                ${(m.assigned || []).map((a) => `
                  <span class="flock-badge">
                    <span class="flock-dot" style="background:${a.color}"></span>
                    <b>${a.name}</b> (${a.role})
                  </span>
                `).join("")}
              </div>
            </div>
          `
              : ""
          }
        `;

        // Bind card actions
        card.querySelectorAll("[data-action]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const action = btn.getAttribute("data-action");
            const stepId = btn.getAttribute("data-id");
            if (action === "toggle-wireframe") {
              if (this.expandedWireframes.has(stepId)) this.expandedWireframes.delete(stepId);
              else this.expandedWireframes.add(stepId);
              this.renderSteps(this.controller.steps);
            } else if (action === "check-single") {
              this.controller.checkStepById(stepId);
            } else if (action === "remove-step") {
              this.controller.removeStep(stepId);
            }
          });
        });

        list.appendChild(card);
      });

      // Update Ribbon Stats
      this.root.querySelector("#sg-stat-steps").textContent = steps.length;
      this.root.querySelector("#sg-stat-nodes").textContent = totalNodes;
      this.root.querySelector("#sg-stat-text").textContent = totalText;
      this.root.querySelector("#sg-stat-agents").textContent = maxAgents ? `${maxAgents} Cursors` : "--";

      // Update Progress Track
      const pct = steps.length > 0 ? Math.round((readyCount / steps.length) * 100) : 0;
      this.root.querySelector("#sg-progress").style.width = `${pct}%`;
      this.root.querySelector("#sg-status-text").textContent =
        readyCount === steps.length && steps.length > 0
          ? `All ${steps.length} Steps Verified & Rebuilt Blueprint Ready`
          : `Step Verification: ${readyCount} / ${steps.length} Ready`;
    }

    show() {
      this.mount();
      this.root.querySelector(".backdrop").classList.add("open");
      this.root.querySelector(".window").classList.add("open");
    }

    hide() {
      this.root.querySelector(".backdrop").classList.remove("open");
      this.root.querySelector(".window").classList.remove("open");
    }

    showTourToast({ text, actionLabel, onAction, onCancel }) {
      this.mount();
      const toast = this.root.querySelector("#sg-tour-toast");
      const txt = this.root.querySelector("#sg-tour-toast-text");
      const act = this.root.querySelector("#sg-tour-toast-action");
      const cancel = this.root.querySelector("#sg-tour-toast-cancel");

      if (txt) txt.textContent = text;
      if (act) {
        act.textContent = actionLabel || "Next Page →";
        act.onclick = () => { if (onAction) onAction(); };
      }
      if (cancel) {
        cancel.onclick = () => { if (onCancel) onCancel(); };
      }

      if (toast) toast.classList.add("visible");
    }

    hideTourToast() {
      const toast = this.root.querySelector("#sg-tour-toast");
      if (toast) toast.classList.remove("visible");
    }

    updateTourToastText(text) {
      const txt = this.root.querySelector("#sg-tour-toast-text");
      if (txt) txt.textContent = text;
    }

    escapeHTML(str) {
      return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }
  }

  // ------------------------------------------------ Main Orchestrator Guide
  class SwarmStepsGuideController {
    constructor() {
      this.sfx = new SoundEngine();
      this.steps = [];
      this.view = new StepsGuideView(this);
      this.isOpen = false;
      this.running = false;
      this.init();
    }

    init() {
      this.steps = DiscoveryEngine.getInternalLinks();
      this.view.renderSteps(this.steps);

      // Check if resuming a multi-page tour from sessionStorage
      this.checkTourResume();

      // Keyboard shortcut listener: Alt+Shift+G toggles guide, Esc closes
      window.addEventListener("keydown", (e) => {
        if (e.altKey && e.shiftKey && (e.key === "G" || e.key === "g")) {
          e.preventDefault();
          this.toggle();
        } else if (e.key === "Escape" && this.isOpen) {
          this.close();
        } else if ((e.key === "m" || e.key === "M") && this.isOpen && !e.target.matches("input")) {
          this.sfx.muted = !this.sfx.muted;
          const muteBtn = this.view.root.querySelector("#sg-mute-btn");
          if (muteBtn) muteBtn.textContent = this.sfx.muted ? "🔇" : "🔊";
        }
      });
    }

    open() {
      this.isOpen = true;
      this.view.show();
      this.sfx.init();
      this.sfx.click();
      this.view.renderSteps(this.steps);
    }

    close() {
      this.isOpen = false;
      this.view.hide();
    }

    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    }

    addStep(rawUrl) {
      try {
        const resolved = new URL(rawUrl, window.location.href);
        const normPath = resolved.pathname.replace(/\/+$/, "") || "/";
        let label = normPath.split("/").filter(Boolean).pop() || "Custom Step";
        label = label.charAt(0).toUpperCase() + label.slice(1);

        this.steps.push({
          id: `step_${Date.now()}`,
          url: resolved.href,
          path: normPath,
          title: label,
          isCurrent: resolved.href === window.location.href,
          status: "pending",
          metrics: null,
          wireframe: null,
        });

        this.view.renderSteps(this.steps);
      } catch (_) {
        alert("Please enter a valid internal URL or route path (e.g. /about).");
      }
    }

    removeStep(stepId) {
      this.steps = this.steps.filter((s) => s.id !== stepId);
      this.view.renderSteps(this.steps);
      this.sfx.click();
    }

    async checkStepById(stepId) {
      const step = this.steps.find((s) => s.id === stepId);
      if (!step) return;
      step.status = "scanning";
      this.view.renderSteps(this.steps);
      this.sfx.scan();

      const updated = await BlueprintSimulator.checkAndRebuildStep(step);
      Object.assign(step, updated);
      this.sfx.stepSuccess();
      this.view.renderSteps(this.steps);
    }

    async runChecks() {
      if (this.running) return;
      this.running = true;

      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        step.status = "scanning";
        this.view.renderSteps(this.steps);
        this.sfx.scan();

        const updated = await BlueprintSimulator.checkAndRebuildStep(step);
        Object.assign(step, updated);
        this.sfx.stepSuccess();
        this.view.renderSteps(this.steps);
        await sleep(220);
      }

      this.running = false;
      this.sfx.allComplete();
    }

    /**
     * Seamlessly launches the overall Swarm Rebuild across all pages.
     */
    async launchOverall() {
      // If checks haven't run yet, run them fast first
      const hasPending = this.steps.some((s) => s.status !== "ready");
      if (hasPending) {
        await this.runChecks();
      }

      // Store the Multi-Page Blueprint Audit Dossier on window for Swarm Rebuild
      window.__swarmMultiPageDossier = {
        steps: this.steps,
        timestamp: Date.now(),
        origin: window.location.origin,
      };

      const stepsPayload = this.steps.map((s) => ({
        url: s.url,
        title: s.title,
        path: s.path,
        isCurrent: s.isCurrent,
      }));

      this.close();

      // Check if running in Chrome Extension environment with active background service worker
      const hasChromeBg =
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.sendMessage &&
        Boolean(chrome.runtime.id);

      if (hasChromeBg) {
        chrome.runtime.sendMessage({
          type: "swarm:start_platform_rebuild",
          steps: stepsPayload,
        });
      } else {
        // Standalone browser / local demo sequential platform rebuild
        this.runStandalonePlatformRebuild(stepsPayload);
      }
    }

    /**
     * Standalone fallback: sequentially rebuilds all pages/sections right in the browser.
     */
    async runStandalonePlatformRebuild(stepsPayload) {
      if (!stepsPayload || stepsPayload.length === 0) return;

      // Ensure swarm.js is loaded dynamically if not present
      if (!window.__swarmRebuild) {
        const s = document.createElement("script");
        s.src = "swarm.js";
        document.head.appendChild(s);
        await new Promise((resolve) => {
          let count = 0;
          const check = setInterval(() => {
            count++;
            if (window.__swarmRebuild && window.__swarmRebuild.app) {
              clearInterval(check);
              resolve();
            } else if (count > 40) {
              clearInterval(check);
              resolve();
            }
          }, 100);
        });
      }

      // Instant obsidian blank curtain helper: guarantees user sees blanks only
      // between pages/sections, with all captures and setup finished before rebuild.
      const showBlankCurtain = () => {
        let curtain = document.getElementById("__swarm_blank_curtain");
        if (!curtain) {
          curtain = document.createElement("div");
          curtain.id = "__swarm_blank_curtain";
          curtain.setAttribute("data-swarm-ignore", "true");
          curtain.style.cssText =
            "all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; background: #0d0d12; z-index: 2147483645; pointer-events: none; transition: opacity 0.25s ease;";
          (document.body || document.documentElement).appendChild(curtain);
        }
        curtain.style.opacity = "1";
        curtain.style.display = "block";
      };

      const hideBlankCurtain = () => {
        const curtain = document.getElementById("__swarm_blank_curtain");
        if (curtain) {
          curtain.style.opacity = "0";
          setTimeout(() => {
            if (curtain && curtain.style.opacity === "0") {
              curtain.style.display = "none";
            }
          }, 250);
        }
      };

      const renderHud = (idx, step, total) => {
        let host = document.getElementById("__swarm_platform_hud_host");
        if (!host) {
          host = document.createElement("div");
          host.id = "__swarm_platform_hud_host";
          host.setAttribute("data-swarm-ignore", "true");
          host.style.cssText =
            "all: initial; position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; pointer-events: auto;";
          document.body.appendChild(host);
        }
        const pct = Math.round(((idx + 1) / total) * 100);
        host.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;background:rgba(13,14,18,0.95);border:1px solid rgba(201,169,110,0.5);border-radius:999px;padding:8px 18px;box-shadow:0 10px 30px rgba(0,0,0,0.75),0 0 20px rgba(201,169,110,0.25);color:#fff;font-size:13px;backdrop-filter:blur(16px);">
            <span style="color:#c9a96e;font-weight:900;">✦</span>
            <span style="font-size:11px;font-weight:700;color:#c9a96e;letter-spacing:0.05em;text-transform:uppercase;">Platform Rebuild</span>
            <div style="width:1px;height:14px;background:rgba(255,255,255,0.2);"></div>
            <span style="background:rgba(201,169,110,0.2);color:#c9a96e;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;">${idx + 1}/${total}</span>
            <span style="font-weight:700;" id="__phud_title">${step.title}</span>
            <span style="color:#8c909e;font-size:11px;font-family:monospace;">(${step.path || ""})</span>
            <div style="width:70px;height:5px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#1abcfe,#c9a96e 50%,#0acf83);border-radius:999px;transition:width 0.3s ease;"></div>
            </div>
            <button id="__phud_next" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;">Next ⏭</button>
            <button id="__phud_stop" style="background:rgba(242,78,30,0.15);border:1px solid rgba(242,78,30,0.3);color:#ff7262;font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;cursor:pointer;">✕</button>
          </div>
        `;
        return host;
      };

      let cancelled = false;

      for (let i = 0; i < stepsPayload.length; i++) {
        if (cancelled) break;
        const step = stepsPayload[i];

        // On transitions between steps, blank the canvas immediately before switching content
        if (i > 0) {
          showBlankCurtain();
        }

        const host = renderHud(i, step, stepsPayload.length);

        let skipStep = false;
        const nextBtn = host.querySelector("#__phud_next");
        const stopBtn = host.querySelector("#__phud_stop");
        if (nextBtn) {
          nextBtn.onclick = () => {
            showBlankCurtain();
            skipStep = true;
          };
        }
        if (stopBtn) {
          stopBtn.onclick = () => {
            cancelled = true;
            hideBlankCurtain();
            host.remove();
            if (window.__swarmRebuild && window.__swarmRebuild.app) window.__swarmRebuild.stop(true);
          };
        }

        // Switch to the target section behind the curtain
        if (step.path && step.path.startsWith("#")) {
          try {
            const targetEl = document.querySelector(step.path);
            if (targetEl) targetEl.scrollIntoView({ behavior: "instant", block: "start" });
          } catch (_) {}
        }

        // Synchronize sidebar active link
        try {
          const navLinks = document.querySelectorAll("aside a, nav a");
          navLinks.forEach((l) => {
            const h = l.getAttribute("href");
            if (h === step.path || (!step.path && (h === "#" || h === "/"))) l.classList.add("on");
            else l.classList.remove("on");
          });
        } catch (_) {}

        // Trigger Swarm Rebuild on this section with step index context
        window.__swarmPlatformState = {
          stepIndex: i,
          isPlatformRebuild: true,
        };

        if (window.__swarmRebuild) {
          // Stop previous swarm under curtain
          if (window.__swarmRebuild.app) window.__swarmRebuild.stop(false);
          await sleep(150);
          if (window.__swarmRebuild.start) window.__swarmRebuild.start();
        }

        // Fade out blank curtain once swarm view has mounted its canvas and is ready
        setTimeout(() => {
          hideBlankCurtain();
        }, 800);

        // Poll for completion or user skipping
        await new Promise((resolve) => {
          const checkTimer = setInterval(() => {
            if (cancelled || skipStep) {
              clearInterval(checkTimer);
              resolve();
              return;
            }
            const app = window.__swarmRebuild && window.__swarmRebuild.app;
            if (!app && !skipStep) {
              cancelled = true;
              clearInterval(checkTimer);
              resolve();
              return;
            }
            if (app && app.complete) {
              clearInterval(checkTimer);
              const titleEl = host.querySelector("#__phud_title");
              if (titleEl) titleEl.textContent = `✔ "${step.title}" Rebuilt! Next page...`;
              setTimeout(resolve, 1200);
            }
          }, 350);
        });

        if (cancelled) break;
        this.sfx.stepSuccess();
      }

      hideBlankCurtain();

      if (!cancelled) {
        this.sfx.allComplete();
        const host = document.getElementById("__swarm_platform_hud_host");
        if (host) {
          host.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;background:rgba(13,14,18,0.96);border:1px solid #0acf83;border-radius:999px;padding:9px 22px;box-shadow:0 10px 30px rgba(0,0,0,0.8),0 0 24px rgba(10,207,131,0.3);color:#fff;font-size:13px;">
              <span style="color:#0acf83;font-weight:900;">✔</span>
              <span style="font-weight:700;">Entire Platform Rebuilt from Scratch! All ${stepsPayload.length} Pages Complete.</span>
              <button onclick="this.parentElement.parentElement.remove()" style="background:transparent;border:0;color:#8c909e;cursor:pointer;font-size:12px;">✕</button>
            </div>
          `;
          setTimeout(() => host && host.remove(), 6000);
        }
      }
    }

    checkTourResume() {
      try {
        const raw = sessionStorage.getItem(STORAGE_TOUR_KEY);
        if (!raw) return;
        const tour = JSON.parse(raw);
        if (tour && tour.active) {
          this.view.showTourToast({
            text: `✦ Tour Step ${tour.currentIndex + 1}/${tour.routes.length}: Auto-rebuilding page...`,
            actionLabel: "Skip Page →",
            onAction: () => this.handleTourPageComplete(tour),
            onCancel: () => {
              sessionStorage.removeItem(STORAGE_TOUR_KEY);
              this.view.hideTourToast();
            },
          });

          // Launch swarm rebuild on this newly navigated tour page
          setTimeout(() => {
            if (window.__swarmRebuild && typeof window.__swarmRebuild.start === "function") {
              window.__swarmRebuild.start();
            } else if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: "swarm:launch" });
            }
          }, 800);

          this.monitorTour();
        }
      } catch (_) {}
    }

    monitorTour() {
      if (this.tourInterval) clearInterval(this.tourInterval);
      this.tourAdvancing = false;
      this.tourInterval = setInterval(() => {
        try {
          const raw = sessionStorage.getItem(STORAGE_TOUR_KEY);
          if (!raw) {
            clearInterval(this.tourInterval);
            return;
          }
          const tour = JSON.parse(raw);
          if (!tour || !tour.active) {
            clearInterval(this.tourInterval);
            return;
          }

          const app = window.__swarmRebuild && window.__swarmRebuild.app;
          if (app && app.complete && !this.tourAdvancing) {
            this.tourAdvancing = true;
            clearInterval(this.tourInterval);
            this.handleTourPageComplete(tour);
          }
        } catch (_) {}
      }, 700);
    }

    handleTourPageComplete(tour) {
      const nextIdx = tour.currentIndex + 1;
      const total = tour.routes.length;
      if (nextIdx < total) {
        const nextUrl = tour.routes[nextIdx];
        let countdown = 4;
        this.sfx.stepSuccess();
        const updateText = () => {
          this.view.updateTourToastText(`✔ Step ${tour.currentIndex + 1}/${total} Rebuilt! Next: ${nextUrl} in ${countdown}s...`);
        };
        updateText();

        const timer = setInterval(() => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(timer);
            tour.currentIndex = nextIdx;
            sessionStorage.setItem(STORAGE_TOUR_KEY, JSON.stringify(tour));
            window.location.href = nextUrl;
          } else {
            updateText();
          }
        }, 1000);

        this.view.showTourToast({
          text: `✔ Step ${tour.currentIndex + 1}/${total} Rebuilt! Next: ${nextUrl} in ${countdown}s...`,
          actionLabel: "Next Now →",
          onAction: () => {
            clearInterval(timer);
            tour.currentIndex = nextIdx;
            sessionStorage.setItem(STORAGE_TOUR_KEY, JSON.stringify(tour));
            window.location.href = nextUrl;
          },
          onCancel: () => {
            clearInterval(timer);
            sessionStorage.removeItem(STORAGE_TOUR_KEY);
            this.view.hideTourToast();
          },
        });
      } else {
        sessionStorage.removeItem(STORAGE_TOUR_KEY);
        this.sfx.allComplete();
        this.view.showTourToast({
          text: `✦ Multi-Page Swarm Tour Complete! All ${total} pages reconstructed.`,
          actionLabel: "Done",
          onAction: () => this.view.hideTourToast(),
          onCancel: () => this.view.hideTourToast(),
        });
        setTimeout(() => this.view.hideTourToast(), 6000);
      }
    }
  }

  // Instantiate and expose on window
  const guide = new SwarmStepsGuideController();
  window[KEY] = {
    open: () => guide.open(),
    close: () => guide.close(),
    toggle: () => guide.toggle(),
    runChecks: () => guide.runChecks(),
    launchOverall: () => guide.launchOverall(),
    addStep: (url) => guide.addStep(url),
    get steps() {
      return guide.steps;
    },
    get dossier() {
      return window.__swarmMultiPageDossier;
    },
  };

  // Open the guide on first execution
  guide.open();
})();
