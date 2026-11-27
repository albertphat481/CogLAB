(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  let isRunning = false;
  let listenersBound = false;

  let currentY = 0;
  let targetY = 0;
  let wheelRafId = null;
  let progRafId = null;

  let progressEl = null;
  let bgStageEl = null;
  let heroCopyEl = null;
  let scrollCueEl = null;
  let zoomTrackEl = null;
  let spotlightEl = null;
  let zoomPillEl = null;
  let previewTiles = [];
  let zoomItems = [];
  let timelineEl = null;
  let navDots = [];
  let sectionTargets = [];

  function collectDom() {
    progressEl = document.getElementById('home-scroll-progress');
    bgStageEl = document.getElementById('home-bg-stage');
    heroCopyEl = document.getElementById('home-hero-copy');
    scrollCueEl = document.getElementById('btn-scroll-down');
    zoomTrackEl = document.getElementById('home-zoom-showcase');
    spotlightEl = document.getElementById('zoom-spotlight-card');
    zoomPillEl = document.getElementById('zoom-phase-pill');
    previewTiles = Array.prototype.slice.call(document.querySelectorAll('.zoom-preview-tile'));
    zoomItems = Array.prototype.slice.call(document.querySelectorAll('#screen-home [data-scroll-zoom]'));
    timelineEl = document.querySelector('.home-timeline-bar');
    navDots = Array.prototype.slice.call(document.querySelectorAll('#home-scroll-nav .scroll-dot-btn'));
    sectionTargets = navDots.map(function (btn) {
      const sel = btn.dataset.target;
      return {
        btn: btn,
        selector: sel,
        el: sel ? document.querySelector(sel) : null
      };
    });
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function getMaxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - global.innerHeight);
  }

  function clampY(y) {
    return Math.max(0, Math.min(getMaxScroll(), y));
  }

  function isOverlayBlocking() {
    if (!document.body.classList.contains('is-home-mode')) return true;
    if (document.body.classList.contains('lab-active')) return true;
    if (document.querySelector('[data-swarm-rebuild]')) return true;
    const modal = document.getElementById('researcher-modal');
    if (modal && !modal.classList.contains('is-hidden')) return true;
    return false;
  }

  function updateHeroDollyZoom(y) {
    const p = clamp01(y / 560);
    const e = easeOutCubic(p);

    if (bgStageEl) {
      const bgScale = 1 + 0.18 * e;
      const bgOpacity = 1 - 0.78 * p;
      bgStageEl.style.transform =
        'translate3d(var(--bg-px, 0px), var(--bg-py, 0px), 0) scale(' + bgScale.toFixed(4) + ')';
      bgStageEl.style.opacity = bgOpacity.toFixed(3);
    }

    if (heroCopyEl) {
      const copyScale = 1 - 0.14 * e;
      const copyY = -(38 * e);
      const copyOpacity = 1 - 0.82 * p;
      heroCopyEl.style.transform =
        'translate3d(0, ' + copyY.toFixed(1) + 'px, 0) scale(' + copyScale.toFixed(4) + ')';
      heroCopyEl.style.opacity = copyOpacity.toFixed(3);
    }

    if (scrollCueEl) {
      const cueP = clamp01(y / 170);
      scrollCueEl.style.opacity = (1 - cueP).toFixed(3);
      scrollCueEl.style.transform = 'translate3d(0, ' + (cueP * 14).toFixed(1) + 'px, 0)';
    }
  }

  function updateSpotlightZoom() {
    if (!zoomTrackEl || !spotlightEl) return;

    const vh = global.innerHeight || 768;
    const rect = zoomTrackEl.getBoundingClientRect();
    const startTop = vh * 0.90;
    const span = Math.max(1, zoomTrackEl.offsetHeight + vh * 0.38);
    const p = clamp01((startTop - rect.top) / span);

    let scale;
    let radius;
    let opacity;
    let tileScale;
    let pillText;

    if (p <= 0.38) {
      const u = easeOutCubic(p / 0.38);
      scale = 0.78 + (1.03 - 0.78) * u;
      radius = 36 - (36 - 20) * u;
      opacity = 0.50 + 0.50 * u;
      tileScale = 0.90 + 0.10 * u;
      pillText = '↗ Đang phóng to • Giao diện Lab';
    } else if (p <= 0.66) {
      scale = 1.03;
      radius = 20;
      opacity = 1.0;
      tileScale = 1.0;
      pillText = '● Tâm điểm • 3 Bài kiểm tra chuẩn';
    } else {
      const u = easeInOutQuad((p - 0.66) / 0.34);
      scale = 1.03 - (1.03 - 0.82) * u;
      radius = 20 + (36 - 20) * u;
      opacity = 1.0 - 0.45 * u;
      tileScale = 1.0 - 0.08 * u;
      pillText = '↘ Đang thu nhỏ • Chuyển phần tiếp';
    }

    spotlightEl.style.transform = 'scale(' + scale.toFixed(4) + ')';
    spotlightEl.style.borderRadius = radius.toFixed(1) + 'px';
    spotlightEl.style.opacity = opacity.toFixed(3);

    for (let i = 0; i < previewTiles.length; i++) {
      previewTiles[i].style.transform = 'scale(' + tileScale.toFixed(4) + ')';
    }

    if (zoomPillEl && zoomPillEl.textContent !== pillText) {
      zoomPillEl.textContent = pillText;
    }
  }

  function updateViewportCenterZoom() {
    const vh = global.innerHeight || 768;
    const focusY = vh * 0.52;
    const range = Math.max(220, vh * 0.72);
    const plateau = 0.36;
    const nearBottom = global.scrollY >= getMaxScroll() - 28;

    for (let i = 0; i < zoomItems.length; i++) {
      const el = zoomItems[i];
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const d = (centerY - focusY) / range;

      let scale = 1;
      let ty = 0;
      let opacity = 1;

      if (!(nearBottom && d > 0 && rect.bottom <= vh + 24)) {
        if (d > plateau) {
          const u = clamp01((d - plateau) / (1 - plateau));
          scale = 1 - 0.16 * u;
          ty = 40 * u;
          opacity = 1 - 0.72 * u;
        } else if (d < -plateau) {
          const u = clamp01((-plateau - d) / (1 - plateau));
          scale = 1 - 0.10 * u;
          ty = -22 * u;
          opacity = 1 - 0.55 * u;
        }
      }

      el.style.transform =
        'translate3d(0, ' + ty.toFixed(1) + 'px, 0) scale(' + scale.toFixed(4) + ')';
      el.style.opacity = opacity.toFixed(3);
    }

    if (timelineEl) {
      const tRect = timelineEl.getBoundingClientRect();
      const inView = tRect.top <= vh * 0.92 && tRect.bottom >= vh * 0.08;
      timelineEl.classList.toggle('is-in-view', inView);
    }
  }

  function updateScrollNavDots() {
    if (!navDots.length) return;
    const vh = global.innerHeight || 768;
    const probeY = vh * 0.42;
    let activeIdx = 0;

    if (global.scrollY < 140) {
      activeIdx = 0;
    } else {
      for (let i = 0; i < sectionTargets.length; i++) {
        const item = sectionTargets[i];
        if (!item.el) continue;
        const rect = item.el.getBoundingClientRect();
        if (rect.top <= probeY) {
          activeIdx = i;
        }
      }
    }

    for (let i = 0; i < navDots.length; i++) {
      navDots[i].classList.toggle('is-active', i === activeIdx);
    }
  }

  function updateScrollVisuals(y) {
    const maxScroll = getMaxScroll();
    if (progressEl) {
      const ratio = maxScroll > 0 ? clamp01(y / maxScroll) : 0;
      progressEl.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    }

    document.body.classList.toggle('home-scrolled', y > 48);

    updateHeroDollyZoom(y);
    updateSpotlightZoom();
    updateViewportCenterZoom();
    updateScrollNavDots();
  }

  function cancelProgrammatic() {
    if (progRafId) {
      global.cancelAnimationFrame(progRafId);
      progRafId = null;
    }
  }

  function cancelWheelLoop() {
    if (wheelRafId) {
      global.cancelAnimationFrame(wheelRafId);
      wheelRafId = null;
    }
  }

  function wheelStep() {
    if (!isRunning || isOverlayBlocking()) {
      cancelWheelLoop();
      return;
    }

    const diff = targetY - currentY;
    if (Math.abs(diff) < 0.45) {
      currentY = targetY;
      global.scrollTo(0, currentY);
      updateScrollVisuals(currentY);
      wheelRafId = null;
      return;
    }

    currentY += diff * 0.095;
    global.scrollTo(0, currentY);
    updateScrollVisuals(currentY);
    wheelRafId = global.requestAnimationFrame(wheelStep);
  }

  function onWheel(e) {
    if (!isRunning || e.ctrlKey || e.metaKey || isOverlayBlocking()) return;
    if (Math.abs(e.deltaY) < 0.5) return;

    e.preventDefault();
    cancelProgrammatic();

    const multiplier = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? global.innerHeight : 1;
    const delta = e.deltaY * multiplier;

    if (!wheelRafId) {
      currentY = global.scrollY;
      targetY = currentY;
    }

    targetY = clampY(targetY + delta);
    if (!wheelRafId) {
      wheelRafId = global.requestAnimationFrame(wheelStep);
    }
  }

  function onNativeScroll() {
    if (!isRunning || isOverlayBlocking()) return;
    const y = global.scrollY;
    if (!wheelRafId && !progRafId) {
      currentY = y;
      targetY = y;
    }
    updateScrollVisuals(y);
  }

  function onResize() {
    if (!isRunning) return;
    targetY = clampY(targetY);
    currentY = clampY(global.scrollY);
    updateScrollVisuals(currentY);
  }

  function onSwarmDone() {
    if (!isRunning) return;
    currentY = global.scrollY;
    targetY = currentY;
    updateScrollVisuals(currentY);
  }

  function scrollToY(destY, durationMs) {
    cancelWheelLoop();
    cancelProgrammatic();

    const startY = global.scrollY;
    const finalY = clampY(destY);
    const distance = finalY - startY;
    const duration = typeof durationMs === 'number' && durationMs > 0 ? durationMs : 880;

    if (Math.abs(distance) < 1) {
      global.scrollTo(0, finalY);
      currentY = finalY;
      targetY = finalY;
      updateScrollVisuals(finalY);
      return;
    }

    const startPerf = performance.now();

    function step(now) {
      if (!isRunning) {
        progRafId = null;
        return;
      }
      const elapsed = now - startPerf;
      const t = Math.min(1, Math.max(0, elapsed / duration));
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const nextY = startY + distance * eased;

      currentY = nextY;
      targetY = nextY;
      global.scrollTo(0, nextY);
      updateScrollVisuals(nextY);

      if (t < 1) {
        progRafId = global.requestAnimationFrame(step);
      } else {
        progRafId = null;
        currentY = finalY;
        targetY = finalY;
        global.scrollTo(0, finalY);
        updateScrollVisuals(finalY);
      }
    }

    progRafId = global.requestAnimationFrame(step);
  }

  function scrollToSpotlightPeak(durationMs) {
    if (!zoomTrackEl) return;
    const vh = global.innerHeight || 768;
    const rect = zoomTrackEl.getBoundingClientRect();
    const docTop = rect.top + global.scrollY;
    const span = zoomTrackEl.offsetHeight + vh * 0.38;
    const destY = docTop - vh * 0.90 + span * 0.52;
    scrollToY(destY, durationMs || 920);
  }

  function scrollToElement(selectorOrEl, durationMs) {
    if (selectorOrEl === '#screen-home') {
      scrollToY(0, durationMs || 880);
      return;
    }
    if (selectorOrEl === '#home-zoom-showcase') {
      scrollToSpotlightPeak(durationMs || 920);
      return;
    }
    const el =
      typeof selectorOrEl === 'string'
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const destY = rect.top + global.scrollY - 36;
    scrollToY(destY, durationMs || 880);
  }

  function attachListeners() {
    if (listenersBound) return;
    listenersBound = true;
    global.addEventListener('wheel', onWheel, { passive: false });
    global.addEventListener('scroll', onNativeScroll, { passive: true });
    global.addEventListener('resize', onResize, { passive: true });
    global.addEventListener('coglab:swarm-done', onSwarmDone);
  }

  function detachListeners() {
    if (!listenersBound) return;
    listenersBound = false;
    global.removeEventListener('wheel', onWheel);
    global.removeEventListener('scroll', onNativeScroll);
    global.removeEventListener('resize', onResize);
    global.removeEventListener('coglab:swarm-done', onSwarmDone);
  }

  function resetInlineStyles() {
    if (progressEl) {
      progressEl.style.transform = 'scaleX(0)';
    }
    if (bgStageEl) {
      bgStageEl.style.transform = '';
      bgStageEl.style.opacity = '';
    }
    if (heroCopyEl) {
      heroCopyEl.style.transform = '';
      heroCopyEl.style.opacity = '';
    }
    if (scrollCueEl) {
      scrollCueEl.style.transform = '';
      scrollCueEl.style.opacity = '';
    }
    if (spotlightEl) {
      spotlightEl.style.transform = '';
      spotlightEl.style.borderRadius = '';
      spotlightEl.style.opacity = '';
    }
    for (let i = 0; i < previewTiles.length; i++) {
      previewTiles[i].style.transform = '';
    }
    for (let i = 0; i < zoomItems.length; i++) {
      zoomItems[i].style.transform = '';
      zoomItems[i].style.opacity = '';
    }
    if (timelineEl) {
      timelineEl.classList.remove('is-in-view');
    }
  }

  function init() {
    collectDom();
  }

  function start() {
    collectDom();
    if (!document.body.classList.contains('is-home-mode') || document.body.classList.contains('lab-active')) {
      return;
    }

    isRunning = true;
    currentY = global.scrollY;
    targetY = currentY;

    if (progressEl) {
      progressEl.classList.remove('is-hidden');
    }

    updateScrollVisuals(currentY);
    attachListeners();
  }

  function stop() {
    isRunning = false;
    cancelWheelLoop();
    cancelProgrammatic();
    detachListeners();
    document.body.classList.remove('home-scrolled');

    if (progressEl) {
      progressEl.classList.add('is-hidden');
    }

    resetInlineStyles();
  }

  CogLab.SmoothScroll = {
    init,
    start,
    stop,
    scrollToY,
    scrollToElement,
    scrollToSpotlightPeak
  };
})(window);
