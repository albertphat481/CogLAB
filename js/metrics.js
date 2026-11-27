(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  function countOutliers(trials) {
    let fast = 0;
    let slow = 0;
    for (let i = 0; i < trials.length; i++) {
      if (trials[i].outlierFlag === 'TOO_FAST') fast++;
      else if (trials[i].outlierFlag === 'TOO_SLOW') slow++;
    }
    const total = trials.length;
    const count = fast + slow;
    return {
      outlierFast: fast,
      outlierSlow: slow,
      outlierCount: count,
      outlierPct: total > 0 ? (count / total) * 100 : 0
    };
  }

  function isValidTrial(trial) {
    return trial.outlierFlag !== 'TOO_FAST' && trial.outlierFlag !== 'TOO_SLOW';
  }

  function diffVal(postVal, preVal) {
    if (typeof postVal !== 'number' || typeof preVal !== 'number') return null;
    if (!Number.isFinite(postVal) || !Number.isFinite(preVal)) return null;
    return postVal - preVal;
  }

  function computeStroopMetrics(trials) {
    const Utils = CogLab.Utils;
    const list = Array.isArray(trials) ? trials : [];
    const outliers = countOutliers(list);
    const valid = list.filter(isValidTrial);

    const cong = valid.filter((t) => t.condition === 'congruent');
    const incong = valid.filter((t) => t.condition === 'incongruent');

    const congRts = cong
      .filter((t) => t.outcome === 'CORRECT' && typeof t.rtMs === 'number')
      .map((t) => t.rtMs);
    const incongRts = incong
      .filter((t) => t.outcome === 'CORRECT' && typeof t.rtMs === 'number')
      .map((t) => t.rtMs);

    const rtCongruentMs = Utils.mean(congRts);
    const rtIncongruentMs = Utils.mean(incongRts);
    const interferenceMs = diffVal(rtIncongruentMs, rtCongruentMs);

    const accuracyPct = valid.length > 0 ? (valid.filter((t) => t.isCorrect).length / valid.length) * 100 : null;
    const accCongruentPct = cong.length > 0 ? (cong.filter((t) => t.isCorrect).length / cong.length) * 100 : null;
    const accIncongruentPct =
      incong.length > 0 ? (incong.filter((t) => t.isCorrect).length / incong.length) * 100 : null;

    return {
      totalCount: list.length,
      validCount: valid.length,
      rtCongruentMs: Utils.round(rtCongruentMs, 2),
      rtIncongruentMs: Utils.round(rtIncongruentMs, 2),
      interferenceMs: Utils.round(interferenceMs, 2),
      accuracyPct: Utils.round(accuracyPct, 2),
      accCongruentPct: Utils.round(accCongruentPct, 2),
      accIncongruentPct: Utils.round(accIncongruentPct, 2),
      outlierFast: outliers.outlierFast,
      outlierSlow: outliers.outlierSlow,
      outlierCount: outliers.outlierCount,
      outlierPct: Utils.round(outliers.outlierPct, 2)
    };
  }

  function computeGoNoGoMetrics(trials) {
    const Utils = CogLab.Utils;
    const list = Array.isArray(trials) ? trials : [];
    const outliers = countOutliers(list);
    const valid = list.filter(isValidTrial);

    const validGo = valid.filter((t) => t.condition === 'go');
    const validNoGo = valid.filter((t) => t.condition === 'nogo');

    const commissionCount = validNoGo.filter((t) => t.outcome === 'COMMISSION').length;
    const omissionCount = validGo.filter((t) => t.outcome === 'OMISSION').length;

    const commissionErrorPct = validNoGo.length > 0 ? (commissionCount / validNoGo.length) * 100 : null;
    const omissionErrorPct = validGo.length > 0 ? (omissionCount / validGo.length) * 100 : null;

    const hitRts = validGo
      .filter((t) => t.outcome === 'HIT' && typeof t.rtMs === 'number')
      .map((t) => t.rtMs);

    const meanRtMs = Utils.mean(hitRts);
    const sdRtMs = Utils.sampleSD(hitRts);
    const accuracyPct = valid.length > 0 ? (valid.filter((t) => t.isCorrect).length / valid.length) * 100 : null;

    return {
      totalCount: list.length,
      validCount: valid.length,
      commissionCount: commissionCount,
      omissionCount: omissionCount,
      commissionErrorPct: Utils.round(commissionErrorPct, 2),
      omissionErrorPct: Utils.round(omissionErrorPct, 2),
      meanRtMs: Utils.round(meanRtMs, 2),
      sdRtMs: Utils.round(sdRtMs, 2),
      accuracyPct: Utils.round(accuracyPct, 2),
      outlierFast: outliers.outlierFast,
      outlierSlow: outliers.outlierSlow,
      outlierCount: outliers.outlierCount,
      outlierPct: Utils.round(outliers.outlierPct, 2)
    };
  }

  function computeTwoBackMetrics(trials) {
    const Utils = CogLab.Utils;
    const list = Array.isArray(trials) ? trials : [];
    const outliers = countOutliers(list);
    const evaluable = list.filter((t) => t.outcome !== 'BUFFER');
    const validEval = evaluable.filter(isValidTrial);

    const targets = validEval.filter((t) => t.condition === 'target');
    const nonTargets = validEval.filter((t) => t.condition === 'nontarget');

    const hits = targets.filter((t) => t.outcome === 'HIT').length;
    const misses = targets.filter((t) => t.outcome === 'MISS').length;
    const falseAlarms = nonTargets.filter((t) => t.outcome === 'FALSE_ALARM').length;
    const correctRejections = nonTargets.filter((t) => t.outcome === 'CORRECT_REJECTION').length;

    const hitRatePct = targets.length > 0 ? (hits / targets.length) * 100 : null;
    const faRatePct = nonTargets.length > 0 ? (falseAlarms / nonTargets.length) * 100 : null;
    const accuracyPct =
      validEval.length > 0 ? ((hits + correctRejections) / validEval.length) * 100 : null;

    const hitRts = targets
      .filter((t) => t.outcome === 'HIT' && typeof t.rtMs === 'number')
      .map((t) => t.rtMs);
    const meanRtMs = Utils.mean(hitRts);
    const dPrime = Utils.computeDPrime(hits, targets.length, falseAlarms, nonTargets.length);

    return {
      totalCount: list.length,
      evaluableValidCount: validEval.length,
      hits: hits,
      misses: misses,
      falseAlarms: falseAlarms,
      correctRejections: correctRejections,
      hitRatePct: Utils.round(hitRatePct, 2),
      faRatePct: Utils.round(faRatePct, 2),
      accuracyPct: Utils.round(accuracyPct, 2),
      meanRtMs: Utils.round(meanRtMs, 2),
      dPrime: Utils.round(dPrime, 3),
      outlierFast: outliers.outlierFast,
      outlierSlow: outliers.outlierSlow,
      outlierCount: outliers.outlierCount,
      outlierPct: Utils.round(outliers.outlierPct, 2)
    };
  }

  function computeSessionSummary(session) {
    const Utils = CogLab.Utils;
    const allTrials = Array.isArray(session.trials) ? session.trials : [];
    const preTrials = allTrials.filter((t) => t.phase === 'PRE');
    const postTrials = allTrials.filter((t) => t.phase === 'POST');

    const pre = {
      stroop: computeStroopMetrics(preTrials.filter((t) => t.test === 'stroop')),
      gonogo: computeGoNoGoMetrics(preTrials.filter((t) => t.test === 'gonogo')),
      twoback: computeTwoBackMetrics(preTrials.filter((t) => t.test === 'twoback'))
    };

    const post = {
      stroop: computeStroopMetrics(postTrials.filter((t) => t.test === 'stroop')),
      gonogo: computeGoNoGoMetrics(postTrials.filter((t) => t.test === 'gonogo')),
      twoback: computeTwoBackMetrics(postTrials.filter((t) => t.test === 'twoback'))
    };

    const delta = {
      stroop_rt_congruent_ms: Utils.round(diffVal(post.stroop.rtCongruentMs, pre.stroop.rtCongruentMs), 2),
      stroop_rt_incongruent_ms: Utils.round(diffVal(post.stroop.rtIncongruentMs, pre.stroop.rtIncongruentMs), 2),
      stroop_interference_ms: Utils.round(diffVal(post.stroop.interferenceMs, pre.stroop.interferenceMs), 2),
      stroop_accuracy_pct: Utils.round(diffVal(post.stroop.accuracyPct, pre.stroop.accuracyPct), 2),
      gonogo_commission_pct: Utils.round(diffVal(post.gonogo.commissionErrorPct, pre.gonogo.commissionErrorPct), 2),
      gonogo_omission_pct: Utils.round(diffVal(post.gonogo.omissionErrorPct, pre.gonogo.omissionErrorPct), 2),
      gonogo_mean_rt_ms: Utils.round(diffVal(post.gonogo.meanRtMs, pre.gonogo.meanRtMs), 2),
      gonogo_sd_rt_ms: Utils.round(diffVal(post.gonogo.sdRtMs, pre.gonogo.sdRtMs), 2),
      twoback_accuracy_pct: Utils.round(diffVal(post.twoback.accuracyPct, pre.twoback.accuracyPct), 2),
      twoback_hit_pct: Utils.round(diffVal(post.twoback.hitRatePct, pre.twoback.hitRatePct), 2),
      twoback_fa_pct: Utils.round(diffVal(post.twoback.faRatePct, pre.twoback.faRatePct), 2),
      twoback_dprime: Utils.round(diffVal(post.twoback.dPrime, pre.twoback.dPrime), 3)
    };

    const totalExpTrials = preTrials.length + postTrials.length;
    const totalOutliers =
      pre.stroop.outlierCount +
      pre.gonogo.outlierCount +
      pre.twoback.outlierCount +
      post.stroop.outlierCount +
      post.gonogo.outlierCount +
      post.twoback.outlierCount;

    return {
      pre: pre,
      post: post,
      delta: delta,
      outliers: {
        totalExpTrials: totalExpTrials,
        totalOutliers: totalOutliers,
        totalOutlierPct: Utils.round(totalExpTrials > 0 ? (totalOutliers / totalExpTrials) * 100 : 0, 2)
      }
    };
  }

  const SUMMARY_CSV_HEADERS = [
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

  const RAW_TRIAL_CSV_HEADERS = [
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

  function flattenSessionForCsv(session) {
    const s = session.summary || computeSessionSummary(session);
    const groupInfo = CogLab.Config.GROUPS[session.group] || { code: 'UNKNOWN' };
    const baseline = session.baseline || {};
    const engagement = session.intervention || {};

    return {
      session_id: session.sessionId,
      participant_id: session.participantId,
      mode: session.mode,
      group_id: session.group,
      group_code: groupInfo.code,
      assignment_method: session.assignmentMethod || 'AUTO_BALANCED',
      started_at: session.startedAt,
      completed_at: session.completedAt,
      time_of_day: session.timeOfDay || '',
      grade: baseline.grade || '',
      video_hours_per_day: baseline.videoHoursPerDay,
      video_habit_group: baseline.videoHabitGroup || '',
      sleep_hours: baseline.sleepHours,
      alertness_1_5: baseline.alertness,
      intervention_duration_sec: engagement.durationSec || 0,
      intervention_clip_switches: engagement.clipSwitches != null ? engagement.clipSwitches : '',
      intervention_read_scroll_pct: engagement.maxScrollPct != null ? engagement.maxScrollPct : '',
      pre_stroop_rt_congruent_ms: s.pre.stroop.rtCongruentMs,
      pre_stroop_rt_incongruent_ms: s.pre.stroop.rtIncongruentMs,
      pre_stroop_interference_ms: s.pre.stroop.interferenceMs,
      pre_stroop_accuracy_pct: s.pre.stroop.accuracyPct,
      pre_gonogo_commission_pct: s.pre.gonogo.commissionErrorPct,
      pre_gonogo_omission_pct: s.pre.gonogo.omissionErrorPct,
      pre_gonogo_mean_rt_ms: s.pre.gonogo.meanRtMs,
      pre_gonogo_sd_rt_ms: s.pre.gonogo.sdRtMs,
      pre_twoback_accuracy_pct: s.pre.twoback.accuracyPct,
      pre_twoback_hit_pct: s.pre.twoback.hitRatePct,
      pre_twoback_fa_pct: s.pre.twoback.faRatePct,
      pre_twoback_dprime: s.pre.twoback.dPrime,
      post_stroop_rt_congruent_ms: s.post.stroop.rtCongruentMs,
      post_stroop_rt_incongruent_ms: s.post.stroop.rtIncongruentMs,
      post_stroop_interference_ms: s.post.stroop.interferenceMs,
      post_stroop_accuracy_pct: s.post.stroop.accuracyPct,
      post_gonogo_commission_pct: s.post.gonogo.commissionErrorPct,
      post_gonogo_omission_pct: s.post.gonogo.omissionErrorPct,
      post_gonogo_mean_rt_ms: s.post.gonogo.meanRtMs,
      post_gonogo_sd_rt_ms: s.post.gonogo.sdRtMs,
      post_twoback_accuracy_pct: s.post.twoback.accuracyPct,
      post_twoback_hit_pct: s.post.twoback.hitRatePct,
      post_twoback_fa_pct: s.post.twoback.faRatePct,
      post_twoback_dprime: s.post.twoback.dPrime,
      delta_stroop_interference_ms: s.delta.stroop_interference_ms,
      delta_stroop_accuracy_pct: s.delta.stroop_accuracy_pct,
      delta_gonogo_commission_pct: s.delta.gonogo_commission_pct,
      delta_gonogo_omission_pct: s.delta.gonogo_omission_pct,
      delta_gonogo_mean_rt_ms: s.delta.gonogo_mean_rt_ms,
      delta_gonogo_sd_rt_ms: s.delta.gonogo_sd_rt_ms,
      delta_twoback_accuracy_pct: s.delta.twoback_accuracy_pct,
      delta_twoback_hit_pct: s.delta.twoback_hit_pct,
      delta_twoback_fa_pct: s.delta.twoback_fa_pct,
      delta_twoback_dprime: s.delta.twoback_dprime,
      total_exp_trials: s.outliers.totalExpTrials,
      total_outlier_trials: s.outliers.totalOutliers,
      total_outlier_pct: s.outliers.totalOutlierPct
    };
  }

  function flattenTrialsForCsv(session) {
    const trials = Array.isArray(session.trials) ? session.trials : [];
    return trials.map(function (t) {
      return {
        session_id: session.sessionId,
        participant_id: session.participantId,
        mode: session.mode,
        group_id: session.group,
        phase: t.phase,
        test: t.test,
        trial_index: t.trialIndex,
        condition: t.condition,
        stimulus: t.stimulus,
        expected_key: t.expectedKey || '',
        response_key: t.responseKey || '',
        rt_ms: t.rtMs != null ? t.rtMs : '',
        is_correct: t.isCorrect ? 1 : 0,
        outcome: t.outcome,
        outlier_flag: t.outlierFlag,
        timestamp_iso: t.timestampIso
      };
    });
  }

  CogLab.Metrics = {
    computeStroopMetrics,
    computeGoNoGoMetrics,
    computeTwoBackMetrics,
    computeSessionSummary,
    flattenSessionForCsv,
    flattenTrialsForCsv,
    SUMMARY_CSV_HEADERS,
    RAW_TRIAL_CSV_HEADERS
  };
})(window);
