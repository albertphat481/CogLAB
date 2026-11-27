(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  const NBACK_STREAM = ['A', 'K', 'A', 'M', 'A', 'T', 'M', 'T', 'B', 'P', 'B'];
  const GNG_CYCLE = [true, true, false, true, true, false, true];
  const STROOP_KEY_MAP = { d: 'RED', f: 'GREEN', j: 'BLUE', k: 'YELLOW' };

  let isActive = false;
  let rafId = null;
  let observer = null;
  let listenersBound = false;

  // Parallax state
  let bgStageEl = null;
  let targetPx = 0;
  let targetPy = 0;
  let curPx = 0;
  let curPy = 0;

  // Stroop micro-demo state
  let stroopWordEl = null;
  let stroopStatusEl = null;
  let stroopBtns = [];
  let stroopExpectedId = 'BLUE';
  let stroopWordText = 'ĐỎ';
  let stroopStartPerf = 0;
  let stroopResetAt = 0;
  let stroopLocked = false;

  // Go/No-Go micro-demo state
  let gngVisualEl = null;
  let gngBtnEl = null;
  let gngStatusEl = null;
  let gngStep = 0;
  let gngIsGo = true;
  let gngStartPerf = 0;
  let gngLastStepPerf = 0;
  let gngResponded = false;

  // 2-Back micro-demo state
  let nbackSeqEl = null;
  let nbackBtnEl = null;
  let nbackStatusEl = null;
  let nbackIdx = 2;
  let nbackLastStepPerf = 0;
  let nbackResponded = false;

  // Best RT & Refresh rate diagnostics
  let bestRtEl = null;
  let bestDemoRtMs = null;
  let heroHzEl = null;
  let diagHzEl = null;
  let diagFrameEl = null;
  let diagSessionsEl = null;
  let hzMeasured = false;
  let hzLastPerf = 0;
  let hzDeltas = [];

  // Count-up stats state
  let statsStripEl = null;
  let countEls = [];
  let countStarted = false;
  let countStartPerf = 0;

  function canAnimateHome() {
    if (!isActive) return false;
    if (!document.body.classList.contains('is-home-mode')) return false;
    if (document.body.classList.contains('lab-active')) return false;
    return true;
  }

  function isOverlayOpen() {
    if (document.querySelector('[data-swarm-rebuild]')) return true;
    const modal = document.getElementById('researcher-modal');
    return Boolean(modal && !modal.classList.contains('is-hidden'));
  }

  function collectDom() {
    bgStageEl = document.getElementById('home-bg-stage');
    stroopWordEl = document.getElementById('demo-stroop-word');
    stroopStatusEl = document.getElementById('demo-stroop-status');
    stroopBtns = Array.prototype.slice.call(document.querySelectorAll('.zpt-stroop-btn'));
    gngVisualEl = document.getElementById('demo-gng-visual');
    gngBtnEl = document.getElementById('demo-gng-btn');
    gngStatusEl = document.getElementById('demo-gng-status');
    nbackSeqEl = document.getElementById('demo-nback-seq');
    nbackBtnEl = document.getElementById('demo-nback-btn');
    nbackStatusEl = document.getElementById('demo-nback-status');
    bestRtEl = document.getElementById('demo-best-rt');
    heroHzEl = document.getElementById('hero-hz-val');
    diagHzEl = document.getElementById('diag-hz');
    diagFrameEl = document.getElementById('diag-frame-ms');
    diagSessionsEl = document.getElementById('diag-sessions');
    statsStripEl = document.getElementById('home-stats-strip');
    countEls = Array.prototype.slice.call(document.querySelectorAll('#home-stats-strip [data-count-to]'));
  }

  function refreshDiagnostics() {
    if (!diagSessionsEl || !diagHzEl || !heroHzEl) collectDom();
    if (diagSessionsEl && CogLab.Storage) {
      const count = CogLab.Storage.loadSessions().length;
      diagSessionsEl.textContent = count + ' phiên đã lưu';
    }
    if (!hzMeasured && !rafId && canAnimateHome()) {
      rafId = global.requestAnimationFrame(tick);
    }
  }

  function recordBestRt(rtMs) {
    if (typeof rtMs !== 'number' || !Number.isFinite(rtMs) || rtMs <= 0) return;
    if (bestDemoRtMs === null || rtMs < bestDemoRtMs) {
      bestDemoRtMs = rtMs;
      if (bestRtEl) {
        bestRtEl.textContent = '⚡ Kỷ lục thử nhanh: ' + rtMs + ' ms';
      }
    }
  }

  function sampleDisplayHz(now) {
    if (hzMeasured) return;
    if (hzLastPerf > 0) {
      const dtMs = now - hzLastPerf;
      if (dtMs >= 2 && dtMs <= 250) {
        hzDeltas.push(dtMs);
      }
    }
    hzLastPerf = now;

    if (hzDeltas.length >= 6) {
      if (!diagHzEl || !diagFrameEl || !heroHzEl) collectDom();
      const sorted = hzDeltas.slice().sort(function (a, b) { return a - b; });
      const mid = sorted[Math.floor(sorted.length / 2)] || 16.67;
      const rawHz = 1000 / mid;
      const stdRates = [60, 75, 90, 120, 144, 165, 240];
      let displayHz = Math.round(rawHz);
      for (let i = 0; i < stdRates.length; i++) {
        if (Math.abs(rawHz - stdRates[i]) <= 4.5) {
          displayHz = stdRates[i];
          break;
        }
      }
      const frameMs = mid.toFixed(1) + ' ms';
      if (heroHzEl) heroHzEl.textContent = displayHz + ' Hz';
      if (diagHzEl) diagHzEl.textContent = displayHz + ' Hz';
      if (diagFrameEl) diagFrameEl.textContent = frameMs;
      if (hzDeltas.length >= 24) {
        hzMeasured = true;
      }
    }
  }

  function setStatusText(el, text, cls) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('is-ok', 'is-err');
    if (cls) el.classList.add(cls);
  }

  function pickNextStroop(initial) {
    const colors = (CogLab.Config && CogLab.Config.STROOP_COLORS) || [];
    if (colors.length < 2 || !stroopWordEl) return;

    if (initial) {
      stroopExpectedId = 'BLUE';
      stroopWordText = 'ĐỎ';
      stroopWordEl.textContent = 'ĐỎ';
      stroopWordEl.style.color = '#2563EB';
      stroopStartPerf = performance.now();
      stroopLocked = false;
      setStatusText(stroopStatusEl, 'Bấm D / F / J / K hoặc chạm nút', null);
      return;
    }

    let wordObj = colors[Math.floor(Math.random() * colors.length)];
    let inkObj = colors[Math.floor(Math.random() * colors.length)];
    if (wordObj.id === inkObj.id) {
      const idx = (colors.indexOf(inkObj) + 1) % colors.length;
      inkObj = colors[idx];
    }
    if (wordObj.label === stroopWordText && inkObj.id === stroopExpectedId) {
      const idx2 = (colors.indexOf(inkObj) + 2) % colors.length;
      inkObj = colors[idx2];
    }

    stroopWordText = wordObj.label;
    stroopExpectedId = inkObj.id;
    stroopWordEl.textContent = wordObj.label;
    stroopWordEl.style.color = inkObj.hex;
    stroopStartPerf = performance.now();
    stroopLocked = false;
    setStatusText(stroopStatusEl, 'Bấm D / F / J / K hoặc chạm nút', null);
  }

  function handleStroopChoice(chosenId) {
    if (!canAnimateHome() || stroopLocked || !chosenId) return;
    const rt = Math.max(1, Math.round(performance.now() - stroopStartPerf));
    const colors = (CogLab.Config && CogLab.Config.STROOP_COLORS) || [];
    const expected = colors.find(function (c) { return c.id === stroopExpectedId; });

    stroopLocked = true;
    stroopResetAt = performance.now() + 900;

    if (chosenId === stroopExpectedId) {
      recordBestRt(rt);
      setStatusText(stroopStatusEl, '✓ ' + rt + ' ms • Đúng màu mực!', 'is-ok');
    } else {
      setStatusText(
        stroopStatusEl,
        '✕ Sai • Đúng là ' + (expected ? expected.keyLabel + ' (' + expected.label + ')' : ''),
        'is-err'
      );
    }
  }

  function onStroopClick(e) {
    handleStroopChoice(e.currentTarget.dataset.color);
  }

  function onKeyDown(e) {
    if (!canAnimateHome() || isOverlayOpen() || !isSpotlightVisible()) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = String(e.key || '').toLowerCase();
    if (STROOP_KEY_MAP[k]) {
      handleStroopChoice(STROOP_KEY_MAP[k]);
    }
  }

  function renderGngVisual() {
    if (!gngVisualEl) return;
    gngVisualEl.innerHTML = gngIsGo
      ? '<span class="zpt-circle" aria-label="Tín hiệu Go xanh lá"></span>'
      : '<span class="zpt-cross" aria-label="Tín hiệu No-Go chữ X đỏ">✕</span>';
  }

  function advanceGng(now) {
    gngStep = (gngStep + 1) % GNG_CYCLE.length;
    gngIsGo = GNG_CYCLE[gngStep];
    gngStartPerf = now;
    gngLastStepPerf = now;
    gngResponded = false;
    renderGngVisual();
    setStatusText(gngStatusEl, gngIsGo ? 'Thấy hình tròn → Bấm!' : 'Thấy chữ ✕ → Đứng yên!', null);
  }

  function onGngClick() {
    if (!canAnimateHome()) return;
    const rt = Math.max(1, Math.round(performance.now() - gngStartPerf));
    gngResponded = true;
    if (gngIsGo) {
      recordBestRt(rt);
      setStatusText(gngStatusEl, '✓ ' + rt + ' ms • Phản xạ Go!', 'is-ok');
    } else {
      setStatusText(gngStatusEl, '✕ Đừng bấm khi thấy chữ ✕!', 'is-err');
    }
  }

  function renderNbackSeq() {
    if (!nbackSeqEl) return;
    const len = NBACK_STREAM.length;
    const a = NBACK_STREAM[(nbackIdx - 2 + len) % len];
    const b = NBACK_STREAM[(nbackIdx - 1 + len) % len];
    const c = NBACK_STREAM[nbackIdx % len];
    const isHit = a === c;
    nbackSeqEl.innerHTML =
      a + ' → ' + b + ' → <strong class="' + (isHit ? 'is-hit' : '') + '">' + c + '</strong>';
  }

  function advanceNback(now) {
    nbackIdx = (nbackIdx + 1) % NBACK_STREAM.length;
    nbackLastStepPerf = now;
    nbackResponded = false;
    renderNbackSeq();
    setStatusText(nbackStatusEl, 'ISI 1500 ms • Chỉ số d\'', null);
  }

  function onNbackClick() {
    if (!canAnimateHome()) return;
    const len = NBACK_STREAM.length;
    const prev2 = NBACK_STREAM[(nbackIdx - 2 + len) % len];
    const curr = NBACK_STREAM[nbackIdx % len];
    nbackResponded = true;
    if (curr === prev2) {
      setStatusText(nbackStatusEl, '✓ Khớp! "' + curr + '" lặp sau 2 bước', 'is-ok');
    } else {
      setStatusText(nbackStatusEl, '✕ "' + curr + '" khác "' + prev2 + '" (2 bước trước)', 'is-err');
    }
  }

  function onMouseMove(e) {
    if (!canAnimateHome() || isOverlayOpen()) return;
    const w = global.innerWidth || 1366;
    const h = global.innerHeight || 768;
    const nx = (e.clientX / w - 0.5) * 2;
    const ny = (e.clientY / h - 0.5) * 2;
    targetPx = -nx * 14;
    targetPy = -ny * 10;
  }

  function triggerCountUp(now) {
    if (countStarted) return;
    countStarted = true;
    countStartPerf = now;
  }

  function updateCountUp(now) {
    if (!countStarted || !countEls.length) return;
    const elapsed = now - countStartPerf;
    const t = Math.min(1, Math.max(0, elapsed / 920));
    const eased = 1 - Math.pow(1 - t, 3);

    for (let i = 0; i < countEls.length; i++) {
      const el = countEls[i];
      const goal = Number(el.dataset.countTo || 0);
      const suffix = el.dataset.suffix || '';
      const val = Math.round(goal * eased);
      el.textContent = val + suffix;
    }
  }

  function isSpotlightVisible() {
    const card = document.getElementById('zoom-spotlight-card');
    if (!card) return false;
    const rect = card.getBoundingClientRect();
    const vh = global.innerHeight || 768;
    return rect.bottom > 40 && rect.top < vh - 40;
  }

  function tick(now) {
    if (!canAnimateHome()) {
      rafId = null;
      return;
    }

    sampleDisplayHz(now);

    // Mouse parallax smooth lerp
    if (bgStageEl) {
      curPx += (targetPx - curPx) * 0.08;
      curPy += (targetPy - curPy) * 0.08;
      bgStageEl.style.setProperty('--bg-px', curPx.toFixed(2) + 'px');
      bgStageEl.style.setProperty('--bg-py', curPy.toFixed(2) + 'px');
    }

    // Stroop auto-next after feedback delay
    if (stroopLocked && now >= stroopResetAt) {
      pickNextStroop(false);
    }

    // Live Go/No-Go & 2-Back ticks while spotlight is visible
    if (!isOverlayOpen() && isSpotlightVisible()) {
      if (now - gngLastStepPerf >= (gngResponded ? 1300 : 2200)) {
        advanceGng(now);
      }
      if (now - nbackLastStepPerf >= (nbackResponded ? 1400 : 1950)) {
        advanceNback(now);
      }
    }

    // Fallback check for count-up stats strip visibility
    if (!countStarted && statsStripEl) {
      const sr = statsStripEl.getBoundingClientRect();
      if (sr.top <= (global.innerHeight || 768) * 0.94) {
        triggerCountUp(now);
      }
    }
    updateCountUp(now);

    rafId = global.requestAnimationFrame(tick);
  }

  function bindEvents() {
    if (listenersBound) return;
    listenersBound = true;
    global.addEventListener('mousemove', onMouseMove, { passive: true });
    global.addEventListener('keydown', onKeyDown);
    for (let i = 0; i < stroopBtns.length; i++) {
      stroopBtns[i].addEventListener('click', onStroopClick);
    }
    if (gngBtnEl) gngBtnEl.addEventListener('click', onGngClick);
    if (nbackBtnEl) nbackBtnEl.addEventListener('click', onNbackClick);
  }

  function unbindEvents() {
    if (!listenersBound) return;
    listenersBound = false;
    global.removeEventListener('mousemove', onMouseMove);
    global.removeEventListener('keydown', onKeyDown);
    for (let i = 0; i < stroopBtns.length; i++) {
      stroopBtns[i].removeEventListener('click', onStroopClick);
    }
    if (gngBtnEl) gngBtnEl.removeEventListener('click', onGngClick);
    if (nbackBtnEl) nbackBtnEl.removeEventListener('click', onNbackClick);
  }

  function setupObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (typeof IntersectionObserver !== 'function' || !statsStripEl) return;
    observer = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          triggerCountUp(performance.now());
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          break;
        }
      }
    }, { threshold: 0.25 });
    observer.observe(statsStripEl);
  }

  function start() {
    collectDom();
    if (!document.body.classList.contains('is-home-mode') || document.body.classList.contains('lab-active')) {
      return;
    }

    stop();
    isActive = true;
    collectDom();

    const now = performance.now();
    targetPx = 0;
    targetPy = 0;
    curPx = 0;
    curPy = 0;
    gngStep = 0;
    gngIsGo = GNG_CYCLE[0];
    gngLastStepPerf = now;
    gngStartPerf = now;
    gngResponded = false;
    nbackIdx = 2;
    nbackLastStepPerf = now;
    nbackResponded = false;
    countStarted = false;
    hzMeasured = false;
    hzLastPerf = 0;
    hzDeltas = [];

    pickNextStroop(true);
    renderGngVisual();
    setStatusText(gngStatusEl, 'Thấy hình tròn → Bấm!', null);
    renderNbackSeq();
    setStatusText(nbackStatusEl, 'ISI 1500 ms • Chỉ số d\'', null);
    refreshDiagnostics();

    bindEvents();
    setupObserver();

    if (!rafId) {
      rafId = global.requestAnimationFrame(tick);
    }
  }

  function stop() {
    isActive = false;
    if (rafId) {
      global.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    unbindEvents();
    if (bgStageEl) {
      bgStageEl.style.setProperty('--bg-px', '0px');
      bgStageEl.style.setProperty('--bg-py', '0px');
    }
  }

  CogLab.HomeInteractive = {
    start,
    stop,
    refreshDiagnostics
  };
})(window);
