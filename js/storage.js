(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  function loadSettings() {
    const Config = CogLab.Config;
    const defaults = Object.assign({}, Config.DEFAULT_SETTINGS);
    try {
      const raw = global.localStorage.getItem(Config.STORAGE_KEYS.SETTINGS);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return Object.assign(defaults, parsed);
    } catch (_) {
      return defaults;
    }
  }

  function saveSettings(partial) {
    const Config = CogLab.Config;
    const next = Object.assign(loadSettings(), partial || {});
    try {
      global.localStorage.setItem(Config.STORAGE_KEYS.SETTINGS, JSON.stringify(next));
    } catch (_) {
      // Ignore storage write error
    }
    return next;
  }

  function loadSessions() {
    const Config = CogLab.Config;
    try {
      const raw = global.localStorage.getItem(Config.STORAGE_KEYS.SESSIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeSessions(sessions) {
    const Config = CogLab.Config;
    try {
      global.localStorage.setItem(Config.STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveSession(session) {
    const list = loadSessions();
    const idx = list.findIndex((s) => s.sessionId === session.sessionId);
    if (idx >= 0) {
      list[idx] = session;
    } else {
      list.push(session);
    }
    writeSessions(list);
    return list;
  }

  function markSessionSynced(sessionId) {
    const list = loadSessions();
    const idx = list.findIndex((s) => s.sessionId === sessionId);
    if (idx >= 0) {
      list[idx].syncedToSheets = true;
      list[idx].syncedAt = new Date().toISOString();
      writeSessions(list);
    }
  }

  function deleteDemoSessions() {
    const filtered = loadSessions().filter((s) => s.mode !== 'DEMO');
    writeSessions(filtered);
    return filtered;
  }

  function clearAllSessions() {
    writeSessions([]);
    return [];
  }

  async function syncToGoogleSheets(session, webhookUrl) {
    const url = String(webhookUrl || '').trim();
    if (!url) {
      return { ok: false, skipped: true, message: 'Chưa cấu hình Google Apps Script Webhook URL.' };
    }
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, skipped: false, message: 'URL Webhook không hợp lệ (cần bắt đầu bằng https://).' };
    }

    const Metrics = CogLab.Metrics;
    const payload = {
      type: 'SESSION_COMPLETE',
      summary: Metrics.flattenSessionForCsv(session),
      trials: Metrics.flattenTrialsForCsv(session)
    };

    try {
      const res = await global.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        return { ok: false, message: 'HTTP ' + res.status + ' khi gửi dữ liệu lên Google Sheets.' };
      }

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = { ok: true };
      }

      if (data && data.ok === false) {
        return { ok: false, message: data.error || 'Apps Script báo lỗi khi lưu.' };
      }

      markSessionSynced(session.sessionId);
      return { ok: true, message: 'Đã đồng bộ tự động lên Google Sheets.' };
    } catch (err) {
      return {
        ok: false,
        message: 'Không thể kết nối Google Sheets (có thể mất mạng hoặc CORS). Bản sao cục bộ và CSV vẫn an toàn.'
      };
    }
  }

  async function pingWebhook(webhookUrl) {
    const url = String(webhookUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { ok: false, message: 'Vui lòng nhập URL Web App hợp lệ (https://script.google.com/...).' };
    }
    try {
      const sep = url.indexOf('?') === -1 ? '?' : '&';
      const res = await global.fetch(url + sep + 'ping=1', { method: 'GET' });
      if (!res.ok) {
        return { ok: false, message: 'Máy chủ phản hồi HTTP ' + res.status };
      }
      const data = await res.json();
      if (data && data.ok) {
        return { ok: true, message: 'Kết nối thành công tới Google Apps Script!' };
      }
      return { ok: false, message: 'Phản hồi không đúng định dạng từ Apps Script.' };
    } catch (err) {
      return { ok: false, message: 'Lỗi kết nối: ' + (err && err.message ? err.message : 'Network error') };
    }
  }

  function downloadSummaryCsv(sessions, filename) {
    const Metrics = CogLab.Metrics;
    const Utils = CogLab.Utils;
    const list = Array.isArray(sessions) ? sessions : [];
    const rows = list.map((s) => Metrics.flattenSessionForCsv(s));
    const csv = Utils.buildCsv(Metrics.SUMMARY_CSV_HEADERS, rows);
    Utils.triggerDownload(filename || 'VISEF_Summary_JASP.csv', csv, 'text/csv;charset=utf-8;');
  }

  function downloadRawTrialsCsv(sessions, filename) {
    const Metrics = CogLab.Metrics;
    const Utils = CogLab.Utils;
    const list = Array.isArray(sessions) ? sessions : [];
    let rows = [];
    for (let i = 0; i < list.length; i++) {
      rows = rows.concat(Metrics.flattenTrialsForCsv(list[i]));
    }
    const csv = Utils.buildCsv(Metrics.RAW_TRIAL_CSV_HEADERS, rows);
    Utils.triggerDownload(filename || 'VISEF_Raw_Trials.csv', csv, 'text/csv;charset=utf-8;');
  }

  CogLab.Storage = {
    loadSettings,
    saveSettings,
    loadSessions,
    saveSession,
    markSessionSynced,
    deleteDemoSessions,
    clearAllSessions,
    syncToGoogleSheets,
    pingWebhook,
    downloadSummaryCsv,
    downloadRawTrialsCsv
  };
})(window);
