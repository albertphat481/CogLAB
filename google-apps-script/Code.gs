/**
 * Google Apps Script — Backend thu thập dữ liệu cho Nền tảng Thực nghiệm Tâm lý Số (VISEF BEHA)
 * Hướng dẫn nhanh:
 * 1. Tạo một Google Sheet mới -> mở Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Dán toàn bộ nội dung file này vào Code.gs và Lưu.
 * 3. Chọn Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment) -> Ứng dụng web (Web app):
 *    - Thực thi với tư cách: Tôi (Me)
 *    - Người có quyền truy cập: Bất kỳ ai (Anyone)
 * 4. Sao chép URL Web App (/exec) và dán vào mục "GVHD / Quản trị -> Google Sheets & Video" trên Web App.
 */

var SUMMARY_HEADERS = [
  'session_id',
  'participant_id',
  'mode',
  'group_id',
  'group_code',
  'assignment_method',
  'started_at',
  'completed_at',
  'time_of_day',
  'grade',
  'video_hours_per_day',
  'video_habit_group',
  'sleep_hours',
  'alertness_1_5',
  'intervention_duration_sec',
  'intervention_clip_switches',
  'intervention_read_scroll_pct',
  'pre_stroop_rt_congruent_ms',
  'pre_stroop_rt_incongruent_ms',
  'pre_stroop_interference_ms',
  'pre_stroop_accuracy_pct',
  'pre_gonogo_commission_pct',
  'pre_gonogo_omission_pct',
  'pre_gonogo_mean_rt_ms',
  'pre_gonogo_sd_rt_ms',
  'pre_twoback_accuracy_pct',
  'pre_twoback_hit_pct',
  'pre_twoback_fa_pct',
  'pre_twoback_dprime',
  'post_stroop_rt_congruent_ms',
  'post_stroop_rt_incongruent_ms',
  'post_stroop_interference_ms',
  'post_stroop_accuracy_pct',
  'post_gonogo_commission_pct',
  'post_gonogo_omission_pct',
  'post_gonogo_mean_rt_ms',
  'post_gonogo_sd_rt_ms',
  'post_twoback_accuracy_pct',
  'post_twoback_hit_pct',
  'post_twoback_fa_pct',
  'post_twoback_dprime',
  'delta_stroop_interference_ms',
  'delta_stroop_accuracy_pct',
  'delta_gonogo_commission_pct',
  'delta_gonogo_omission_pct',
  'delta_gonogo_mean_rt_ms',
  'delta_gonogo_sd_rt_ms',
  'delta_twoback_accuracy_pct',
  'delta_twoback_hit_pct',
  'delta_twoback_fa_pct',
  'delta_twoback_dprime',
  'total_exp_trials',
  'total_outlier_trials',
  'total_outlier_pct'
];

var RAW_HEADERS = [
  'session_id',
  'participant_id',
  'mode',
  'group_id',
  'phase',
  'test',
  'trial_index',
  'condition',
  'stimulus',
  'expected_key',
  'response_key',
  'rt_ms',
  'is_correct',
  'outcome',
  'outlier_flag',
  'timestamp_iso'
];

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrInitSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  return jsonResponse({
    ok: true,
    service: 'VISEF-CogLab-Sheets-Bridge',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Empty request body' });
    }

    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (payload && payload.summary) {
      var summarySheet = getOrInitSheet(ss, 'Summary_JASP', SUMMARY_HEADERS);
      var summaryRow = SUMMARY_HEADERS.map(function (key) {
        var val = payload.summary[key];
        return val === null || val === undefined ? '' : val;
      });
      summarySheet.appendRow(summaryRow);
    }

    if (payload && Array.isArray(payload.trials) && payload.trials.length > 0) {
      var rawSheet = getOrInitSheet(ss, 'Raw_Trials', RAW_HEADERS);
      var rows = payload.trials.map(function (t) {
        return RAW_HEADERS.map(function (key) {
          var val = t[key];
          return val === null || val === undefined ? '' : val;
        });
      });
      rawSheet
        .getRange(rawSheet.getLastRow() + 1, 1, rows.length, RAW_HEADERS.length)
        .setValues(rows);
    }

    return jsonResponse({
      ok: true,
      savedTrials: Array.isArray(payload.trials) ? payload.trials.length : 0
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  } finally {
    lock.releaseLock();
  }
}
