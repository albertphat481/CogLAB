(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  let activeCleanup = null;

  function cleanup() {
    if (typeof activeCleanup === 'function') {
      activeCleanup();
      activeCleanup = null;
    }
  }

  function wrapCanvasText(ctx, text, x, maxWidth, startY, lineHeight) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let current = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = current ? current + ' ' + words[i] : words[i];
      if (ctx.measureText(testLine).width > maxWidth && current) {
        lines.push(current);
        current = words[i];
      } else {
        current = testLine;
      }
    }
    if (current) lines.push(current);

    let y = startY;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y);
      y += lineHeight;
    }
    return y;
  }

  function drawBeatVisual(ctx, visualType, w, centerY, tSec, accent) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;

    if (visualType === 'orbit') {
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, centerY, 68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, centerY, 42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(w / 2, centerY, 16, 0, Math.PI * 2);
      ctx.fill();

      const x1 = w / 2 + Math.cos(tSec * 2.4) * 68;
      const y1 = centerY + Math.sin(tSec * 2.4) * 68;
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(x1, y1, 8, 0, Math.PI * 2);
      ctx.fill();

      const x2 = w / 2 + Math.cos(-tSec * 3.6) * 42;
      const y2 = centerY + Math.sin(-tSec * 3.6) * 42;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x2, y2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (visualType === 'bars') {
      const count = 9;
      const gap = 14;
      const barW = 10;
      const startX = w / 2 - ((count - 1) * gap) / 2 - barW / 2;
      for (let i = 0; i < count; i++) {
        const h = 24 + Math.abs(Math.sin(tSec * 4.5 + i * 0.65)) * 78;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(startX + i * gap, centerY + 48 - h, barW, h);
      }
    } else if (visualType === 'ring') {
      for (let r = 0; r < 3; r++) {
        const phase = ((tSec * 0.9 + r * 0.33) % 1);
        const radius = 16 + phase * 68;
        ctx.globalAlpha = (1 - phase) * 0.75;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(w / 2, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(w / 2, centerY, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (visualType === 'optical') {
      ctx.translate(w / 2, centerY);
      ctx.rotate(tSec * 1.1);
      for (let i = 0; i < 16; i++) {
        ctx.rotate((Math.PI * 2) / 16);
        ctx.globalAlpha = i % 2 === 0 ? 0.85 : 0.25;
        ctx.fillStyle = i % 2 === 0 ? accent : '#F8FAFC';
        ctx.fillRect(22, -4, 48, 8);
      }
    } else if (visualType === 'burst') {
      ctx.translate(w / 2, centerY);
      const spikes = 12;
      for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2 + tSec * 1.4;
        const len = 36 + Math.sin(tSec * 6 + i) * 24;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
        ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        ctx.stroke();
      }
    } else if (visualType === 'counter') {
      const pulse = 1 + Math.sin(tSec * 5) * 0.08;
      ctx.translate(w / 2, centerY);
      ctx.scale(pulse, pulse);
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 54, -Math.PI / 2, -Math.PI / 2 + ((tSec * 1.7) % 1) * Math.PI * 2);
      ctx.stroke();
    } else {
      // pulse / spark default
      const r = 38 + Math.sin(tSec * 5.2) * 14;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(w / 2, centerY, r + 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(w / 2, centerY, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function mountGroup1Feed(stageEl, settings, stateRef) {
    const Utils = CogLab.Utils;
    const clips = CogLab.Content.BUILTIN_SHORT_CLIPS;
    const sourceType = settings.videoSourceType || 'BUILTIN';

    let currentIdx = 0;
    let clipStartPerf = performance.now();
    let wheelCooldownUntil = 0;

    function buildBuiltinHtml() {
      return (
        '<div class="iv-video-layout">' +
        '<div class="iv-phone-frame" id="iv-phone-frame">' +
        '<canvas id="iv-shorts-canvas" width="360" height="640"></canvas>' +
        '<div class="iv-video-overlay-top">' +
        '<span class="iv-live-pill">VIDEO NGẮN • TỰ ĐỘNG CHUYỂN</span>' +
        '<span class="iv-clip-badge" id="iv-clip-counter">1 / ' + clips.length + '</span>' +
        '</div>' +
        '<div class="iv-video-overlay-right">' +
        '<div class="iv-social-stat"><span class="iv-social-icon">♥</span><span id="iv-likes-count"></span></div>' +
        '<div class="iv-social-stat"><span class="iv-social-icon">💬</span><span id="iv-comments-count"></span></div>' +
        '<div class="iv-social-stat"><span class="iv-social-icon">↻</span><span>Chia sẻ</span></div>' +
        '</div>' +
        '<div class="iv-video-overlay-bottom">' +
        '<div class="iv-clip-handle" id="iv-clip-handle"></div>' +
        '<div class="iv-clip-title" id="iv-clip-title"></div>' +
        '<div class="iv-clip-tags" id="iv-clip-tags"></div>' +
        '</div>' +
        '</div>' +
        '<div class="iv-swipe-rail">' +
        '<button type="button" class="btn btn-secondary iv-swipe-btn" id="iv-prev-clip" title="Clip trước (Mũi tên lên)">▲ Clip trước</button>' +
        '<div class="iv-swipe-stat">' +
        '<span class="iv-swipe-num" id="iv-switch-count">0</span>' +
        '<span class="iv-swipe-lbl">Lượt chuyển clip</span>' +
        '</div>' +
        '<button type="button" class="btn btn-primary iv-swipe-btn" id="iv-next-clip" title="Lướt clip mới (Mũi tên xuống)">▼ Lướt tiếp</button>' +
        '<p class="iv-swipe-tip">Bạn có thể cuộn chuột, bấm phím ↑/↓ hoặc nhấn nút để lướt video liên tục.</p>' +
        '</div>' +
        '</div>'
      );
    }

    function buildExternalFeedHtml(list, kind) {
      if (!list || list.length === 0) {
        return null;
      }
      const mediaHtml =
        kind === 'YOUTUBE'
          ? '<iframe id="iv-yt-frame" class="iv-external-media" allow="autoplay; encrypted-media" allowfullscreen></iframe>'
          : '<video id="iv-mp4-player" class="iv-external-media" autoplay muted playsinline loop controls></video>';

      return (
        '<div class="iv-video-layout">' +
        '<div class="iv-phone-frame" id="iv-phone-frame">' +
        mediaHtml +
        '<div class="iv-video-overlay-top">' +
        '<span class="iv-live-pill">' + (kind === 'YOUTUBE' ? 'YOUTUBE SHORTS' : 'VIDEO NGẮN') + '</span>' +
        '<span class="iv-clip-badge" id="iv-clip-counter">1 / ' + list.length + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="iv-swipe-rail">' +
        '<button type="button" class="btn btn-secondary iv-swipe-btn" id="iv-prev-clip">▲ Clip trước</button>' +
        '<div class="iv-swipe-stat">' +
        '<span class="iv-swipe-num" id="iv-switch-count">0</span>' +
        '<span class="iv-swipe-lbl">Lượt chuyển clip</span>' +
        '</div>' +
        '<button type="button" class="btn btn-primary iv-swipe-btn" id="iv-next-clip">▼ Lướt tiếp</button>' +
        '<p class="iv-swipe-tip">Sử dụng nút hoặc phím ↑/↓ để chuyển sang clip tiếp theo.</p>' +
        '</div>' +
        '</div>'
      );
    }

    let useExternalKind = null;
    let externalList = [];
    if (sourceType === 'YOUTUBE' && Array.isArray(settings.youtubeIds) && settings.youtubeIds.length > 0) {
      useExternalKind = 'YOUTUBE';
      externalList = settings.youtubeIds;
    } else if (sourceType === 'MP4' && Array.isArray(settings.customVideoUrls) && settings.customVideoUrls.length > 0) {
      useExternalKind = 'MP4';
      externalList = settings.customVideoUrls;
    }

    if (useExternalKind) {
      stageEl.innerHTML = buildExternalFeedHtml(externalList, useExternalKind);
    } else {
      stageEl.innerHTML = buildBuiltinHtml();
    }

    const totalCount = useExternalKind ? externalList.length : clips.length;
    const counterEl = stageEl.querySelector('#iv-clip-counter');
    const switchEl = stageEl.querySelector('#iv-switch-count');
    const prevBtn = stageEl.querySelector('#iv-prev-clip');
    const nextBtn = stageEl.querySelector('#iv-next-clip');
    const phoneFrame = stageEl.querySelector('#iv-phone-frame');

    function syncExternalMedia() {
      if (counterEl) counterEl.textContent = (currentIdx + 1) + ' / ' + totalCount;
      if (switchEl) switchEl.textContent = String(stateRef.clipSwitches);
      if (useExternalKind === 'YOUTUBE') {
        const frame = stageEl.querySelector('#iv-yt-frame');
        const id = externalList[currentIdx];
        if (frame) {
          frame.src =
            'https://www.youtube.com/embed/' +
            encodeURIComponent(id) +
            '?autoplay=1&loop=1&playlist=' +
            encodeURIComponent(id) +
            '&rel=0&playsinline=1';
        }
      } else if (useExternalKind === 'MP4') {
        const vid = stageEl.querySelector('#iv-mp4-player');
        if (vid) {
          vid.src = externalList[currentIdx];
          vid.play().catch(function () {});
        }
      }
    }

    function syncBuiltinMeta() {
      const clip = clips[currentIdx];
      if (counterEl) counterEl.textContent = (currentIdx + 1) + ' / ' + clips.length;
      if (switchEl) switchEl.textContent = String(stateRef.clipSwitches);
      const handleEl = stageEl.querySelector('#iv-clip-handle');
      const titleEl = stageEl.querySelector('#iv-clip-title');
      const tagsEl = stageEl.querySelector('#iv-clip-tags');
      const likesEl = stageEl.querySelector('#iv-likes-count');
      const commentsEl = stageEl.querySelector('#iv-comments-count');
      if (handleEl) handleEl.textContent = clip.handle + ' • ' + clip.category;
      if (titleEl) titleEl.textContent = clip.title;
      if (tagsEl) tagsEl.textContent = clip.hashtags;
      if (likesEl) likesEl.textContent = clip.likes;
      if (commentsEl) commentsEl.textContent = clip.comments;
    }

    function switchClip(step) {
      currentIdx = (currentIdx + step + totalCount) % totalCount;
      stateRef.clipSwitches++;
      clipStartPerf = performance.now();
      if (useExternalKind) syncExternalMedia();
      else syncBuiltinMeta();
    }

    if (useExternalKind) syncExternalMedia();
    else syncBuiltinMeta();

    if (prevBtn) prevBtn.addEventListener('click', function () { switchClip(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { switchClip(1); });

    function onWheel(e) {
      const now = performance.now();
      if (now < wheelCooldownUntil) return;
      if (Math.abs(e.deltaY) < 12) return;
      e.preventDefault();
      wheelCooldownUntil = now + 320;
      switchClip(e.deltaY > 0 ? 1 : -1);
    }

    function onKey(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        switchClip(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        switchClip(-1);
      }
    }

    if (phoneFrame) {
      phoneFrame.addEventListener('wheel', onWheel, { passive: false });
    }
    global.addEventListener('keydown', onKey);

    let canvasRaf = null;
    if (!useExternalKind) {
      const canvas = stageEl.querySelector('#iv-shorts-canvas');
      const ctx = canvas ? canvas.getContext('2d') : null;

      function renderCanvasFrame() {
        if (!ctx) return;
        const clip = clips[currentIdx];
        const elapsedSec = (performance.now() - clipStartPerf) / 1000;
        if (elapsedSec >= clip.durationSec) {
          switchClip(1);
        }

        const currClip = clips[currentIdx];
        const t = (performance.now() - clipStartPerf) / 1000;
        const progress = Math.min(1, Math.max(0, t / currClip.durationSec));
        const beats = currClip.beats;
        const beatIdx = Math.min(beats.length - 1, Math.floor(progress * beats.length));
        const beat = beats[beatIdx];

        const w = canvas.width;
        const h = canvas.height;
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, currClip.palette[0]);
        grad.addColorStop(1, currClip.palette[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Subtle kinetic grid accent
        ctx.save();
        ctx.strokeStyle = currClip.palette[2];
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 1;
        const offset = (t * 28) % 40;
        for (let y = offset; y < h; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.restore();

        // Top multi-segment beat bar
        const segGap = 6;
        const segW = (w - 32 - (beats.length - 1) * segGap) / beats.length;
        for (let b = 0; b < beats.length; b++) {
          const sx = 16 + b * (segW + segGap);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(sx, 14, segW, 4);
          if (b < beatIdx) {
            ctx.fillStyle = currClip.palette[2];
            ctx.fillRect(sx, 14, segW, 4);
          } else if (b === beatIdx) {
            const beatProg = (progress * beats.length) - beatIdx;
            ctx.fillStyle = currClip.palette[2];
            ctx.fillRect(sx, 14, segW * beatProg, 4);
          }
        }

        // Beat badge pill
        ctx.save();
        ctx.font = '700 13px "Be Vietnam Pro", system-ui, sans-serif';
        const badgeText = beat.badge;
        const bw = ctx.measureText(badgeText).width + 24;
        ctx.fillStyle = currClip.palette[2];
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(w / 2 - bw / 2, 74, bw, 28, 14) : ctx.rect(w / 2 - bw / 2, 74, bw, 28);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, w / 2, 88);
        ctx.restore();

        // Kinetic visual illustration
        drawBeatVisual(ctx, beat.visualType, w, 205, t, currClip.palette[2]);

        // Bold kinetic Vietnamese headline & subtext
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '800 22px "Be Vietnam Pro", system-ui, sans-serif';
        const nextY = wrapCanvasText(ctx, beat.headline, w / 2, w - 76, 305, 30);

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '500 15px "Be Vietnam Pro", system-ui, sans-serif';
        wrapCanvasText(ctx, beat.subtext, w / 2, w - 82, nextY + 12, 22);
        ctx.restore();

        canvasRaf = global.requestAnimationFrame(renderCanvasFrame);
      }

      canvasRaf = global.requestAnimationFrame(renderCanvasFrame);
    }

    return function teardownGroup1() {
      if (canvasRaf) global.cancelAnimationFrame(canvasRaf);
      if (phoneFrame) phoneFrame.removeEventListener('wheel', onWheel);
      global.removeEventListener('keydown', onKey);
      const vid = stageEl.querySelector('#iv-mp4-player');
      if (vid) {
        vid.pause();
        vid.removeAttribute('src');
      }
      const yt = stageEl.querySelector('#iv-yt-frame');
      if (yt) yt.removeAttribute('src');
    };
  }

  function mountGroup2Reading(stageEl, stateRef) {
    const Utils = CogLab.Utils;
    const article = CogLab.Content.READING_ARTICLE;
    let fontSize = 18;

    const sectionsHtml = article.sections
      .map(function (sec) {
        const paras = sec.paragraphs
          .map(function (p) {
            return '<p>' + Utils.escapeHtml(p) + '</p>';
          })
          .join('');
        return '<section class="iv-read-section"><h3>' + Utils.escapeHtml(sec.heading) + '</h3>' + paras + '</section>';
      })
      .join('');

    stageEl.innerHTML =
      '<div class="iv-reading-shell">' +
      '<div class="iv-reading-toolbar">' +
      '<div class="iv-reading-meta">' +
      '<span>' + Utils.escapeHtml(article.subtitle) + '</span>' +
      '<span class="iv-read-progress-text" id="iv-read-progress-text">Đã đọc: 0%</span>' +
      '</div>' +
      '<div class="iv-font-controls">' +
      '<button type="button" class="btn btn-secondary btn-sm" id="iv-font-dec" aria-label="Giảm cỡ chữ">A-</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="iv-font-inc" aria-label="Tăng cỡ chữ">A+</button>' +
      '</div>' +
      '</div>' +
      '<div class="iv-read-progress-track"><div class="iv-read-progress-bar" id="iv-read-progress-bar"></div></div>' +
      '<article class="iv-reading-paper" id="iv-reading-paper">' +
      '<h2 class="iv-article-title">' + Utils.escapeHtml(article.title) + '</h2>' +
      '<p class="iv-article-note">' + Utils.escapeHtml(article.readingTimeNote) + '</p>' +
      '<div class="iv-article-body" id="iv-article-body">' +
      sectionsHtml +
      '</div>' +
      '</article>' +
      '</div>';

    const paperEl = stageEl.querySelector('#iv-reading-paper');
    const bodyEl = stageEl.querySelector('#iv-article-body');
    const barEl = stageEl.querySelector('#iv-read-progress-bar');
    const pctEl = stageEl.querySelector('#iv-read-progress-text');
    const decBtn = stageEl.querySelector('#iv-font-dec');
    const incBtn = stageEl.querySelector('#iv-font-inc');

    function updateScroll() {
      if (!paperEl) return;
      const maxScroll = paperEl.scrollHeight - paperEl.clientHeight;
      const pct = maxScroll > 0 ? Math.min(100, Math.round((paperEl.scrollTop / maxScroll) * 100)) : 100;
      if (pct > stateRef.maxScrollPct) {
        stateRef.maxScrollPct = pct;
      }
      if (barEl) barEl.style.width = stateRef.maxScrollPct + '%';
      if (pctEl) pctEl.textContent = 'Tiến độ đọc: ' + stateRef.maxScrollPct + '%';
    }

    if (paperEl) {
      paperEl.addEventListener('scroll', updateScroll);
    }
    if (decBtn && bodyEl) {
      decBtn.addEventListener('click', function () {
        fontSize = Math.max(15, fontSize - 1);
        bodyEl.style.fontSize = fontSize + 'px';
      });
    }
    if (incBtn && bodyEl) {
      incBtn.addEventListener('click', function () {
        fontSize = Math.min(24, fontSize + 1);
        bodyEl.style.fontSize = fontSize + 'px';
      });
    }

    return function teardownGroup2() {
      if (paperEl) paperEl.removeEventListener('scroll', updateScroll);
    };
  }

  function mountGroup3Rest(stageEl) {
    stageEl.innerHTML =
      '<div class="iv-rest-shell">' +
      '<div class="iv-rest-orb" aria-hidden="true"></div>' +
      '<h2>Giai đoạn Nghỉ ngơi Thụ động</h2>' +
      '<p class="iv-rest-lead">Vui lòng ngồi thư giãn yên tĩnh tại chỗ, hướng mắt ra xa khỏi màn hình và <strong>không sử dụng bất kỳ thiết bị điện tử nào</strong> (kể cả điện thoại cá nhân).</p>' +
      '<p class="iv-rest-sub">Khi đồng hồ ở góc trên đếm về <code>00:00</code>, hệ thống sẽ phát âm báo nhẹ và mở khóa nút chuyển sang phần đo tiếp theo.</p>' +
      '</div>';
    return function () {};
  }

  /**
   * Starts Screen 4 intervention with a strictly locked countdown.
   */
  function start(options) {
    const {
      container,
      groupId,
      durationSec,
      settings,
      onComplete
    } = options;

    cleanup();

    const Utils = CogLab.Utils;
    const groupInfo = CogLab.Config.GROUPS[groupId] || CogLab.Config.GROUPS[3];
    const stateRef = {
      durationSec: durationSec,
      clipSwitches: groupId === 1 ? 0 : null,
      maxScrollPct: groupId === 2 ? 0 : null
    };

    container.innerHTML =
      '<div class="iv-wrapper">' +
      '<div class="iv-header">' +
      '<div>' +
      '<span class="badge badge-info">GIAI ĐOẠN 4 • CAN THIỆP (' + Utils.escapeHtml(groupInfo.shortName) + ')</span>' +
      '<h2 class="iv-title">' + Utils.escapeHtml(groupInfo.name) + '</h2>' +
      '</div>' +
      '<div class="iv-timer-box">' +
      '<span class="iv-timer-label">Thời gian còn lại</span>' +
      '<span class="iv-timer-clock" id="iv-timer-clock">' + Utils.formatClock(durationSec) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="iv-stage" id="iv-stage"></div>' +
      '<div class="iv-footer">' +
      '<div class="iv-lock-status" id="iv-lock-status">🔒 Đang khóa nút tiếp tục cho đến khi hết thời gian quy định.</div>' +
      '<button type="button" class="btn btn-primary btn-lg" id="iv-continue-btn" disabled>🔒 Tiếp tục sang Post-test (' + Utils.formatClock(durationSec) + ')</button>' +
      '</div>' +
      '</div>';

    const stageEl = container.querySelector('#iv-stage');
    const clockEl = container.querySelector('#iv-timer-clock');
    const lockEl = container.querySelector('#iv-lock-status');
    const continueBtn = container.querySelector('#iv-continue-btn');

    let teardownContent = null;
    if (groupId === 1) {
      teardownContent = mountGroup1Feed(stageEl, settings, stateRef);
    } else if (groupId === 2) {
      teardownContent = mountGroup2Reading(stageEl, stateRef);
    } else {
      teardownContent = mountGroup3Rest(stageEl);
    }

    const startPerf = performance.now();
    const startEpoch = Date.now();
    const totalMs = durationSec * 1000;
    let unlocked = false;
    let countdownRaf = null;
    let lastSecDisplay = durationSec;

    function updateCountdown() {
      const elapsedMs = Math.max(performance.now() - startPerf, Date.now() - startEpoch);
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      const secLeft = Math.ceil(remainingMs / 1000);

      if (secLeft !== lastSecDisplay) {
        lastSecDisplay = secLeft;
        const formatted = Utils.formatClock(secLeft);
        if (clockEl) clockEl.textContent = formatted;
        if (!unlocked && continueBtn) {
          continueBtn.textContent = '🔒 Tiếp tục sang Post-test (' + formatted + ')';
        }
      }

      if (remainingMs <= 0 && !unlocked) {
        unlocked = true;
        if (clockEl) {
          clockEl.textContent = '00:00';
          clockEl.classList.add('is-done');
        }
        if (lockEl) {
          lockEl.textContent = '✅ Đã hoàn thành đủ thời gian can thiệp! Nhấn nút bên phải để bắt đầu Post-test.';
          lockEl.classList.add('is-unlocked');
        }
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.textContent = 'Tiếp tục sang Post-test →';
          continueBtn.classList.add('btn-ready-pulse');
        }
        Utils.playGentleChime(settings.soundEnabled !== false);
        return;
      }

      if (!unlocked) {
        countdownRaf = global.requestAnimationFrame(updateCountdown);
      }
    }

    countdownRaf = global.requestAnimationFrame(updateCountdown);

    function handleContinue() {
      if (!unlocked) return;
      cleanup();
      if (typeof onComplete === 'function') {
        onComplete({
          durationSec: stateRef.durationSec,
          clipSwitches: stateRef.clipSwitches,
          maxScrollPct: stateRef.maxScrollPct
        });
      }
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', handleContinue);
    }

    activeCleanup = function () {
      if (countdownRaf) global.cancelAnimationFrame(countdownRaf);
      if (typeof teardownContent === 'function') teardownContent();
      if (continueBtn) continueBtn.removeEventListener('click', handleContinue);
    };
  }

  CogLab.Intervention = {
    start,
    cleanup
  };
})(window);
