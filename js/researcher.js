(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  let modalEl = null;
  let activeTab = 'settings';
  let onSettingsChangedCb = null;

  function parseListInput(raw) {
    return String(raw || '')
      .split(/[\n,]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function formatMeanVal(arr, decimals, suffix) {
    const m = CogLab.Utils.mean(arr);
    if (m === null) return '—';
    const sign = m > 0 ? '+' : '';
    return sign + m.toFixed(decimals) + (suffix || '');
  }

  function buildSettingsTabHtml(settings) {
    const mode = settings.mode || 'OFFICIAL';
    const forced = String(settings.forcedGroup || 'AUTO');
    const sound = settings.soundEnabled !== false;

    return (
      '<div class="res-section">' +
      '<h4>Chế độ Thực nghiệm</h4>' +
      '<p class="res-hint">Chọn chế độ Chính thức khi đo học sinh tại phòng máy tính trường, hoặc chế độ Demo khi thuyết trình trước Hội đồng KHKT.</p>' +
      '<div class="res-radio-cards">' +
      '<label class="res-radio-card ' + (mode === 'OFFICIAL' ? 'is-selected' : '') + '">' +
      '<input type="radio" name="res-mode" value="OFFICIAL" ' + (mode === 'OFFICIAL' ? 'checked' : '') + ' />' +
      '<div>' +
      '<strong>Chính thức (Phòng Lab — 1 tiết 45 phút)</strong>' +
      '<span>40 Stroop • 60 Go/No-Go • 40 2-Back • Làm thử 6 lượt • Nghỉ 20s • Can thiệp 600s (10 phút)</span>' +
      '</div>' +
      '</label>' +
      '<label class="res-radio-card ' + (mode === 'DEMO' ? 'is-selected' : '') + '">' +
      '<input type="radio" name="res-mode" value="DEMO" ' + (mode === 'DEMO' ? 'checked' : '') + ' />' +
      '<div>' +
      '<strong>Thử nghiệm / Demo Hội đồng (~3 phút)</strong>' +
      '<span>8 Stroop • 12 Go/No-Go • 10 2-Back • Làm thử 4 lượt • Nghỉ 5s • Can thiệp 20s</span>' +
      '</div>' +
      '</label>' +
      '</div>' +
      '</div>' +
      '<div class="res-section">' +
      '<h4>Phân nhóm thực nghiệm</h4>' +
      '<p class="res-hint">Mặc định hệ thống tự phân nhóm theo khối hoán vị cân bằng (30/30/30). Chỉ khóa nhóm cố định khi cần kiểm thử một nhóm cụ thể.</p>' +
      '<select id="res-forced-group" class="input">' +
      '<option value="AUTO" ' + (forced === 'AUTO' ? 'selected' : '') + '>Tự động cân bằng (Khuyến nghị — Chuẩn RCT)</option>' +
      '<option value="1" ' + (forced === '1' ? 'selected' : '') + '>Khóa Nhóm 1: Thực nghiệm (Video ngắn)</option>' +
      '<option value="2" ' + (forced === '2' ? 'selected' : '') + '>Khóa Nhóm 2: Đối chứng chủ động (Đọc văn bản)</option>' +
      '<option value="3" ' + (forced === '3' ? 'selected' : '') + '>Khóa Nhóm 3: Đối chứng thụ động (Nghỉ ngơi)</option>' +
      '</select>' +
      '</div>' +
      '<div class="res-section">' +
      '<label class="checkbox-row">' +
      '<input type="checkbox" id="res-sound-enabled" ' + (sound ? 'checked' : '') + ' />' +
      '<span>Phát âm báo nhẹ (Web Audio) khi kết thúc giai đoạn can thiệp 10 phút</span>' +
      '</label>' +
      '</div>' +
      '<div class="res-actions-bar">' +
      '<button type="button" class="btn btn-primary" id="res-save-settings-btn">Lưu cài đặt</button>' +
      '<span class="res-status-msg" id="res-settings-msg"></span>' +
      '</div>'
    );
  }

  function buildIntegrationsTabHtml(settings) {
    const Utils = CogLab.Utils;
    const src = settings.videoSourceType || 'BUILTIN';
    const ytText = (settings.youtubeIds || []).join('\n');
    const mp4Text = (settings.customVideoUrls || []).join('\n');

    return (
      '<div class="res-section">' +
      '<h4>Kết nối Google Sheets (Google Apps Script Webhook)</h4>' +
      '<p class="res-hint">Dán URL Web App sau khi triển khai file <code>google-apps-script/Code.gs</code>. Dữ liệu vẫn luôn được lưu cục bộ và xuất .CSV ngay cả khi chưa nhập URL.</p>' +
      '<div class="res-inline-row">' +
      '<input type="url" id="res-webhook-url" class="input" placeholder="https://script.google.com/macros/s/.../exec" value="' + Utils.escapeHtml(settings.sheetsWebhookUrl || '') + '" />' +
      '<button type="button" class="btn btn-secondary" id="res-ping-btn">Kiểm tra kết nối</button>' +
      '</div>' +
      '<div class="res-status-msg" id="res-ping-msg"></div>' +
      '</div>' +
      '<div class="res-section">' +
      '<h4>Nguồn Video ngắn cho Nhóm 1</h4>' +
      '<select id="res-video-source" class="input">' +
      '<option value="BUILTIN" ' + (src === 'BUILTIN' ? 'selected' : '') + '>Tích hợp sẵn (20 clip khoa học nhanh — Chạy Offline ổn định 100%)</option>' +
      '<option value="YOUTUBE" ' + (src === 'YOUTUBE' ? 'selected' : '') + '>YouTube Shorts (Nhập danh sách Video ID)</option>' +
      '<option value="MP4" ' + (src === 'MP4' ? 'selected' : '') + '>File / URL MP4 cục bộ hoặc nội bộ</option>' +
      '</select>' +
      '<div class="res-subbox ' + (src === 'YOUTUBE' ? '' : 'is-hidden') + '" id="res-yt-box">' +
      '<label class="field-label">Danh sách YouTube Video ID (mỗi dòng 1 ID, ví dụ: dQw4w9WgXcQ)</label>' +
      '<textarea id="res-yt-ids" class="input textarea" rows="3" placeholder="Mỗi dòng 1 ID...">' + Utils.escapeHtml(ytText) + '</textarea>' +
      '</div>' +
      '<div class="res-subbox ' + (src === 'MP4' ? '' : 'is-hidden') + '" id="res-mp4-box">' +
      '<label class="field-label">Danh sách đường dẫn MP4 (mỗi dòng 1 URL hoặc đường dẫn tương đối)</label>' +
      '<textarea id="res-mp4-urls" class="input textarea" rows="3" placeholder="assets/videos/clip1.mp4">' + Utils.escapeHtml(mp4Text) + '</textarea>' +
      '</div>' +
      '</div>' +
      '<div class="res-actions-bar">' +
      '<button type="button" class="btn btn-primary" id="res-save-int-btn">Lưu cấu hình kết nối &amp; video</button>' +
      '<span class="res-status-msg" id="res-int-msg"></span>' +
      '</div>'
    );
  }

  function buildDataTabHtml() {
    const Utils = CogLab.Utils;
    const Config = CogLab.Config;
    const sessions = CogLab.Storage.loadSessions();

    const official = sessions.filter((s) => s.mode === 'OFFICIAL');
    const demo = sessions.filter((s) => s.mode === 'DEMO');
    const target = Config.TARGET_PER_GROUP;

    const g1Off = official.filter((s) => s.group === 1).length;
    const g2Off = official.filter((s) => s.group === 2).length;
    const g3Off = official.filter((s) => s.group === 3).length;

    const statSource = official.length > 0 ? official : sessions;
    const statScopeLabel = official.length > 0 ? 'Mẫu Chính thức (Official)' : 'Tất cả mẫu hiện có (bao gồm Demo)';

    const groupMeans = [1, 2, 3].map(function (gid) {
      const sub = statSource.filter((s) => s.group === gid);
      const stroopM = CogLab.Utils.mean(sub.map((s) => s.summary && s.summary.delta.stroop_interference_ms));
      const dPrimeM = CogLab.Utils.mean(sub.map((s) => s.summary && s.summary.delta.twoback_dprime));
      return { gid: gid, name: Config.GROUPS[gid].shortName, n: sub.length, stroopM: stroopM, dPrimeM: dPrimeM };
    });

    const maxStroopAbs = Math.max(
      20,
      ...groupMeans.map((g) => (typeof g.stroopM === 'number' ? Math.abs(g.stroopM) : 0))
    );
    const groupChartRows = groupMeans
      .map(function (g) {
        const wPct = g.stroopM != null ? Math.min(100, Math.max(6, (Math.abs(g.stroopM) / maxStroopAbs) * 100)) : 0;
        const valText =
          (g.stroopM != null ? (g.stroopM > 0 ? '+' : '') + g.stroopM.toFixed(1) + ' ms' : '—') +
          '  |  d\': ' +
          (g.dPrimeM != null ? (g.dPrimeM > 0 ? '+' : '') + g.dPrimeM.toFixed(2) : '—');
        return (
          '<div class="rgc-row">' +
          '<span class="rgc-name">' + Utils.escapeHtml(g.name) + ' (' + g.n + ')</span>' +
          '<div class="rgc-bar-track"><div class="rgc-bar rgc-g' + g.gid + '" style="width:' + wPct.toFixed(1) + '%"></div></div>' +
          '<span class="rgc-val">' + Utils.escapeHtml(valText) + '</span>' +
          '</div>'
        );
      })
      .join('');
    const groupChartHtml =
      '<div class="res-group-chart">' +
      '<div class="rgc-head">Biểu đồ nhanh Δ Nhiễu Stroop &amp; Δ d\' giữa 3 nhóm</div>' +
      groupChartRows +
      '</div>';

    const groupStatsRows = [1, 2, 3]
      .map(function (gid) {
        const sub = statSource.filter((s) => s.group === gid);
        const dStroop = sub.map((s) => s.summary && s.summary.delta.stroop_interference_ms);
        const dCom = sub.map((s) => s.summary && s.summary.delta.gonogo_commission_pct);
        const d2Acc = sub.map((s) => s.summary && s.summary.delta.twoback_accuracy_pct);
        const d2D = sub.map((s) => s.summary && s.summary.delta.twoback_dprime);
        return (
          '<tr>' +
          '<td>' + Utils.escapeHtml(Config.GROUPS[gid].shortName) + '</td>' +
          '<td><strong>' + sub.length + '</strong></td>' +
          '<td>' + formatMeanVal(dStroop, 1, ' ms') + '</td>' +
          '<td>' + formatMeanVal(dCom, 1, '%') + '</td>' +
          '<td>' + formatMeanVal(d2Acc, 1, '%') + '</td>' +
          '<td>' + formatMeanVal(d2D, 2, '') + '</td>' +
          '</tr>'
        );
      })
      .join('');

    const sessionRows = sessions.length
      ? sessions
          .slice()
          .reverse()
          .map(function (s) {
            const sum = s.summary || CogLab.Metrics.computeSessionSummary(s);
            const gShort = Config.GROUPS[s.group] ? Config.GROUPS[s.group].shortName : String(s.group);
            const dS = sum.delta.stroop_interference_ms;
            const dC = sum.delta.gonogo_commission_pct;
            const dD = sum.delta.twoback_dprime;
            return (
              '<tr>' +
              '<td><code>' + Utils.escapeHtml(s.participantId) + '</code></td>' +
              '<td><span class="badge ' + (s.mode === 'OFFICIAL' ? 'badge-info' : 'badge-warn') + '">' + Utils.escapeHtml(s.mode) + '</span></td>' +
              '<td>' + Utils.escapeHtml(gShort) + '</td>' +
              '<td>' + (dS != null ? (dS > 0 ? '+' : '') + dS.toFixed(1) + ' ms' : '—') + '</td>' +
              '<td>' + (dC != null ? (dC > 0 ? '+' : '') + dC.toFixed(1) + '%' : '—') + '</td>' +
              '<td>' + (dD != null ? (dD > 0 ? '+' : '') + dD.toFixed(2) : '—') + '</td>' +
              '<td>' + sum.outliers.totalOutlierPct.toFixed(1) + '%</td>' +
              '<td>' + (s.syncedToSheets ? '<span class="badge badge-ok">Đã đồng bộ</span>' : '<span class="badge badge-muted">Cục bộ</span>') + '</td>' +
              '</tr>'
            );
          })
          .join('')
      : '<tr><td colspan="8" class="empty-cell">Chưa có phiên đo hoàn chỉnh nào lưu trên máy trạm này.</td></tr>';

    return (
      '<div class="res-section">' +
      '<h4>Tiến độ Cỡ mẫu Chính thức (Mục tiêu 90 HS = 30/30/30)</h4>' +
      '<div class="balance-grid">' +
      '<div class="balance-card"><span>Nhóm 1 (Video ngắn)</span><strong>' + g1Off + ' / ' + target + '</strong><div class="balance-bar"><div class="balance-bar-fill" style="width:' + Math.min(100, Math.round((g1Off / target) * 100)) + '%"></div></div></div>' +
      '<div class="balance-card"><span>Nhóm 2 (Đọc văn bản)</span><strong>' + g2Off + ' / ' + target + '</strong><div class="balance-bar"><div class="balance-bar-fill" style="width:' + Math.min(100, Math.round((g2Off / target) * 100)) + '%"></div></div></div>' +
      '<div class="balance-card"><span>Nhóm 3 (Nghỉ ngơi)</span><strong>' + g3Off + ' / ' + target + '</strong><div class="balance-bar"><div class="balance-bar-fill" style="width:' + Math.min(100, Math.round((g3Off / target) * 100)) + '%"></div></div></div>' +
      '<div class="balance-card is-muted"><span>Phiên Demo lưu tạm</span><strong>' + demo.length + '</strong></div>' +
      '</div>' +
      '</div>' +
      '<div class="res-section">' +
      '<h4>Thống kê nhanh Trung bình Δ (Post − Pre) — ' + Utils.escapeHtml(statScopeLabel) + '</h4>' +
      groupChartHtml +
      '<div class="table-wrap">' +
      '<table class="data-table">' +
      '<thead><tr><th>Nhóm</th><th>n</th><th>Δ Nhiễu Stroop</th><th>Δ Commission Err</th><th>Δ 2-Back Acc</th><th>Δ 2-Back d\'</th></tr></thead>' +
      '<tbody>' + groupStatsRows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +
      '<div class="res-section">' +
      '<h4>Danh sách phiên đã lưu trên máy (' + sessions.length + ')</h4>' +
      '<div class="res-actions-bar">' +
      '<button type="button" class="btn btn-primary btn-sm" id="res-dl-summary" ' + (sessions.length ? '' : 'disabled') + '>⬇ Tải CSV gộp (JASP)</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="res-dl-raw" ' + (sessions.length ? '' : 'disabled') + '>⬇ Tải CSV chi tiết (Raw)</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="res-sync-all" ' + (sessions.length ? '' : 'disabled') + '>↻ Đồng bộ lại lên Sheets</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="res-seed-demo-btn">✨ Nạp 6 mẫu Demo (3 nhóm)</button>' +
      '<button type="button" class="btn btn-danger btn-sm" id="res-del-demo" ' + (demo.length ? '' : 'disabled') + '>🗑 Xóa phiên Demo (' + demo.length + ')</button>' +
      '</div>' +
      '<div class="res-status-msg" id="res-data-msg"></div>' +
      '<div class="table-wrap table-scroll">' +
      '<table class="data-table">' +
      '<thead><tr><th>Mã HS</th><th>Chế độ</th><th>Nhóm</th><th>Δ Stroop</th><th>Δ ComErr</th><th>Δ d\'</th><th>Outlier</th><th>Sheets</th></tr></thead>' +
      '<tbody>' + sessionRows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>'
    );
  }

  function renderBody() {
    if (!modalEl) return;
    const settings = CogLab.Storage.loadSettings();
    const bodyEl = modalEl.querySelector('#res-modal-body');
    const tabBtns = modalEl.querySelectorAll('.res-tab-btn');

    tabBtns.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.tab === activeTab);
    });

    if (activeTab === 'settings') {
      bodyEl.innerHTML = buildSettingsTabHtml(settings);
      bindSettingsTabEvents();
    } else if (activeTab === 'integrations') {
      bodyEl.innerHTML = buildIntegrationsTabHtml(settings);
      bindIntegrationsTabEvents();
    } else {
      bodyEl.innerHTML = buildDataTabHtml();
      bindDataTabEvents();
    }
  }

  function bindSettingsTabEvents() {
    const saveBtn = modalEl.querySelector('#res-save-settings-btn');
    const msgEl = modalEl.querySelector('#res-settings-msg');
    const radios = modalEl.querySelectorAll('input[name="res-mode"]');

    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        modalEl.querySelectorAll('.res-radio-card').forEach(function (card) {
          card.classList.toggle('is-selected', card.querySelector('input').checked);
        });
      });
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        const selectedMode = modalEl.querySelector('input[name="res-mode"]:checked');
        const forcedEl = modalEl.querySelector('#res-forced-group');
        const soundEl = modalEl.querySelector('#res-sound-enabled');

        const updated = CogLab.Storage.saveSettings({
          mode: selectedMode ? selectedMode.value : 'OFFICIAL',
          forcedGroup: forcedEl ? forcedEl.value : 'AUTO',
          soundEnabled: soundEl ? soundEl.checked : true
        });
        if (msgEl) msgEl.textContent = '✅ Đã lưu cài đặt phiên đo (' + updated.mode + ').';
        CogLab.Utils.showToast('Đã lưu cài đặt: ' + updated.mode, 'ok');
        if (typeof onSettingsChangedCb === 'function') onSettingsChangedCb(updated);
      });
    }
  }

  function bindIntegrationsTabEvents() {
    const srcSelect = modalEl.querySelector('#res-video-source');
    const ytBox = modalEl.querySelector('#res-yt-box');
    const mp4Box = modalEl.querySelector('#res-mp4-box');
    const pingBtn = modalEl.querySelector('#res-ping-btn');
    const pingMsg = modalEl.querySelector('#res-ping-msg');
    const saveBtn = modalEl.querySelector('#res-save-int-btn');
    const intMsg = modalEl.querySelector('#res-int-msg');

    if (srcSelect) {
      srcSelect.addEventListener('change', function () {
        const val = srcSelect.value;
        if (ytBox) ytBox.classList.toggle('is-hidden', val !== 'YOUTUBE');
        if (mp4Box) mp4Box.classList.toggle('is-hidden', val !== 'MP4');
      });
    }

    if (pingBtn) {
      pingBtn.addEventListener('click', async function () {
        const urlEl = modalEl.querySelector('#res-webhook-url');
        pingBtn.disabled = true;
        if (pingMsg) pingMsg.textContent = 'Đang kiểm tra kết nối...';
        const res = await CogLab.Storage.pingWebhook(urlEl ? urlEl.value : '');
        pingBtn.disabled = false;
        if (pingMsg) pingMsg.textContent = (res.ok ? '✅ ' : '⚠️ ') + res.message;
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        const urlEl = modalEl.querySelector('#res-webhook-url');
        const ytEl = modalEl.querySelector('#res-yt-ids');
        const mp4El = modalEl.querySelector('#res-mp4-urls');

        const updated = CogLab.Storage.saveSettings({
          sheetsWebhookUrl: urlEl ? urlEl.value.trim() : '',
          videoSourceType: srcSelect ? srcSelect.value : 'BUILTIN',
          youtubeIds: parseListInput(ytEl ? ytEl.value : ''),
          customVideoUrls: parseListInput(mp4El ? mp4El.value : '')
        });
        if (intMsg) intMsg.textContent = '✅ Đã lưu cấu hình kết nối & nguồn video.';
        CogLab.Utils.showToast('Đã lưu cấu hình kết nối & video.', 'ok');
        if (typeof onSettingsChangedCb === 'function') onSettingsChangedCb(updated);
      });
    }
  }

  function buildSyntheticDemoSession(idx, groupId) {
    const Utils = CogLab.Utils;
    const now = new Date();
    const dInt = groupId === 1 ? 28.4 + idx * 4.5 : groupId === 2 ? 6.2 - idx * 1.4 : -8.5 - idx * 2.0;
    const dCom = groupId === 1 ? 7.8 + idx * 1.2 : groupId === 2 ? 1.1 : -2.4;
    const dDPrime = groupId === 1 ? -0.34 - idx * 0.08 : groupId === 2 ? -0.04 : 0.14 + idx * 0.05;
    const dAcc = groupId === 1 ? -4.2 : groupId === 2 ? -0.6 : 2.1;

    const preInt = 96.5 + idx * 6.0;
    const preCom = 14.5 + idx * 1.5;
    const preD = 2.18 + idx * 0.06;

    return {
      sessionId: 'DEMO_SYNTH_' + Date.now() + '_' + groupId + '_' + idx,
      participantId: 'DEMO-G' + groupId + '-0' + (idx + 1),
      seed: 1000 + groupId * 100 + idx,
      mode: 'DEMO',
      group: groupId,
      assignmentMethod: 'SYNTHETIC_DEMO',
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      timeOfDay: Utils.getTimeOfDayBucket(now),
      baseline: {
        grade: 11,
        videoHoursPerDay: 2.5,
        videoHabitGroup: 'MEDIUM',
        sleepHours: 7.5,
        alertness: 4
      },
      intervention: { durationSec: 20, clipSwitches: groupId === 1 ? 4 : null, maxScrollPct: groupId === 1 ? null : 65 },
      trials: [],
      summary: {
        pre: {
          stroop: { rtCongruentMs: 610.2, rtIncongruentMs: preInt + 610.2, interferenceMs: preInt, accuracyPct: 95.0 },
          gonogo: { commissionErrorPct: preCom, omissionErrorPct: 2.0, meanRtMs: 368.4, sdRtMs: 54.2, accuracyPct: 93.0 },
          twoback: { accuracyPct: 86.5, hitRatePct: 84.0, faRatePct: 9.0, dPrime: preD }
        },
        post: {
          stroop: { rtCongruentMs: 608.0, rtIncongruentMs: preInt + dInt + 608.0, interferenceMs: Number((preInt + dInt).toFixed(1)), accuracyPct: 92.5 },
          gonogo: { commissionErrorPct: Number((preCom + dCom).toFixed(1)), omissionErrorPct: 2.5, meanRtMs: 374.1, sdRtMs: 61.5, accuracyPct: 90.0 },
          twoback: { accuracyPct: Number((86.5 + dAcc).toFixed(1)), hitRatePct: 80.0, faRatePct: 12.0, dPrime: Number((preD + dDPrime).toFixed(2)) }
        },
        delta: {
          stroop_interference_ms: Number(dInt.toFixed(1)),
          stroop_accuracy_pct: -2.5,
          gonogo_commission_pct: Number(dCom.toFixed(1)),
          gonogo_omission_pct: 0.5,
          gonogo_mean_rt_ms: 5.7,
          gonogo_sd_rt_ms: 7.3,
          twoback_accuracy_pct: Number(dAcc.toFixed(1)),
          twoback_hit_pct: -4.0,
          twoback_fa_pct: 3.0,
          twoback_dprime: Number(dDPrime.toFixed(2))
        },
        outliers: { totalExpTrials: 30, totalOutliers: 1, totalOutlierPct: 3.3 }
      },
      syncedToSheets: false
    };
  }

  function bindDataTabEvents() {
    const dlSummary = modalEl.querySelector('#res-dl-summary');
    const dlRaw = modalEl.querySelector('#res-dl-raw');
    const syncAll = modalEl.querySelector('#res-sync-all');
    const seedDemo = modalEl.querySelector('#res-seed-demo-btn');
    const delDemo = modalEl.querySelector('#res-del-demo');
    const msgEl = modalEl.querySelector('#res-data-msg');

    if (dlSummary) {
      dlSummary.addEventListener('click', function () {
        const sessions = CogLab.Storage.loadSessions();
        CogLab.Storage.downloadSummaryCsv(sessions, 'VISEF_Summary_JASP.csv');
        CogLab.Utils.showToast('Đã xuất file CSV tổng hợp JASP.', 'ok');
      });
    }

    if (dlRaw) {
      dlRaw.addEventListener('click', function () {
        const sessions = CogLab.Storage.loadSessions();
        CogLab.Storage.downloadRawTrialsCsv(sessions, 'VISEF_Raw_Trials.csv');
        CogLab.Utils.showToast('Đã xuất file CSV chi tiết lượt bấm.', 'ok');
      });
    }

    if (seedDemo) {
      seedDemo.addEventListener('click', function () {
        [1, 2, 3].forEach(function (gid) {
          CogLab.Storage.saveSession(buildSyntheticDemoSession(0, gid));
          CogLab.Storage.saveSession(buildSyntheticDemoSession(1, gid));
        });
        renderBody();
        if (CogLab.HomeInteractive && CogLab.HomeInteractive.refreshDiagnostics) {
          CogLab.HomeInteractive.refreshDiagnostics();
        }
        const mEl = modalEl.querySelector('#res-data-msg');
        if (mEl) mEl.textContent = '✅ Đã nạp thêm 6 phiên Demo cân bằng qua 3 nhóm RCT.';
        CogLab.Utils.showToast('Đã nạp 6 mẫu Demo (3 nhóm RCT).', 'ok');
      });
    }

    if (delDemo) {
      delDemo.addEventListener('click', function () {
        CogLab.Storage.deleteDemoSessions();
        renderBody();
        if (CogLab.HomeInteractive && CogLab.HomeInteractive.refreshDiagnostics) {
          CogLab.HomeInteractive.refreshDiagnostics();
        }
        CogLab.Utils.showToast('Đã xóa toàn bộ phiên Demo lưu tạm.', 'warn');
      });
    }

    if (syncAll) {
      syncAll.addEventListener('click', async function () {
        const settings = CogLab.Storage.loadSettings();
        if (!settings.sheetsWebhookUrl) {
          if (msgEl) msgEl.textContent = '⚠️ Vui lòng nhập URL Google Apps Script ở tab "Google Sheets & Video" trước.';
          return;
        }
        const pending = CogLab.Storage.loadSessions().filter((s) => !s.syncedToSheets);
        if (pending.length === 0) {
          if (msgEl) msgEl.textContent = '✅ Tất cả phiên đo đã được đồng bộ lên Google Sheets.';
          return;
        }
        syncAll.disabled = true;
        let okCount = 0;
        let failCount = 0;
        for (let i = 0; i < pending.length; i++) {
          if (msgEl) msgEl.textContent = 'Đang đồng bộ ' + (i + 1) + ' / ' + pending.length + '...';
          const res = await CogLab.Storage.syncToGoogleSheets(pending[i], settings.sheetsWebhookUrl);
          if (res.ok) okCount++;
          else failCount++;
        }
        renderBody();
        const newMsgEl = modalEl.querySelector('#res-data-msg');
        if (newMsgEl) {
          newMsgEl.textContent =
            'Kết quả đồng bộ: ' + okCount + ' thành công' + (failCount ? ', ' + failCount + ' thất bại.' : '.');
        }
      });
    }
  }

  function init(options) {
    onSettingsChangedCb = options && options.onSettingsChanged;
    modalEl = document.getElementById('researcher-modal');
    if (!modalEl) return;

    const closeBtn = modalEl.querySelector('#res-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) close();
    });

    modalEl.querySelectorAll('.res-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTab = btn.dataset.tab || 'settings';
        renderBody();
      });
    });
  }

  function open(tabName) {
    if (!modalEl) return;
    if (tabName) activeTab = tabName;
    renderBody();
    modalEl.classList.remove('is-hidden');
  }

  function close() {
    if (!modalEl) return;
    modalEl.classList.add('is-hidden');
  }

  CogLab.Researcher = {
    init,
    open,
    close
  };
})(window);
