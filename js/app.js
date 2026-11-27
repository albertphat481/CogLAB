(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  const AppState = {
    currentScreen: 'screen-home', // 'screen-home' | 'screen-1' | 'screen-2' | 'screen-3' | 'screen-4' | 'screen-5-ready' | 'screen-5-testing' | 'screen-5-done'
    isRunningTask: false,
    practiceStep: 0, // 0: Stroop, 1: Go/No-Go, 2: 2-Back, 3: All done
    lastPracticeStats: null,
    session: null,
    preBattery: null,
    postBattery: null
  };

  function getSettings() {
    return CogLab.Storage.loadSettings();
  }

  function getModeConfig() {
    const settings = getSettings();
    return CogLab.Config.MODES[settings.mode] || CogLab.Config.MODES.OFFICIAL;
  }

  function setBeforeUnloadGuard(active) {
    if (active) {
      global.onbeforeunload = function (e) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      };
    } else {
      global.onbeforeunload = null;
    }
  }

  function updateHeaderAndStepper() {
    const settings = getSettings();
    const modeCfg = getModeConfig();
    const Utils = CogLab.Utils;

    const modeBadge = document.getElementById('hdr-mode-badge');
    if (modeBadge) {
      modeBadge.textContent = modeCfg.id === 'DEMO' ? 'CHẾ ĐỘ DEMO HỘI ĐỒNG' : 'PHÒNG LAB • CHÍNH THỨC';
      modeBadge.className = 'badge ' + (modeCfg.id === 'DEMO' ? 'badge-warn' : 'badge-info');
      modeBadge.classList.toggle(
        'is-hidden',
        AppState.currentScreen === 'screen-home' && modeCfg.id !== 'DEMO'
      );
    }

    document.body.classList.toggle('is-home-mode', AppState.currentScreen === 'screen-home');

    const homeNav = document.getElementById('hdr-home-nav');
    if (homeNav) {
      homeNav.classList.toggle('is-hidden', AppState.currentScreen !== 'screen-home');
    }

    const bgStage = document.getElementById('home-bg-stage');
    if (bgStage) {
      bgStage.classList.toggle('is-hidden', AppState.currentScreen !== 'screen-home');
    }

    const scrollNav = document.getElementById('home-scroll-nav');
    if (scrollNav) {
      scrollNav.classList.toggle('is-hidden', AppState.currentScreen !== 'screen-home');
    }

    const demoBanner = document.getElementById('demo-mode-banner');
    if (demoBanner) {
      demoBanner.classList.toggle('is-hidden', modeCfg.id !== 'DEMO');
    }

    const participantBadge = document.getElementById('hdr-participant-badge');
    if (participantBadge) {
      if (AppState.session) {
        const grp = CogLab.Config.GROUPS[AppState.session.group];
        participantBadge.textContent =
          AppState.session.participantId + ' • ' + (grp ? grp.shortName : 'Nhóm ' + AppState.session.group);
        participantBadge.classList.remove('is-hidden');
      } else {
        participantBadge.classList.add('is-hidden');
      }
    }

    const researcherBtn = document.getElementById('hdr-researcher-btn');
    if (researcherBtn) {
      const allowed =
        !AppState.isRunningTask &&
        (AppState.currentScreen === 'screen-home' ||
          AppState.currentScreen === 'screen-1' ||
          AppState.currentScreen === 'screen-5-done');
      researcherBtn.disabled = !allowed;
      researcherBtn.classList.toggle('is-hidden', !allowed);
    }

    const replayIntroBtn = document.getElementById('hdr-replay-intro-btn');
    if (replayIntroBtn) {
      const canReplay =
        !AppState.isRunningTask &&
        (AppState.currentScreen === 'screen-home' || AppState.currentScreen === 'screen-1');
      replayIntroBtn.disabled = !canReplay;
      replayIntroBtn.classList.toggle('is-hidden', !canReplay);
    }

    const homeBtn = document.getElementById('hdr-home-btn');
    if (homeBtn) {
      const showHome =
        !AppState.isRunningTask &&
        (AppState.currentScreen === 'screen-1' || AppState.currentScreen === 'screen-5-done');
      homeBtn.disabled = !showHome;
      homeBtn.classList.toggle('is-hidden', !showHome);
    }

    const withdrawBtn = document.getElementById('hdr-withdraw-btn');
    if (withdrawBtn) {
      const showWithdraw =
        AppState.currentScreen !== 'screen-home' &&
        AppState.currentScreen !== 'screen-1' &&
        AppState.currentScreen !== 'screen-5-done';
      withdrawBtn.classList.toggle('is-hidden', !showWithdraw);
    }

    const stepperEl = document.getElementById('app-stepper');
    if (stepperEl) {
      stepperEl.classList.toggle('is-hidden', AppState.currentScreen === 'screen-home');
    }

    const stepMap = {
      'screen-home': 0,
      'screen-1': 1,
      'screen-2': 2,
      'screen-3': 3,
      'screen-4': 4,
      'screen-5-ready': 5,
      'screen-5-testing': 5,
      'screen-5-done': 5
    };
    const activeStep = stepMap[AppState.currentScreen] || 0;
    document.querySelectorAll('.stepper-item').forEach(function (el) {
      const stepNum = Number(el.dataset.step);
      el.classList.toggle('is-active', stepNum === activeStep);
      el.classList.toggle('is-done', activeStep > 0 && stepNum < activeStep);
    });

    const guardNeeded =
      AppState.currentScreen !== 'screen-home' &&
      AppState.currentScreen !== 'screen-1' &&
      AppState.currentScreen !== 'screen-5-done';
    setBeforeUnloadGuard(guardNeeded);

    const s1Summary = document.getElementById('s1-protocol-summary');
    if (s1Summary) {
      s1Summary.textContent =
        modeCfg.stroopTrials +
        ' lượt Stroop • ' +
        modeCfg.gonogoTrials +
        ' lượt Go/No-Go • ' +
        modeCfg.twobackTrials +
        ' lượt 2-Back • Can thiệp ' +
        Utils.formatClock(modeCfg.interventionSec);
    }
  }

  function showOnlyPanel(panelId) {
    document.querySelectorAll('.app-screen').forEach(function (el) {
      el.classList.toggle('is-hidden', el.id !== panelId);
    });
  }

  function updateHabitPreview() {
    const input = document.getElementById('input-video-hours');
    const pill = document.getElementById('habit-preview-pill');
    if (!input || !pill) return;

    const val = parseFloat(input.value);
    if (!Number.isFinite(val) || input.value === '') {
      pill.textContent = 'Chưa nhập thời lượng';
      pill.className = 'badge badge-muted';
      return;
    }

    const cat = CogLab.Utils.classifyVideoHabit(val);
    pill.textContent = 'Phân tầng: ' + cat;
    if (cat.indexOf('HIGH') === 0) pill.className = 'badge badge-warn';
    else if (cat.indexOf('LOW') === 0) pill.className = 'badge badge-ok';
    else pill.className = 'badge badge-info';
  }

  function initScreen1() {
    const form = document.getElementById('screen1-form');
    const videoInput = document.getElementById('input-video-hours');
    const alertBtns = document.querySelectorAll('.alertness-btn');
    const alertInput = document.getElementById('input-alertness');
    const errBox = document.getElementById('s1-error');

    if (videoInput) {
      videoInput.addEventListener('input', updateHabitPreview);
    }

    document.querySelectorAll('.preset-hour-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (videoInput) {
          videoInput.value = btn.dataset.hours;
          updateHabitPreview();
        }
      });
    });

    alertBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const val = btn.dataset.val;
        if (alertInput) alertInput.value = val;
        alertBtns.forEach(function (b) {
          b.classList.toggle('is-selected', b === btn);
        });
      });
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (errBox) errBox.classList.add('is-hidden');

        const pidRaw = document.getElementById('input-participant-id').value.trim().toUpperCase();
        const grade = document.getElementById('input-grade').value;
        const videoHours = parseFloat(document.getElementById('input-video-hours').value);
        const sleepHours = parseFloat(document.getElementById('input-sleep-hours').value);
        const alertness = parseInt(alertInput ? alertInput.value : '', 10);
        const consent = document.getElementById('input-consent').checked;

        let errorMsg = '';
        if (!/^[A-Z0-9_-]{2,20}$/.test(pidRaw)) {
          errorMsg = 'Vui lòng nhập mã học sinh hợp lệ (2–20 ký tự chữ/số, ví dụ: HS001).';
        } else if (!Number.isFinite(videoHours) || videoHours < 0 || videoHours > 16) {
          errorMsg = 'Vui lòng nhập số giờ xem video ngắn/ngày hợp lệ (0 đến 16 giờ).';
        } else if (!Number.isFinite(sleepHours) || sleepHours < 1 || sleepHours > 16) {
          errorMsg = 'Vui lòng nhập số giờ ngủ đêm qua hợp lệ (1 đến 16 giờ).';
        } else if (!Number.isFinite(alertness) || alertness < 1 || alertness > 5) {
          errorMsg = 'Vui lòng chọn mức độ tỉnh táo hiện tại (từ 1 đến 5).';
        } else if (!consent) {
          errorMsg = 'Bạn cần đánh dấu xác nhận đồng ý tham gia tự nguyện trước khi bắt đầu.';
        }

        if (errorMsg) {
          if (errBox) {
            errBox.textContent = errorMsg;
            errBox.classList.remove('is-hidden');
          }
          return;
        }

        const settings = getSettings();
        const modeCfg = getModeConfig();
        const forced = settings.forcedGroup;
        const isForced = forced === '1' || forced === '2' || forced === '3';
        const groupId = isForced ? Number(forced) : CogLab.Utils.assignBalancedGroup(pidRaw);
        const now = new Date();

        AppState.session = {
          sessionId: 'SES-' + pidRaw + '-' + Date.now().toString(36).toUpperCase(),
          participantId: pidRaw,
          mode: modeCfg.id,
          group: groupId,
          assignmentMethod: isForced ? 'MANUAL_FORCED' : 'AUTO_BALANCED',
          startedAt: now.toISOString(),
          completedAt: null,
          timeOfDay: CogLab.Utils.getTimeOfDayBucket(now),
          baseline: {
            grade: grade,
            videoHoursPerDay: videoHours,
            videoHabitGroup: CogLab.Utils.classifyVideoHabit(videoHours),
            sleepHours: sleepHours,
            alertness: alertness
          },
          intervention: null,
          trials: [],
          summary: null,
          syncedToSheets: false
        };

        AppState.preBattery = CogLab.Generators.generateBattery(modeCfg, null);
        AppState.postBattery = null;
        AppState.practiceStep = 0;
        AppState.lastPracticeStats = null;

        enterScreen2();
      });
    }

    updateHabitPreview();
  }

  function enterScreen2() {
    if (CogLab.HomeInteractive) CogLab.HomeInteractive.stop();
    if (CogLab.PrismCanvas) CogLab.PrismCanvas.stop();
    if (CogLab.SmoothScroll) CogLab.SmoothScroll.stop();
    if (global.__swarmRebuild && global.__swarmRebuild.app) {
      global.__swarmRebuild.stop(false);
    }
    AppState.currentScreen = 'screen-2';
    AppState.isRunningTask = false;
    showOnlyPanel('screen-2');
    updateHeaderAndStepper();
    renderPracticeWizard();
  }

  function renderPracticeWizard() {
    const container = document.getElementById('practice-wizard-box');
    const stageEl = document.getElementById('test-stage');
    if (stageEl) stageEl.classList.add('is-hidden');
    if (!container) return;
    container.classList.remove('is-hidden');

    const modeCfg = getModeConfig();
    const pCount = modeCfg.practiceTrials;
    const step = AppState.practiceStep;
    const stats = AppState.lastPracticeStats;

    let feedbackBanner = '';
    if (stats) {
      feedbackBanner =
        '<div class="practice-result-banner">' +
        '<strong>Kết quả vòng làm thử vừa rồi:</strong> Đạt <strong>' +
        stats.correct +
        ' / ' +
        stats.total +
        '</strong> lượt chính xác.' +
        '</div>';
    }

    if (step === 0) {
      container.innerHTML =
        '<div class="card">' +
        '<div class="guide-header">' +
        '<span class="badge badge-info">BƯỚC LÀM THỬ 1 / 3</span>' +
        '<h2>Bài kiểm tra 1: Stroop Màu – Chữ</h2>' +
        '</div>' +
        '<p class="guide-lead">Màn hình sẽ hiện một tên màu được tô bằng một màu mực nào đó. Nhiệm vụ của bạn là <strong>bấm phím ứng với MÀU MỰC</strong>, tuyệt đối bỏ qua nghĩa của chữ!</p>' +
        '<div class="example-box">' +
        '<div class="example-stim-lab"><div class="example-stim" style="color:#2563EB">ĐỎ</div></div>' +
        '<div class="example-explain">' +
        '<p>Chữ viết là <strong>"ĐỎ"</strong> nhưng màu mực là <strong>XANH LAM</strong>.</p>' +
        '<p>→ Đáp án đúng: Bấm phím <kbd>J</kbd> (Xanh lam).</p>' +
        '</div>' +
        '</div>' +
        '<div class="key-legend-grid">' +
        '<div class="key-legend-item"><kbd>D</kbd><span class="swatch" style="background:#DC2626"></span><span>Mực ĐỎ</span></div>' +
        '<div class="key-legend-item"><kbd>F</kbd><span class="swatch" style="background:#16A34A"></span><span>Mực XANH LÁ</span></div>' +
        '<div class="key-legend-item"><kbd>J</kbd><span class="swatch" style="background:#2563EB"></span><span>Mực XANH LAM</span></div>' +
        '<div class="key-legend-item"><kbd>K</kbd><span class="swatch" style="background:#CA8A04"></span><span>Mực VÀNG</span></div>' +
        '</div>' +
        feedbackBanner +
        '<div class="guide-actions">' +
        '<button type="button" class="btn btn-primary btn-lg" id="btn-run-prac-stroop">Bắt đầu làm thử Stroop (' + pCount + ' lượt) →</button>' +
        (stats ? '<button type="button" class="btn btn-secondary" id="btn-next-prac-step">Sang hướng dẫn Go/No-Go →</button>' : '') +
        '</div>' +
        '</div>';

      container.querySelector('#btn-run-prac-stroop').addEventListener('click', function () {
        runPracticeTest('stroop', pCount, function (records) {
          AppState.lastPracticeStats = summarizePractice(records);
          AppState.practiceStep = 1;
          renderPracticeWizard();
        });
      });
      const nextBtn = container.querySelector('#btn-next-prac-step');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          AppState.lastPracticeStats = null;
          AppState.practiceStep = 1;
          renderPracticeWizard();
        });
      }
      return;
    }

    if (step === 1) {
      container.innerHTML =
        '<div class="card">' +
        '<div class="guide-header">' +
        '<span class="badge badge-info">BƯỚC LÀM THỬ 2 / 3</span>' +
        '<h2>Bài kiểm tra 2: Go / No-Go (Kiểm soát xung động)</h2>' +
        '</div>' +
        '<p class="guide-lead">Các hình sẽ xuất hiện chớp nhoáng trong 500 ms. Hãy phản xạ thật nhanh nhưng kiềm chế đúng lúc:</p>' +
        '<div class="gng-guide-grid">' +
        '<div class="gng-guide-card">' +
        '<div class="lab-go-circle is-preview"></div>' +
        '<h3>Hình tròn XANH LÁ (80%)</h3>' +
        '<p>Bấm phím <kbd>SPACE</kbd> nhanh nhất có thể!</p>' +
        '</div>' +
        '<div class="gng-guide-card">' +
        '<div class="lab-nogo-x is-preview">✕</div>' +
        '<h3>Dấu X ĐỎ (20%)</h3>' +
        '<p><strong>TUYỆT ĐỐI KHÔNG BẤM</strong> bất kỳ phím nào!</p>' +
        '</div>' +
        '</div>' +
        feedbackBanner +
        '<div class="guide-actions">' +
        '<button type="button" class="btn btn-secondary" id="btn-retry-stroop">← Làm thử lại Stroop</button>' +
        '<button type="button" class="btn btn-primary btn-lg" id="btn-run-prac-gonogo">Bắt đầu làm thử Go/No-Go (' + pCount + ' lượt) →</button>' +
        '</div>' +
        '</div>';

      container.querySelector('#btn-retry-stroop').addEventListener('click', function () {
        AppState.lastPracticeStats = null;
        AppState.practiceStep = 0;
        renderPracticeWizard();
      });
      container.querySelector('#btn-run-prac-gonogo').addEventListener('click', function () {
        runPracticeTest('gonogo', pCount, function (records) {
          AppState.lastPracticeStats = summarizePractice(records);
          AppState.practiceStep = 2;
          renderPracticeWizard();
        });
      });
      return;
    }

    if (step === 2) {
      container.innerHTML =
        '<div class="card">' +
        '<div class="guide-header">' +
        '<span class="badge badge-info">BƯỚC LÀM THỬ 3 / 3</span>' +
        '<h2>Bài kiểm tra 3: 2-Back (Trí nhớ làm việc)</h2>' +
        '</div>' +
        '<p class="guide-lead">Từng chữ cái sẽ lần lượt xuất hiện. Hãy bấm phím <kbd>SPACE</kbd> ngay khi <strong>chữ cái hiện tại TRÙNG với chữ cái xuất hiện cách đó đúng 2 bước</strong>.</p>' +
        '<div class="nback-example-strip">' +
        '<div class="nback-ex-node"><span>Lượt 1</span><strong>A</strong><small>Ghi nhớ</small></div>' +
        '<div class="nback-ex-arrow">→</div>' +
        '<div class="nback-ex-node"><span>Lượt 2</span><strong>K</strong><small>Ghi nhớ</small></div>' +
        '<div class="nback-ex-arrow">→</div>' +
        '<div class="nback-ex-node is-match"><span>Lượt 3</span><strong>A</strong><small>Trùng Lượt 1 → Bấm SPACE!</small></div>' +
        '<div class="nback-ex-arrow">→</div>' +
        '<div class="nback-ex-node"><span>Lượt 4</span><strong>M</strong><small>Khác K → Không bấm</small></div>' +
        '</div>' +
        feedbackBanner +
        '<div class="guide-actions">' +
        '<button type="button" class="btn btn-secondary" id="btn-retry-gonogo">← Làm thử lại Go/No-Go</button>' +
        '<button type="button" class="btn btn-primary btn-lg" id="btn-run-prac-twoback">Bắt đầu làm thử 2-Back (' + pCount + ' lượt) →</button>' +
        '</div>' +
        '</div>';

      container.querySelector('#btn-retry-gonogo').addEventListener('click', function () {
        AppState.lastPracticeStats = null;
        AppState.practiceStep = 1;
        renderPracticeWizard();
      });
      container.querySelector('#btn-run-prac-twoback').addEventListener('click', function () {
        runPracticeTest('twoback', pCount, function (records) {
          AppState.lastPracticeStats = summarizePractice(records);
          AppState.practiceStep = 3;
          renderPracticeWizard();
        });
      });
      return;
    }

    // step === 3: all practice completed
    container.innerHTML =
      '<div class="card ready-card">' +
      '<span class="badge badge-ok">HOÀN TẤT VÒNG LÀM THỬ</span>' +
      '<h2>Bạn đã sẵn sàng bước vào Cụm đo Pre-test!</h2>' +
      feedbackBanner +
      '<p class="guide-lead">Trong phần đo chính thức sắp tới, hệ thống sẽ <strong>ẩn toàn bộ phản hồi Đúng/Sai</strong> để không làm bạn phân tâm. Ba bài kiểm tra sẽ chạy nối tiếp nhau với khoảng nghỉ ngắn giữa các bài.</p>' +
      '<div class="checklist-mini">' +
      '<div>✓ <strong>Bài 1:</strong> Stroop (' + modeCfg.stroopTrials + ' lượt) — Phím <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd></div>' +
      '<div>✓ <strong>Bài 2:</strong> Go/No-Go (' + modeCfg.gonogoTrials + ' lượt) — Phím <kbd>SPACE</kbd></div>' +
      '<div>✓ <strong>Bài 3:</strong> 2-Back (' + modeCfg.twobackTrials + ' lượt) — Phím <kbd>SPACE</kbd></div>' +
      '</div>' +
      '<div class="guide-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-retry-twoback">← Làm thử lại 2-Back</button>' +
      '<button type="button" class="btn btn-primary btn-lg" id="btn-enter-pretest">Bắt đầu Cụm đo Pre-test Chính thức →</button>' +
      '</div>' +
      '</div>';

    container.querySelector('#btn-retry-twoback').addEventListener('click', function () {
      AppState.lastPracticeStats = null;
      AppState.practiceStep = 2;
      renderPracticeWizard();
    });
    container.querySelector('#btn-enter-pretest').addEventListener('click', function () {
      enterScreen3();
    });
  }

  function summarizePractice(records) {
    const list = Array.isArray(records) ? records : [];
    const correct = list.filter((r) => r.isCorrect).length;
    return { correct: correct, total: list.length };
  }

  function runPracticeTest(testType, count, doneCb) {
    if (global.__swarmRebuild && global.__swarmRebuild.app) {
      global.__swarmRebuild.stop(false);
    }
    const wizardBox = document.getElementById('practice-wizard-box');
    const stageEl = document.getElementById('test-stage');
    if (wizardBox) wizardBox.classList.add('is-hidden');
    if (stageEl) stageEl.classList.remove('is-hidden');

    AppState.isRunningTask = true;
    updateHeaderAndStepper();

    const seed = CogLab.Utils.createFreshSeed();
    let trials;
    let label;
    if (testType === 'stroop') {
      trials = CogLab.Generators.generateStroopTrials(count, seed);
      label = 'LÀM THỬ • STROOP MÀU – CHỮ';
    } else if (testType === 'gonogo') {
      trials = CogLab.Generators.generateGoNoGoTrials(count, seed);
      label = 'LÀM THỬ • GO / NO-GO';
    } else {
      trials = CogLab.Generators.generateTwoBackTrials(count, seed);
      label = 'LÀM THỬ • 2-BACK';
    }

    CogLab.TestEngine.runTest({
      container: stageEl,
      testType: testType,
      phaseLabel: label,
      trials: trials,
      isPractice: true,
      meta: {
        participantId: AppState.session.participantId,
        group: AppState.session.group,
        mode: AppState.session.mode,
        phase: 'PRACTICE'
      },
      onComplete: function (records) {
        AppState.isRunningTask = false;
        if (stageEl) stageEl.classList.add('is-hidden');
        updateHeaderAndStepper();
        doneCb(records);
      }
    });
  }

  function runBatterySequence(options) {
    if (global.__swarmRebuild && global.__swarmRebuild.app) {
      global.__swarmRebuild.stop(false);
    }
    const {
      phase,
      phaseTitle,
      battery,
      modeConfig,
      onComplete
    } = options;

    const stageEl = document.getElementById('test-stage');
    if (!stageEl) return;
    stageEl.classList.remove('is-hidden');
    AppState.isRunningTask = true;
    updateHeaderAndStepper();

    const metaBase = {
      participantId: AppState.session.participantId,
      group: AppState.session.group,
      mode: AppState.session.mode,
      phase: phase
    };

    const collected = [];

    CogLab.TestEngine.runTest({
      container: stageEl,
      testType: 'stroop',
      phaseLabel: phaseTitle + ' • BÀI 1/3: STROOP',
      trials: battery.stroop,
      isPractice: false,
      meta: metaBase,
      onComplete: function (stroopRecords) {
        collected.push.apply(collected, stroopRecords);

        CogLab.TestEngine.runBreak({
          container: stageEl,
          seconds: modeConfig.breakSec,
          nextTestTitle: 'Bài 2/3: Go / No-Go',
          nextTestInstructions:
            'Hình tròn XANH LÁ (80%): bấm SPACE nhanh nhất có thể. Dấu X ĐỎ (20%): tuyệt đối KHÔNG bấm phím.',
          onComplete: function () {
            CogLab.TestEngine.runTest({
              container: stageEl,
              testType: 'gonogo',
              phaseLabel: phaseTitle + ' • BÀI 2/3: GO / NO-GO',
              trials: battery.gonogo,
              isPractice: false,
              meta: metaBase,
              onComplete: function (gngRecords) {
                collected.push.apply(collected, gngRecords);

                CogLab.TestEngine.runBreak({
                  container: stageEl,
                  seconds: modeConfig.breakSec,
                  nextTestTitle: 'Bài 3/3: 2-Back (Trí nhớ làm việc)',
                  nextTestInstructions:
                    'Bấm SPACE nếu chữ cái hiện tại TRÙNG với chữ cái xuất hiện cách đó đúng 2 bước (ví dụ: A – K – A).',
                  onComplete: function () {
                    CogLab.TestEngine.runTest({
                      container: stageEl,
                      testType: 'twoback',
                      phaseLabel: phaseTitle + ' • BÀI 3/3: 2-BACK',
                      trials: battery.twoback,
                      isPractice: false,
                      meta: metaBase,
                      onComplete: function (tbRecords) {
                        collected.push.apply(collected, tbRecords);
                        AppState.isRunningTask = false;
                        stageEl.classList.add('is-hidden');
                        updateHeaderAndStepper();
                        onComplete(collected);
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  function enterScreen3() {
    AppState.currentScreen = 'screen-3';
    showOnlyPanel('screen-3');
    updateHeaderAndStepper();

    const introCard = document.getElementById('pretest-intro-card');
    if (introCard) introCard.classList.remove('is-hidden');

    const startBtn = document.getElementById('btn-start-pretest-now');
    if (startBtn) {
      startBtn.onclick = function () {
        if (introCard) introCard.classList.add('is-hidden');
        const modeCfg = getModeConfig();
        runBatterySequence({
          phase: 'PRE',
          phaseTitle: 'PRE-TEST',
          battery: AppState.preBattery,
          modeConfig: modeCfg,
          onComplete: function (preRecords) {
            AppState.session.trials = AppState.session.trials.concat(preRecords);
            enterScreen4();
          }
        });
      };
    }
  }

  function enterScreen4() {
    AppState.currentScreen = 'screen-4';
    AppState.isRunningTask = false;
    showOnlyPanel('screen-4');
    updateHeaderAndStepper();

    const container = document.getElementById('intervention-container');
    const settings = getSettings();
    const modeCfg = getModeConfig();

    CogLab.Intervention.start({
      container: container,
      groupId: AppState.session.group,
      durationSec: modeCfg.interventionSec,
      settings: settings,
      onComplete: function (engagementStats) {
        AppState.session.intervention = engagementStats;
        enterScreen5Ready();
      }
    });
  }

  function enterScreen5Ready() {
    AppState.currentScreen = 'screen-5-ready';
    AppState.isRunningTask = false;
    showOnlyPanel('screen-5');
    updateHeaderAndStepper();

    const readyCard = document.getElementById('posttest-intro-card');
    const doneCard = document.getElementById('results-dashboard');
    if (readyCard) readyCard.classList.remove('is-hidden');
    if (doneCard) doneCard.classList.add('is-hidden');

    const startBtn = document.getElementById('btn-start-posttest-now');
    if (startBtn) {
      startBtn.onclick = function () {
        if (readyCard) readyCard.classList.add('is-hidden');
        AppState.currentScreen = 'screen-5-testing';
        const modeCfg = getModeConfig();
        AppState.postBattery = CogLab.Generators.generateBattery(modeCfg, AppState.preBattery);

        runBatterySequence({
          phase: 'POST',
          phaseTitle: 'POST-TEST',
          battery: AppState.postBattery,
          modeConfig: modeCfg,
          onComplete: function (postRecords) {
            finalizeSession(postRecords);
          }
        });
      };
    }
  }

  async function finalizeSession(postRecords) {
    const session = AppState.session;
    session.trials = session.trials.concat(postRecords);
    session.completedAt = new Date().toISOString();
    session.summary = CogLab.Metrics.computeSessionSummary(session);

    CogLab.Storage.saveSession(session);

    AppState.currentScreen = 'screen-5-done';
    AppState.isRunningTask = false;
    showOnlyPanel('screen-5');
    updateHeaderAndStepper();

    const readyCard = document.getElementById('posttest-intro-card');
    const doneCard = document.getElementById('results-dashboard');
    if (readyCard) readyCard.classList.add('is-hidden');
    if (doneCard) doneCard.classList.remove('is-hidden');

    renderResultsDashboard(session);

    const settings = getSettings();
    const syncBanner = document.getElementById('res-sync-banner');
    if (syncBanner) {
      syncBanner.innerHTML = '<span class="badge badge-info">Đang gửi dữ liệu lên Google Sheets...</span>';
    }

    const syncResult = await CogLab.Storage.syncToGoogleSheets(session, settings.sheetsWebhookUrl);
    renderSyncBanner(syncResult, session);
  }

  function renderSyncBanner(syncResult, session) {
    const syncBanner = document.getElementById('res-sync-banner');
    if (!syncBanner) return;

    if (syncResult.ok) {
      syncBanner.innerHTML =
        '<div class="sync-alert is-ok">✅ ' + CogLab.Utils.escapeHtml(syncResult.message) + '</div>';
    } else if (syncResult.skipped) {
      syncBanner.innerHTML =
        '<div class="sync-alert is-muted">💾 Đã lưu an toàn vào bộ nhớ máy trạm. (' +
        CogLab.Utils.escapeHtml(syncResult.message) +
        ')</div>';
    } else {
      syncBanner.innerHTML =
        '<div class="sync-alert is-warn">⚠️ ' +
        CogLab.Utils.escapeHtml(syncResult.message) +
        ' <button type="button" class="btn btn-secondary btn-sm" id="btn-retry-sync">Thử đồng bộ lại</button></div>';
      const retryBtn = syncBanner.querySelector('#btn-retry-sync');
      if (retryBtn) {
        retryBtn.addEventListener('click', async function () {
          retryBtn.disabled = true;
          const settings = getSettings();
          const res = await CogLab.Storage.syncToGoogleSheets(session, settings.sheetsWebhookUrl);
          renderSyncBanner(res, session);
        });
      }
    }
  }

  function renderResultsDashboard(session) {
    const Utils = CogLab.Utils;
    const sum = session.summary;
    const grp = CogLab.Config.GROUPS[session.group];
    const doneCard = document.getElementById('results-dashboard');
    if (!doneCard) return;

    const rows = [
      {
        test: '1. Stroop',
        metric: 'RT câu Khớp (Congruent)',
        pre: Utils.formatMetric(sum.pre.stroop.rtCongruentMs, 1, 'ms'),
        post: Utils.formatMetric(sum.post.stroop.rtCongruentMs, 1, 'ms'),
        delta: Utils.formatDelta(
          sum.post.stroop.rtCongruentMs != null && sum.pre.stroop.rtCongruentMs != null
            ? sum.post.stroop.rtCongruentMs - sum.pre.stroop.rtCongruentMs
            : null,
          1,
          'ms',
          true
        )
      },
      {
        test: '1. Stroop',
        metric: 'RT câu Không khớp (Incongruent)',
        pre: Utils.formatMetric(sum.pre.stroop.rtIncongruentMs, 1, 'ms'),
        post: Utils.formatMetric(sum.post.stroop.rtIncongruentMs, 1, 'ms'),
        delta: Utils.formatDelta(
          sum.post.stroop.rtIncongruentMs != null && sum.pre.stroop.rtIncongruentMs != null
            ? sum.post.stroop.rtIncongruentMs - sum.pre.stroop.rtIncongruentMs
            : null,
          1,
          'ms',
          true
        )
      },
      {
        test: '1. Stroop',
        metric: 'Hiệu ứng nhiễu Stroop (Incong − Cong)',
        highlight: true,
        pre: Utils.formatMetric(sum.pre.stroop.interferenceMs, 1, 'ms'),
        post: Utils.formatMetric(sum.post.stroop.interferenceMs, 1, 'ms'),
        delta: Utils.formatDelta(sum.delta.stroop_interference_ms, 1, 'ms', true)
      },
      {
        test: '1. Stroop',
        metric: 'Độ chính xác Stroop (%)',
        pre: Utils.formatMetric(sum.pre.stroop.accuracyPct, 1, '%'),
        post: Utils.formatMetric(sum.post.stroop.accuracyPct, 1, '%'),
        delta: Utils.formatDelta(sum.delta.stroop_accuracy_pct, 1, '%', false)
      },
      {
        test: '2. Go/No-Go',
        metric: 'Lỗi bấm nhầm (Commission Error %)',
        highlight: true,
        pre: Utils.formatMetric(sum.pre.gonogo.commissionErrorPct, 1, '%'),
        post: Utils.formatMetric(sum.post.gonogo.commissionErrorPct, 1, '%'),
        delta: Utils.formatDelta(sum.delta.gonogo_commission_pct, 1, '%', true)
      },
      {
        test: '2. Go/No-Go',
        metric: 'Lỗi bỏ sót (Omission Error %)',
        pre: Utils.formatMetric(sum.pre.gonogo.omissionErrorPct, 1, '%'),
        post: Utils.formatMetric(sum.post.gonogo.omissionErrorPct, 1, '%'),
        delta: Utils.formatDelta(sum.delta.gonogo_omission_pct, 1, '%', true)
      },
      {
        test: '2. Go/No-Go',
        metric: 'RT trung bình Go (ms)',
        pre: Utils.formatMetric(sum.pre.gonogo.meanRtMs, 1, 'ms'),
        post: Utils.formatMetric(sum.post.gonogo.meanRtMs, 1, 'ms'),
        delta: Utils.formatDelta(sum.delta.gonogo_mean_rt_ms, 1, 'ms', true)
      },
      {
        test: '2. Go/No-Go',
        metric: 'Độ dao động phản xạ SD_RT (ms)',
        highlight: true,
        pre: Utils.formatMetric(sum.pre.gonogo.sdRtMs, 1, 'ms'),
        post: Utils.formatMetric(sum.post.gonogo.sdRtMs, 1, 'ms'),
        delta: Utils.formatDelta(sum.delta.gonogo_sd_rt_ms, 1, 'ms', true)
      },
      {
        test: '3. 2-Back',
        metric: 'Độ chính xác tổng thể (%)',
        highlight: true,
        pre: Utils.formatMetric(sum.pre.twoback.accuracyPct, 1, '%'),
        post: Utils.formatMetric(sum.post.twoback.accuracyPct, 1, '%'),
        delta: Utils.formatDelta(sum.delta.twoback_accuracy_pct, 1, '%', false)
      },
      {
        test: '3. 2-Back',
        metric: 'Nhận đúng mục tiêu (Hit Rate %)',
        pre: Utils.formatMetric(sum.pre.twoback.hitRatePct, 1, '%'),
        post: Utils.formatMetric(sum.post.twoback.hitRatePct, 1, '%'),
        delta: Utils.formatDelta(sum.delta.twoback_hit_pct, 1, '%', false)
      },
      {
        test: '3. 2-Back',
        metric: 'Báo nhầm (False Alarm %)',
        pre: Utils.formatMetric(sum.pre.twoback.faRatePct, 1, '%'),
        post: Utils.formatMetric(sum.post.twoback.faRatePct, 1, '%'),
        delta: Utils.formatDelta(sum.delta.twoback_fa_pct, 1, '%', true)
      },
      {
        test: '3. 2-Back',
        metric: "Chỉ số độ nhạy tín hiệu d' = Z(Hit) − Z(FA)",
        highlight: true,
        pre: Utils.formatMetric(sum.pre.twoback.dPrime, 2, ''),
        post: Utils.formatMetric(sum.post.twoback.dPrime, 2, ''),
        delta: Utils.formatDelta(sum.delta.twoback_dprime, 2, '', false)
      }
    ];

    const tableRowsHtml = rows
      .map(function (r) {
        return (
          '<tr class="' +
          (r.highlight ? 'is-key-metric' : '') +
          '">' +
          '<td>' + Utils.escapeHtml(r.test) + '</td>' +
          '<td>' + Utils.escapeHtml(r.metric) + '</td>' +
          '<td class="mono">' + Utils.escapeHtml(r.pre) + '</td>' +
          '<td class="mono">' + Utils.escapeHtml(r.post) + '</td>' +
          '<td class="mono ' + r.delta.cls + '">' + Utils.escapeHtml(r.delta.text) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    const kpiStroopDelta = Utils.formatDelta(sum.delta.stroop_interference_ms, 1, 'ms', true);
    const kpiGngDelta = Utils.formatDelta(sum.delta.gonogo_commission_pct, 1, '%', true);
    const kpiDPrimeDelta = Utils.formatDelta(sum.delta.twoback_dprime, 2, '', false);

    const kpiGridHtml =
      '<div class="kpi-grid">' +
      '<div class="kpi-card">' +
      '<span class="kpi-label">Hiệu ứng nhiễu Stroop</span>' +
      '<div class="kpi-values">' +
      '<span class="kpi-pre-post">' + Utils.escapeHtml(Utils.formatMetric(sum.pre.stroop.interferenceMs, 1, 'ms')) +
      ' → ' + Utils.escapeHtml(Utils.formatMetric(sum.post.stroop.interferenceMs, 1, 'ms')) + '</span>' +
      '<span class="kpi-delta-pill ' + kpiStroopDelta.cls + '">' + Utils.escapeHtml(kpiStroopDelta.text) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="kpi-card">' +
      '<span class="kpi-label">Lỗi bấm nhầm Go/No-Go</span>' +
      '<div class="kpi-values">' +
      '<span class="kpi-pre-post">' + Utils.escapeHtml(Utils.formatMetric(sum.pre.gonogo.commissionErrorPct, 1, '%')) +
      ' → ' + Utils.escapeHtml(Utils.formatMetric(sum.post.gonogo.commissionErrorPct, 1, '%')) + '</span>' +
      '<span class="kpi-delta-pill ' + kpiGngDelta.cls + '">' + Utils.escapeHtml(kpiGngDelta.text) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="kpi-card">' +
      '<span class="kpi-label">Độ nhạy trí nhớ 2-Back (d\')</span>' +
      '<div class="kpi-values">' +
      '<span class="kpi-pre-post">' + Utils.escapeHtml(Utils.formatMetric(sum.pre.twoback.dPrime, 2, '')) +
      ' → ' + Utils.escapeHtml(Utils.formatMetric(sum.post.twoback.dPrime, 2, '')) + '</span>' +
      '<span class="kpi-delta-pill ' + kpiDPrimeDelta.cls + '">' + Utils.escapeHtml(kpiDPrimeDelta.text) + '</span>' +
      '</div>' +
      '</div>' +
      '</div>';

    const chartSpecs = [
      { label: 'Nhiễu Stroop (ms)', pre: sum.pre.stroop.interferenceMs, post: sum.post.stroop.interferenceMs, dec: 1, unit: ' ms' },
      { label: 'RT Stroop không khớp (ms)', pre: sum.pre.stroop.rtIncongruentMs, post: sum.post.stroop.rtIncongruentMs, dec: 1, unit: ' ms' },
      { label: 'Lỗi bấm nhầm Go/No-Go (%)', pre: sum.pre.gonogo.commissionErrorPct, post: sum.post.gonogo.commissionErrorPct, dec: 1, unit: '%' },
      { label: 'Độ nhạy trí nhớ 2-Back (d\')', pre: sum.pre.twoback.dPrime, post: sum.post.twoback.dPrime, dec: 2, unit: '' }
    ];
    const chartRowsHtml = chartSpecs
      .map(function (item) {
        const preV = typeof item.pre === 'number' && Number.isFinite(item.pre) ? item.pre : null;
        const postV = typeof item.post === 'number' && Number.isFinite(item.post) ? item.post : null;
        const scaleMax = Math.max(1, Math.abs(preV || 0), Math.abs(postV || 0)) * 1.12;
        const prePct = preV === null ? 0 : Math.min(100, Math.max(4, (Math.max(0, preV) / scaleMax) * 100));
        const postPct = postV === null ? 0 : Math.min(100, Math.max(4, (Math.max(0, postV) / scaleMax) * 100));
        return (
          '<div class="rc-row">' +
          '<div class="rc-label">' + Utils.escapeHtml(item.label) + '</div>' +
          '<div class="rc-bars">' +
          '<div class="rc-bar-line">' +
          '<span class="rc-tag">Pre</span>' +
          '<div class="rc-bar-track"><div class="rc-bar-fill rc-bar-pre" style="width:' + prePct.toFixed(1) + '%"></div></div>' +
          '<span class="rc-val">' + Utils.escapeHtml(Utils.formatMetric(preV, item.dec, item.unit)) + '</span>' +
          '</div>' +
          '<div class="rc-bar-line">' +
          '<span class="rc-tag">Post</span>' +
          '<div class="rc-bar-track"><div class="rc-bar-fill rc-bar-post" style="width:' + postPct.toFixed(1) + '%"></div></div>' +
          '<span class="rc-val">' + Utils.escapeHtml(Utils.formatMetric(postV, item.dec, item.unit)) + '</span>' +
          '</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    const resultsChartHtml =
      '<div class="results-chart-card">' +
      '<div class="rc-head">' +
      '<h3>Biểu đồ so sánh trực quan Pre-test vs Post-test</h3>' +
      '<div class="rc-legend">' +
      '<span><i class="rc-dot rc-dot-pre"></i>Pre-test</span>' +
      '<span><i class="rc-dot rc-dot-post"></i>Post-test</span>' +
      '</div>' +
      '</div>' +
      '<div class="rc-rows">' + chartRowsHtml + '</div>' +
      '</div>';

    doneCard.innerHTML =
      '<div class="card">' +
      '<div class="results-header">' +
      '<div>' +
      '<span class="badge badge-ok">HOÀN THÀNH PHIÊN ĐO</span>' +
      '<h2>Kết quả Nhận thức Pre-test &amp; Post-test</h2>' +
      '<p class="res-subline">Mã học sinh: <code>' + Utils.escapeHtml(session.participantId) + '</code> • ' +
      Utils.escapeHtml(grp ? grp.name : 'Nhóm ' + session.group) +
      ' • Chế độ: <strong>' + Utils.escapeHtml(session.mode) + '</strong></p>' +
      '</div>' +
      '<div class="outlier-chip">' +
      '<span>Lượt ngoại lai (&lt;150ms / &gt;2000ms)</span>' +
      '<strong>' + sum.outliers.totalOutliers + ' / ' + sum.outliers.totalExpTrials + ' (' + sum.outliers.totalOutlierPct.toFixed(1) + '%)</strong>' +
      '</div>' +
      '</div>' +
      '<div id="res-sync-banner"></div>' +
      kpiGridHtml +
      resultsChartHtml +
      '<div class="table-wrap">' +
      '<table class="data-table">' +
      '<thead><tr><th>Bài test</th><th>Chỉ số định lượng</th><th>Pre-test</th><th>Post-test</th><th>Δ (Post − Pre)</th></tr></thead>' +
      '<tbody>' + tableRowsHtml + '</tbody>' +
      '</table>' +
      '</div>' +
      '<div class="results-actions">' +
      '<button type="button" class="btn btn-primary" id="btn-dl-this-summary">⬇ Tải CSV phiên này (JASP)</button>' +
      '<button type="button" class="btn btn-secondary" id="btn-dl-all-summary">⬇ Tải CSV toàn bộ máy trạm (JASP)</button>' +
      '<button type="button" class="btn btn-secondary" id="btn-dl-this-raw">⬇ Tải CSV chi tiết lượt bấm (Raw)</button>' +
      '<button type="button" class="btn btn-secondary" id="btn-print-results">🖨 In / Lưu PDF Phiếu kết quả</button>' +
      '<button type="button" class="btn btn-secondary" id="btn-open-archive">📊 Xem Kho dữ liệu máy trạm</button>' +
      '<button type="button" class="btn btn-secondary" id="btn-back-home-done">← Về Trang chủ</button>' +
      '<button type="button" class="btn btn-accent" id="btn-next-student">↻ Bắt đầu học sinh tiếp theo</button>' +
      '</div>' +
      '</div>';

    doneCard.querySelector('#btn-dl-this-summary').addEventListener('click', function () {
      CogLab.Storage.downloadSummaryCsv([session], 'VISEF_' + session.participantId + '_Summary.csv');
    });
    doneCard.querySelector('#btn-dl-all-summary').addEventListener('click', function () {
      CogLab.Storage.downloadSummaryCsv(CogLab.Storage.loadSessions(), 'VISEF_All_Summary_JASP.csv');
    });
    doneCard.querySelector('#btn-dl-this-raw').addEventListener('click', function () {
      CogLab.Storage.downloadRawTrialsCsv([session], 'VISEF_' + session.participantId + '_RawTrials.csv');
    });
    doneCard.querySelector('#btn-print-results').addEventListener('click', function () {
      global.print();
    });
    doneCard.querySelector('#btn-open-archive').addEventListener('click', function () {
      CogLab.Researcher.open('data');
    });
    doneCard.querySelector('#btn-back-home-done').addEventListener('click', function () {
      enterHome();
    });
    doneCard.querySelector('#btn-next-student').addEventListener('click', function () {
      resetToScreen1();
    });
  }

  function clearSessionState() {
    CogLab.TestEngine.abort();
    CogLab.Intervention.cleanup();
    AppState.session = null;
    AppState.preBattery = null;
    AppState.postBattery = null;
    AppState.practiceStep = 0;
    AppState.lastPracticeStats = null;
    AppState.isRunningTask = false;

    const form = document.getElementById('screen1-form');
    if (form) form.reset();
    document.querySelectorAll('.alertness-btn').forEach(function (b) {
      b.classList.remove('is-selected');
    });
    const alertInput = document.getElementById('input-alertness');
    if (alertInput) alertInput.value = '';
    const errBox = document.getElementById('s1-error');
    if (errBox) errBox.classList.add('is-hidden');

    const stageEl = document.getElementById('test-stage');
    if (stageEl) {
      stageEl.classList.add('is-hidden');
      stageEl.innerHTML = '';
    }
    updateHabitPreview();
  }

  function enterHome() {
    clearSessionState();
    AppState.currentScreen = 'screen-home';
    showOnlyPanel('screen-home');
    updateHeaderAndStepper();
    global.scrollTo(0, 0);
    if (CogLab.SmoothScroll) CogLab.SmoothScroll.start();
    if (CogLab.HomeInteractive) CogLab.HomeInteractive.start();
    if (CogLab.PrismCanvas && !(global.__swarmRebuild && global.__swarmRebuild.app)) {
      CogLab.PrismCanvas.start();
    }
  }

  function enterScreen1() {
    if (CogLab.HomeInteractive) CogLab.HomeInteractive.stop();
    if (CogLab.PrismCanvas) CogLab.PrismCanvas.stop();
    if (CogLab.SmoothScroll) CogLab.SmoothScroll.stop();
    AppState.currentScreen = 'screen-1';
    showOnlyPanel('screen-1');
    updateHeaderAndStepper();
    global.scrollTo(0, 0);
  }

  function resetToScreen1() {
    if (CogLab.HomeInteractive) CogLab.HomeInteractive.stop();
    if (CogLab.PrismCanvas) CogLab.PrismCanvas.stop();
    if (CogLab.SmoothScroll) CogLab.SmoothScroll.stop();
    clearSessionState();
    AppState.currentScreen = 'screen-1';
    showOnlyPanel('screen-1');
    updateHeaderAndStepper();
  }

  function bindGlobalControls() {
    const homeStartBtn = document.getElementById('btn-home-start');
    if (homeStartBtn) {
      homeStartBtn.addEventListener('click', function () {
        enterScreen1();
      });
    }

    const homeStartBottomBtn = document.getElementById('btn-home-start-bottom');
    if (homeStartBottomBtn) {
      homeStartBottomBtn.addEventListener('click', function () {
        enterScreen1();
      });
    }

    const scrollDownBtn = document.getElementById('btn-scroll-down');
    if (scrollDownBtn) {
      scrollDownBtn.addEventListener('click', function () {
        if (CogLab.SmoothScroll) {
          CogLab.SmoothScroll.scrollToSpotlightPeak(920);
        }
      });
    }

    const scrollTopBtn = document.getElementById('btn-scroll-top');
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function () {
        if (CogLab.SmoothScroll) {
          CogLab.SmoothScroll.scrollToY(0, 880);
        }
      });
    }

    const navStartBtn = document.getElementById('nav-start-btn');
    if (navStartBtn) {
      navStartBtn.addEventListener('click', function () {
        enterScreen1();
      });
    }

    const navLabLink = document.getElementById('nav-lab-link');
    if (navLabLink) {
      navLabLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (CogLab.SmoothScroll) {
          CogLab.SmoothScroll.scrollToSpotlightPeak(900);
        }
      });
    }

    document.querySelectorAll('#home-scroll-nav .scroll-dot-btn').forEach(function (dotBtn) {
      dotBtn.addEventListener('click', function () {
        if (CogLab.SmoothScroll && dotBtn.dataset.target) {
          CogLab.SmoothScroll.scrollToElement(dotBtn.dataset.target, 880);
        }
      });
    });

    const navTestsLink = document.getElementById('nav-tests-link');
    if (navTestsLink) {
      navTestsLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (CogLab.SmoothScroll) {
          CogLab.SmoothScroll.scrollToElement('#home-tests-section', 880);
        }
      });
    }

    const navDesignLink = document.getElementById('nav-design-link');
    if (navDesignLink) {
      navDesignLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (CogLab.SmoothScroll) {
          CogLab.SmoothScroll.scrollToElement('#home-design-section', 920);
        }
      });
    }

    const homeBtn = document.getElementById('hdr-home-btn');
    if (homeBtn) {
      homeBtn.addEventListener('click', function () {
        if (!homeBtn.disabled) enterHome();
      });
    }

    const brandHome = document.getElementById('hdr-brand-home');
    if (brandHome) {
      const goBrandHome = function () {
        if (
          !AppState.isRunningTask &&
          (AppState.currentScreen === 'screen-home' ||
            AppState.currentScreen === 'screen-1' ||
            AppState.currentScreen === 'screen-5-done')
        ) {
          enterHome();
        }
      };
      brandHome.addEventListener('click', goBrandHome);
      brandHome.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goBrandHome();
        }
      });
    }

    const replayIntroBtn = document.getElementById('hdr-replay-intro-btn');
    if (replayIntroBtn) {
      replayIntroBtn.addEventListener('click', function () {
        if (!replayIntroBtn.disabled && global.__swarmRebuild) {
          global.scrollTo(0, 0);
          global.__swarmRebuild.start();
        }
      });
    }

    global.addEventListener('coglab:swarm-done', function () {
      if (CogLab.PrismCanvas && AppState.currentScreen === 'screen-home') {
        CogLab.PrismCanvas.start();
      }
      const brandMark = document.querySelector('#hdr-brand-home .brand-mark');
      if (brandMark) {
        brandMark.classList.remove('is-logo-charged');
        void brandMark.offsetWidth;
        brandMark.classList.add('is-logo-charged');
        global.setTimeout(function () {
          brandMark.classList.remove('is-logo-charged');
        }, 700);
      }
    });

    const diagAdminBtn = document.getElementById('btn-diag-open-admin');
    if (diagAdminBtn) {
      diagAdminBtn.addEventListener('click', function () {
        if (!AppState.isRunningTask) {
          CogLab.Researcher.open('data');
        }
      });
    }

    const resBtn = document.getElementById('hdr-researcher-btn');
    if (resBtn) {
      resBtn.addEventListener('click', function () {
        if (!resBtn.disabled) {
          CogLab.Researcher.open('settings');
        }
      });
    }

    const withdrawBtn = document.getElementById('hdr-withdraw-btn');
    if (withdrawBtn) {
      withdrawBtn.addEventListener('click', function () {
        const ok = global.confirm(
          'Bạn có chắc muốn dừng và rút lui khỏi phiên thực nghiệm này? Dữ liệu chưa hoàn tất sẽ không được lưu.'
        );
        if (ok) {
          resetToScreen1();
        }
      });
    }
  }

  function bootstrap() {
    CogLab.Researcher.init({
      onSettingsChanged: function () {
        updateHeaderAndStepper();
      }
    });
    if (CogLab.SmoothScroll) CogLab.SmoothScroll.init();
    initScreen1();
    bindGlobalControls();
    enterHome();
    global.setTimeout(function () {
      const cur = document.getElementById('boot-white-curtain');
      if (cur && !(global.__swarmRebuild && global.__swarmRebuild.app)) cur.remove();
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  CogLab.App = {
    enterHome,
    enterScreen1,
    resetToScreen1,
    getState: function () {
      return AppState;
    }
  };
})(window);
