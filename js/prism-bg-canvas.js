(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  const PALETTE = ['#38BDF8', '#2DD4BF', '#A855F7', '#F472B6', '#FBBF24', '#6366F1'];

  let canvasEl = null;
  let ctx = null;
  let rafId = null;
  let isActive = false;
  let listenersBound = false;
  let dpr = 1;
  let width = 0;
  let height = 0;
  let mouseX = -9999;
  let mouseY = -9999;
  let motes = [];
  let bokehs = [];
  let lastPerf = 0;

  function canRun() {
    if (!isActive) return false;
    if (!document.body.classList.contains('is-home-mode')) return false;
    if (document.body.classList.contains('lab-active')) return false;
    return true;
  }

  function resize() {
    if (!canvasEl) return;
    dpr = Math.min(2, global.devicePixelRatio || 1);
    width = global.innerWidth || 1366;
    height = global.innerHeight || 768;
    canvasEl.width = Math.round(width * dpr);
    canvasEl.height = Math.round(height * dpr);
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function initParticles() {
    motes = [];
    for (let i = 0; i < 36; i++) {
      const rightBias = i % 3 !== 0;
      const x = rightBias ? (0.42 + Math.random() * 0.56) * width : Math.random() * width;
      const y = Math.random() * height;
      motes.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 14,
        vy: -6 - Math.random() * 14,
        r: 1.8 + Math.random() * 3.4,
        color: PALETTE[i % PALETTE.length],
        alpha: 0.14 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        diamond: i % 4 === 0
      });
    }

    bokehs = [];
    for (let j = 0; j < 4; j++) {
      bokehs.push({
        cx: width * (0.58 + j * 0.10),
        cy: height * (0.28 + (j % 2) * 0.34),
        r: 44 + j * 22,
        color: PALETTE[(j * 2) % PALETTE.length],
        phase: j * 1.4,
        speed: 0.35 + j * 0.08
      });
    }
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseLeave() {
    mouseX = -9999;
    mouseY = -9999;
  }

  function drawFrame(now) {
    if (!canRun()) {
      rafId = null;
      return;
    }

    if (document.querySelector('[data-swarm-rebuild]')) {
      lastPerf = now;
      rafId = global.requestAnimationFrame(drawFrame);
      return;
    }

    const dt = Math.min(0.05, Math.max(0.004, (now - (lastPerf || now)) / 1000));
    lastPerf = now;
    const t = now / 1000;

    ctx.clearRect(0, 0, width, height);

    // Subtle translucent iridescent bokeh rings on the right-hand ceramic studio
    for (let j = 0; j < bokehs.length; j++) {
      const b = bokehs[j];
      const bx = b.cx + Math.cos(t * b.speed + b.phase) * 26;
      const by = b.cy + Math.sin(t * b.speed * 0.8 + b.phase) * 18;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.13 + 0.05 * Math.sin(t * 1.1 + b.phase);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // Floating sunlit prism motes & tiny diamond facets
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const dx = m.x - mouseX;
      const dy = m.y - mouseY;
      const dist = Math.hypot(dx, dy);
      if (dist > 1 && dist < 130) {
        const push = ((130 - dist) / 130) * 65 * dt;
        m.x += (dx / dist) * push;
        m.y += (dy / dist) * push;
      }

      m.x += (m.vx + Math.sin(t * 0.9 + m.phase) * 8) * dt;
      m.y += m.vy * dt;

      if (m.y < -16) {
        m.y = height + 14;
        m.x = (m.x < width * 0.35 ? 0.45 : Math.random()) * width;
      }
      if (m.x < -16) m.x = width + 14;
      if (m.x > width + 16) m.x = -14;

      const pulseAlpha = m.alpha * (0.75 + 0.25 * Math.sin(t * 2.1 + m.phase));
      ctx.save();
      ctx.globalAlpha = pulseAlpha;
      ctx.fillStyle = m.color;
      if (m.diamond) {
        ctx.translate(m.x, m.y);
        ctx.rotate(t * 0.6 + m.phase);
        const s = m.r * 1.25;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.78, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.78, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    rafId = global.requestAnimationFrame(drawFrame);
  }

  function bindEvents() {
    if (listenersBound) return;
    listenersBound = true;
    global.addEventListener('resize', resize, { passive: true });
    global.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
  }

  function unbindEvents() {
    if (!listenersBound) return;
    listenersBound = false;
    global.removeEventListener('resize', resize);
    global.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseleave', onMouseLeave);
  }

  function start() {
    canvasEl = document.getElementById('home-prism-canvas');
    if (!canvasEl) return;
    ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    if (!document.body.classList.contains('is-home-mode') || document.body.classList.contains('lab-active')) {
      return;
    }

    isActive = true;
    resize();
    if (!motes.length) initParticles();
    bindEvents();
    lastPerf = performance.now();

    if (!rafId) {
      rafId = global.requestAnimationFrame(drawFrame);
    }
  }

  function stop() {
    isActive = false;
    if (rafId) {
      global.cancelAnimationFrame(rafId);
      rafId = null;
    }
    unbindEvents();
    if (ctx && canvasEl) {
      ctx.clearRect(0, 0, width || canvasEl.width, height || canvasEl.height);
    }
  }

  CogLab.PrismCanvas = {
    start,
    stop
  };
})(window);
