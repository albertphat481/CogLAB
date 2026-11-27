(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  let activeRunToken = 0;
  const activeRafIds = new Set();
  let activeKeyHandler = null;

  function clearAllRafs() {
    activeRafIds.forEach(function (id) {
      global.cancelAnimationFrame(id);
    });
    activeRafIds.clear();
  }

  function detachKeyListener() {
    if (activeKeyHandler) {
      global.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
  }

  function setLabMode(enabled) {
    if (enabled) {
      document.body.classList.add('lab-active');
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } else {
      document.body.classList.remove('lab-active');
    }
  }

  function abort() {
    activeRunToken++;
    clearAllRafs();
    detachKeyListener();
    setLabMode(false);
  }

  function nextFrame(token) {
    return new Promise(function (resolve, reject) {
      const rafId = global.requestAnimationFrame(function (ts) {
        activeRafIds.delete(rafId);
        if (token !== activeRunToken) {
          reject(new Error('ABORTED'));
          return;
        }
        resolve(ts);
      });
      activeRafIds.add(rafId);
    });
  }

  function waitUntil(targetPerfMs, token) {
    return new Promise(function (resolve, reject) {
      function step() {
        if (token !== activeRunToken) {
          reject(new Error('ABORTED'));
          return;
        }
        if (performance.now() >= targetPerfMs) {
          resolve(performance.now());
          return;
        }
        const rafId = global.requestAnimationFrame(function () {
          activeRafIds.delete(rafId);
          step();
        });
        activeRafIds.add(rafId);
      }
      step();
    });
  }

  function waitDuration(durationMs, token) {
    return waitUntil(performance.now() + durationMs, token);
  }

  function extractNormalizedKey(event) {
    const code = event.code || '';
    if (code === 'Space' || event.key === ' ') return ' ';
    if (code === 'KeyD') return 'd';
    if (code === 'KeyF') return 'f';
    if (code === 'KeyJ') return 'j';
    if (code === 'KeyK') return 'k';
    const raw = (event.key || '').toLowerCase();
    return raw;
  }

  function classifyOutlier(rtMs) {
    const TIMING = CogLab.Config.TIMING;
    if (rtMs === null || rtMs === undefined) return 'NA';
    if (rtMs < TIMING.outlierFastMs) return 'TOO_FAST';
    if (rtMs > TIMING.outlierSlowMs) return 'TOO_SLOW';
    return 'VALID';
  }

  function renderFooterHint(testType) {
    if (testType === 'stroop') {
      const chips = CogLab.Config.STROOP_COLORS.map(function (c) {
        return (
          '<span class="lab-key-chip">' +
          '<kbd>' + c.keyLabel + '</kbd>' +
          '<span class="lab-swatch" style="background:' + c.hex + '"></span>' +
          '<span>' + c.label + '</span>' +
          '</span>'
        );
      }).join('');
      return '<div class="lab-footer-hint">' + chips + '</div>';
    }
    if (testType === 'gonogo') {
      return (
        '<div class="lab-footer-hint">' +
        '<span class="lab-key-chip"><span class="lab-swatch" style="background:#22C55E"></span> Tròn Xanh: bấm <kbd>SPACE</kbd> nhanh nhất</span>' +
        '<span class="lab-key-chip"><span class="lab-swatch" style="background:#EF4444"></span> Dấu X Đỏ: KHÔNG bấm</span>' +
        '</div>'
      );
    }
    return (
      '<div class="lab-footer-hint">' +
      '<span class="lab-key-chip">Trùng chữ cách đó đúng 2 bước (A → K → A): bấm <kbd>SPACE</kbd></span>' +
      '</div>'
    );
  }

  function createStageLayout(container, testType, phaseLabel, totalTrials) {
    const html =
      '<div class="lab-stage-shell">' +
      '<div class="lab-topbar">' +
      '<span class="lab-phase-badge">' + CogLab.Utils.escapeHtml(phaseLabel) + '</span>' +
      '<span class="lab-trial-counter" id="lab-trial-counter">Lượt 1 / ' + totalTrials + '</span>' +
      '</div>' +
      '<div class="lab-center-canvas" id="lab-center-canvas">' +
      '<div class="lab-fixation">+</div>' +
      '</div>' +
      '<div class="lab-feedback-slot" id="lab-feedback-slot"></div>' +
      renderFooterHint(testType) +
      '</div>';

    container.innerHTML = html;
    return {
      counterEl: container.querySelector('#lab-trial-counter'),
      canvasEl: container.querySelector('#lab-center-canvas'),
      feedbackEl: container.querySelector('#lab-feedback-slot')
    };
  }

  function renderPracticeFeedback(feedbackEl, isCorrect, message) {
    if (!feedbackEl) return;
    feedbackEl.innerHTML =
      '<div class="lab-feedback-pill ' +
      (isCorrect ? 'is-correct' : 'is-wrong') +
      '">' +
      CogLab.Utils.escapeHtml(message) +
      '</div>';
  }

  function waitForKeyOrTimeout(options) {
    const {
      token,
      allowedKeys,
      deadlinePerfMs,
      onFirstKey
    } = options;

    return new Promise(function (resolve, reject) {
      let settled = false;

      function cleanup() {
        detachKeyListener();
      }

      activeKeyHandler = function (event) {
        if (settled) return;
        if (event.repeat) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        const key = extractNormalizedKey(event);
        if (key === ' ' || allowedKeys.indexOf(key) !== -1) {
          event.preventDefault();
        }
        if (allowedKeys.indexOf(key) === -1) return;

        const keyPerfMs = performance.now();
        settled = true;
        cleanup();
        if (typeof onFirstKey === 'function') {
          onFirstKey(key, keyPerfMs);
        }
        resolve({ key: key, perfMs: keyPerfMs });
      };

      global.addEventListener('keydown', activeKeyHandler);

      function pollTimeout() {
        if (settled) return;
        if (token !== activeRunToken) {
          settled = true;
          cleanup();
          reject(new Error('ABORTED'));
          return;
        }
        if (performance.now() >= deadlinePerfMs) {
          settled = true;
          cleanup();
          resolve({ key: null, perfMs: null });
          return;
        }
        const rafId = global.requestAnimationFrame(function () {
          activeRafIds.delete(rafId);
          pollTimeout();
        });
        activeRafIds.add(rafId);
      }

      pollTimeout();
    });
  }

  /**
   * Monitors a fixed-duration trial window (stimulus phase -> blank ISI phase)
   * while listening for at most one valid key response across the entire window.
   */
  function runFixedWindowTrial(options) {
    const {
      token,
      allowedKeys,
      onsetPerfMs,
      stimDurationMs,
      totalWindowMs,
      onStimOffset
    } = options;

    return new Promise(function (resolve, reject) {
      let response = { key: null, perfMs: null };
      let stimHidden = false;
      let finished = false;

      const stimEndPerfMs = onsetPerfMs + stimDurationMs;
      const windowEndPerfMs = onsetPerfMs + totalWindowMs;

      activeKeyHandler = function (event) {
        if (finished || response.key !== null) return;
        if (event.repeat) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        const key = extractNormalizedKey(event);
        if (key === ' ' || allowedKeys.indexOf(key) !== -1) {
          event.preventDefault();
        }
        if (allowedKeys.indexOf(key) === -1) return;

        response = { key: key, perfMs: performance.now() };
      };

      global.addEventListener('keydown', activeKeyHandler);

      function tick() {
        if (finished) return;
        if (token !== activeRunToken) {
          finished = true;
          detachKeyListener();
          reject(new Error('ABORTED'));
          return;
        }

        const now = performance.now();
        if (!stimHidden && now >= stimEndPerfMs) {
          stimHidden = true;
          if (typeof onStimOffset === 'function') {
            onStimOffset();
          }
        }

        if (now >= windowEndPerfMs) {
          finished = true;
          detachKeyListener();
          resolve(response);
          return;
        }

        const rafId = global.requestAnimationFrame(function () {
          activeRafIds.delete(rafId);
          tick();
        });
        activeRafIds.add(rafId);
      }

      tick();
    });
  }

  async function runStroopSequence(ctx) {
    const { token, ui, trials, isPractice, meta, onProgress } = ctx;
    const TIMING = CogLab.Config.TIMING;
    const allowedKeys = CogLab.Config.STROOP_COLORS.map(function (c) {
      return c.key;
    });
    const keyToLabel = {};
    CogLab.Config.STROOP_COLORS.forEach(function (c) {
      keyToLabel[c.key] = c.keyLabel + ' (' + c.label + ')';
    });

    const records = [];

    for (let i = 0; i < trials.length; i++) {
      if (token !== activeRunToken) throw new Error('ABORTED');
      const trial = trials[i];
      ui.counterEl.textContent = 'Lượt ' + (i + 1) + ' / ' + trials.length;
      if (ui.feedbackEl) ui.feedbackEl.innerHTML = '';
      if (typeof onProgress === 'function') onProgress(i, trials.length);

      // 1. Fixation cross
      await nextFrame(token);
      ui.canvasEl.innerHTML = '<div class="lab-fixation">+</div>';
      await waitDuration(TIMING.stroopFixationMs, token);

      // 2. Stimulus onset synced to animation frame
      await nextFrame(token);
      ui.canvasEl.innerHTML =
        '<div class="lab-stroop-word" style="color:' +
        trial.inkHex +
        '">' +
        CogLab.Utils.escapeHtml(trial.wordText) +
        '</div>';
      const onsetPerfMs = performance.now();

      const resp = await waitForKeyOrTimeout({
        token: token,
        allowedKeys: allowedKeys,
        deadlinePerfMs: onsetPerfMs + TIMING.stroopMaxResponseMs
      });

      const rtMs = resp.perfMs !== null ? Math.round((resp.perfMs - onsetPerfMs) * 100) / 100 : null;
      const isCorrect = resp.key !== null && resp.key === trial.correctKey;
      const outcome = resp.key === null ? 'TIMEOUT' : isCorrect ? 'CORRECT' : 'INCORRECT';
      const outlierFlag = classifyOutlier(rtMs);

      records.push({
        participantId: meta.participantId,
        group: meta.group,
        mode: meta.mode,
        phase: meta.phase,
        test: 'stroop',
        trialIndex: i,
        condition: trial.condition,
        stimulus: trial.wordId + '/' + trial.inkId,
        expectedKey: trial.correctKey,
        responseKey: resp.key,
        rtMs: rtMs,
        isCorrect: isCorrect,
        outcome: outcome,
        outlierFlag: outlierFlag,
        timestampIso: new Date().toISOString()
      });

      // Clear stimulus immediately after response
      await nextFrame(token);
      ui.canvasEl.innerHTML = '<div class="lab-blank-dot"></div>';

      if (isPractice) {
        let msg;
        if (outcome === 'CORRECT') {
          msg = 'Đúng! (' + Math.round(rtMs) + ' ms)';
        } else if (outcome === 'TIMEOUT') {
          msg = 'Quá thời gian! Đáp án đúng: phím ' + keyToLabel[trial.correctKey];
        } else {
          msg = 'Chưa đúng! Màu mực cần bấm: phím ' + keyToLabel[trial.correctKey];
        }
        renderPracticeFeedback(ui.feedbackEl, isCorrect, msg);
        await waitDuration(TIMING.practiceFeedbackMs, token);
        if (ui.feedbackEl) ui.feedbackEl.innerHTML = '';
      }

      // 3. Blank ISI (1200 ms + 300 ms fixation = 1500 ms total ISI)
      await waitDuration(TIMING.stroopBlankIsiMs, token);
    }

    return records;
  }

  async function runGoNoGoSequence(ctx) {
    const { token, ui, trials, isPractice, meta, onProgress } = ctx;
    const TIMING = CogLab.Config.TIMING;
    const totalWindowMs = TIMING.gonogoStimMs + TIMING.gonogoBlankIsiMs;
    const records = [];

    // Brief lead-in fixation before first stimulus
    await nextFrame(token);
    ui.canvasEl.innerHTML = '<div class="lab-fixation">+</div>';
    await waitDuration(450, token);

    for (let i = 0; i < trials.length; i++) {
      if (token !== activeRunToken) throw new Error('ABORTED');
      const trial = trials[i];
      ui.counterEl.textContent = 'Lượt ' + (i + 1) + ' / ' + trials.length;
      if (ui.feedbackEl) ui.feedbackEl.innerHTML = '';
      if (typeof onProgress === 'function') onProgress(i, trials.length);

      await nextFrame(token);
      if (trial.condition === 'go') {
        ui.canvasEl.innerHTML = '<div class="lab-go-circle" aria-label="Go"></div>';
      } else {
        ui.canvasEl.innerHTML = '<div class="lab-nogo-x" aria-label="No-Go">✕</div>';
      }
      const onsetPerfMs = performance.now();

      const resp = await runFixedWindowTrial({
        token: token,
        allowedKeys: [' '],
        onsetPerfMs: onsetPerfMs,
        stimDurationMs: TIMING.gonogoStimMs,
        totalWindowMs: totalWindowMs,
        onStimOffset: function () {
          ui.canvasEl.innerHTML = '<div class="lab-blank-dot"></div>';
        }
      });

      const rtMs = resp.perfMs !== null ? Math.round((resp.perfMs - onsetPerfMs) * 100) / 100 : null;
      const pressed = resp.key === ' ';

      let outcome;
      let isCorrect;
      if (trial.condition === 'go') {
        outcome = pressed ? 'HIT' : 'OMISSION';
        isCorrect = pressed;
      } else {
        outcome = pressed ? 'COMMISSION' : 'CORRECT_REJECTION';
        isCorrect = !pressed;
      }

      records.push({
        participantId: meta.participantId,
        group: meta.group,
        mode: meta.mode,
        phase: meta.phase,
        test: 'gonogo',
        trialIndex: i,
        condition: trial.condition,
        stimulus: trial.condition === 'go' ? 'GREEN_CIRCLE' : 'RED_X',
        expectedKey: trial.correctKey,
        responseKey: pressed ? 'SPACE' : null,
        rtMs: rtMs,
        isCorrect: isCorrect,
        outcome: outcome,
        outlierFlag: classifyOutlier(rtMs),
        timestampIso: new Date().toISOString()
      });

      if (isPractice) {
        let msg;
        if (outcome === 'HIT') msg = 'Chính xác! Phản xạ ' + Math.round(rtMs) + ' ms';
        else if (outcome === 'CORRECT_REJECTION') msg = 'Tốt! Đã kiềm chế không bấm dấu X đỏ.';
        else if (outcome === 'COMMISSION') msg = 'Bấm nhầm! Gặp dấu X đỏ không được bấm Space.';
        else msg = 'Bỏ sót! Gặp hình tròn xanh cần bấm Space thật nhanh.';
        renderPracticeFeedback(ui.feedbackEl, isCorrect, msg);
        await waitDuration(TIMING.practiceFeedbackMs, token);
        if (ui.feedbackEl) ui.feedbackEl.innerHTML = '';
      }
    }

    return records;
  }

  async function runTwoBackSequence(ctx) {
    const { token, ui, trials, isPractice, meta, onProgress } = ctx;
    const TIMING = CogLab.Config.TIMING;
    const totalWindowMs = TIMING.twobackStimMs + TIMING.twobackBlankIsiMs;
    const records = [];

    await nextFrame(token);
    ui.canvasEl.innerHTML = '<div class="lab-fixation">+</div>';
    await waitDuration(450, token);

    for (let i = 0; i < trials.length; i++) {
      if (token !== activeRunToken) throw new Error('ABORTED');
      const trial = trials[i];
      ui.counterEl.textContent = 'Lượt ' + (i + 1) + ' / ' + trials.length;
      if (ui.feedbackEl) ui.feedbackEl.innerHTML = '';
      if (typeof onProgress === 'function') onProgress(i, trials.length);

      await nextFrame(token);
      ui.canvasEl.innerHTML =
        '<div class="lab-nback-letter">' + CogLab.Utils.escapeHtml(trial.letter) + '</div>';
      const onsetPerfMs = performance.now();

      const resp = await runFixedWindowTrial({
        token: token,
        allowedKeys: [' '],
        onsetPerfMs: onsetPerfMs,
        stimDurationMs: TIMING.twobackStimMs,
        totalWindowMs: totalWindowMs,
        onStimOffset: function () {
          ui.canvasEl.innerHTML = '<div class="lab-blank-dot"></div>';
        }
      });

      const rtMs = resp.perfMs !== null ? Math.round((resp.perfMs - onsetPerfMs) * 100) / 100 : null;
      const pressed = resp.key === ' ';

      let outcome;
      let isCorrect;
      if (trial.isBuffer) {
        outcome = 'BUFFER';
        isCorrect = !pressed;
      } else if (trial.isTarget) {
        outcome = pressed ? 'HIT' : 'MISS';
        isCorrect = pressed;
      } else {
        outcome = pressed ? 'FALSE_ALARM' : 'CORRECT_REJECTION';
        isCorrect = !pressed;
      }

      records.push({
        participantId: meta.participantId,
        group: meta.group,
        mode: meta.mode,
        phase: meta.phase,
        test: 'twoback',
        trialIndex: i,
        condition: trial.condition,
        stimulus: trial.letter,
        expectedKey: trial.isTarget ? 'SPACE' : null,
        responseKey: pressed ? 'SPACE' : null,
        rtMs: rtMs,
        isCorrect: isCorrect,
        outcome: outcome,
        outlierFlag: classifyOutlier(rtMs),
        timestampIso: new Date().toISOString()
      });

      if (isPractice) {
        let msg;
        if (trial.isBuffer) {
          msg = pressed
            ? 'Lưu ý: 2 chữ cái đầu chỉ dùng để ghi nhớ, chưa bấm Space.'
            : 'Hãy ghi nhớ chữ cái "' + trial.letter + '" cho các bước sau.';
        } else if (outcome === 'HIT') {
          msg = 'Đúng! Trùng chữ cách 2 bước (' + Math.round(rtMs) + ' ms).';
        } else if (outcome === 'CORRECT_REJECTION') {
          msg = 'Đúng! Chữ "' + trial.letter + '" không trùng với chữ cách 2 bước.';
        } else if (outcome === 'MISS') {
          msg = 'Bỏ sót! Chữ "' + trial.letter + '" trùng với chữ cách đó đúng 2 bước.';
        } else {
          msg = 'Bấm nhầm! Chữ cách 2 bước là "' + trials[i - 2].letter + '", không phải "' + trial.letter + '".';
        }
        renderPracticeFeedback(ui.feedbackEl, isCorrect, msg);
        await waitDuration(TIMING.practiceFeedbackMs, token);
        if (ui.feedbackEl) ui.feedbackEl.innerHTML = '';
      }
    }

    return records;
  }

  /**
   * Runs one complete cognitive test sequence inside `container`.
   * Zero feedback is displayed when `isPractice` is false.
   */
  async function runTest(options) {
    const {
      container,
      testType,
      phaseLabel,
      trials,
      isPractice,
      meta,
      onProgress,
      onComplete,
      onAbort
    } = options;

    abort();
    const token = activeRunToken;
    setLabMode(true);

    const ui = createStageLayout(container, testType, phaseLabel, trials.length);

    try {
      const ctx = { token, ui, trials, isPractice: Boolean(isPractice), meta, onProgress };
      let records;
      if (testType === 'stroop') {
        records = await runStroopSequence(ctx);
      } else if (testType === 'gonogo') {
        records = await runGoNoGoSequence(ctx);
      } else if (testType === 'twoback') {
        records = await runTwoBackSequence(ctx);
      } else {
        throw new Error('Unknown testType: ' + testType);
      }

      if (token !== activeRunToken) return;
      detachKeyListener();
      setLabMode(false);
      if (typeof onComplete === 'function') {
        onComplete(records);
      }
      return records;
    } catch (err) {
      detachKeyListener();
      setLabMode(false);
      if (err && err.message === 'ABORTED') {
        if (typeof onAbort === 'function') onAbort();
        return null;
      }
      throw err;
    }
  }

  /**
   * Runs an inter-test rest break driven strictly by requestAnimationFrame + performance.now().
   */
  function runBreak(options) {
    const {
      container,
      seconds,
      nextTestTitle,
      nextTestInstructions,
      onComplete
    } = options;

    abort();
    const token = activeRunToken;
    setLabMode(true);

    container.innerHTML =
      '<div class="lab-stage-shell lab-break-shell">' +
      '<div class="lab-break-badge">NGHỈ CHUYỂN BÀI ĐO</div>' +
      '<div class="lab-break-timer" id="lab-break-timer">' + seconds + 's</div>' +
      '<h2 class="lab-break-title">Chuẩn bị: ' + CogLab.Utils.escapeHtml(nextTestTitle) + '</h2>' +
      '<p class="lab-break-desc">' + CogLab.Utils.escapeHtml(nextTestInstructions) + '</p>' +
      '</div>';

    const timerEl = container.querySelector('#lab-break-timer');
    const startPerf = performance.now();
    const endPerf = startPerf + seconds * 1000;
    let lastShown = seconds;

    function tick() {
      if (token !== activeRunToken) return;
      const remainingMs = endPerf - performance.now();
      if (remainingMs <= 0) {
        setLabMode(false);
        if (typeof onComplete === 'function') onComplete();
        return;
      }
      const secLeft = Math.ceil(remainingMs / 1000);
      if (secLeft !== lastShown && timerEl) {
        lastShown = secLeft;
        timerEl.textContent = secLeft + 's';
      }
      const rafId = global.requestAnimationFrame(function () {
        activeRafIds.delete(rafId);
        tick();
      });
      activeRafIds.add(rafId);
    }

    const rafId = global.requestAnimationFrame(function () {
      activeRafIds.delete(rafId);
      tick();
    });
    activeRafIds.add(rafId);
  }

  CogLab.TestEngine = {
    runTest,
    runBreak,
    abort,
    setLabMode
  };
})(window);
