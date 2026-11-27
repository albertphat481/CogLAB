(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createFreshSeed() {
    const t = Date.now() & 0xffffffff;
    const r = Math.floor(Math.random() * 0xffffffff);
    return (t ^ r) >>> 0;
  }

  function shuffle(arr, rng) {
    const copy = arr.slice();
    const rand = typeof rng === 'function' ? rng : Math.random;
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Assigns balanced group (1, 2, or 3) using permuted blocks of 6 ([1,1,2,2,3,3]).
   * When participantId contains digits (e.g. HS001-HS090), assignment is deterministic
   * per 6-participant block so independent lab computers achieve exact 30/30/30 balance
   * without an obvious n % 3 pattern.
   */
  function assignBalancedGroup(participantId) {
    const clean = String(participantId || '').trim().toUpperCase();
    const match = clean.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num >= 1) {
        const zeroIdx = num - 1;
        const blockIdx = Math.floor(zeroIdx / 6);
        const posInBlock = zeroIdx % 6;
        const seed = ((blockIdx + 1) * 2654435761 + 1013904223) >>> 0;
        const block = shuffle([1, 1, 2, 2, 3, 3], mulberry32(seed));
        return block[posInBlock];
      }
    }

    const queueKey = CogLab.Config.STORAGE_KEYS.RAND_QUEUE;
    let queue = [];
    try {
      const raw = global.localStorage.getItem(queueKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) queue = parsed.filter((x) => x === 1 || x === 2 || x === 3);
      }
    } catch (_) {
      queue = [];
    }

    if (queue.length === 0) {
      queue = shuffle([1, 1, 2, 2, 3, 3], mulberry32(createFreshSeed()));
    }
    const assigned = queue.shift();
    try {
      global.localStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (_) {
      // Ignore storage quota errors in fallback mode
    }
    return assigned;
  }

  function classifyVideoHabit(hoursPerDay) {
    const h = Number(hoursPerDay);
    if (!Number.isFinite(h)) return 'UNKNOWN';
    if (h < 0.5) return 'LOW (< 30p/ngày)';
    if (h > 2.0) return 'HIGH (> 2h/ngày)';
    return 'MEDIUM (30p-2h/ngày)';
  }

  function getTimeOfDayBucket(date) {
    const d = date instanceof Date ? date : new Date();
    const hour = d.getHours();
    if (hour < 12) return 'Sáng (Morning)';
    if (hour < 18) return 'Chiều (Afternoon)';
    return 'Tối (Evening)';
  }

  function mean(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    return count > 0 ? sum / count : null;
  }

  function sampleSD(arr) {
    if (!Array.isArray(arr)) return null;
    const valid = arr.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (valid.length < 2) return null;
    const m = mean(valid);
    let sqSum = 0;
    for (let i = 0; i < valid.length; i++) {
      const diff = valid[i] - m;
      sqSum += diff * diff;
    }
    return Math.sqrt(sqSum / (valid.length - 1));
  }

  /**
   * Peter Acklam's rational approximation for inverse standard normal CDF (probit).
   */
  function normInv(p) {
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p >= 1) {
      return null;
    }

    const a = [
      -3.969683028665376e1,
      2.209460984245205e2,
      -2.759285104469687e2,
      1.38357751867269e2,
      -3.066479806614716e1,
      2.506628277459239e0
    ];
    const b = [
      -5.447609879822406e1,
      1.615858368580409e2,
      -1.556989798598866e2,
      6.680131188771972e1,
      -1.328068155288572e1
    ];
    const c = [
      -7.784894002430293e-3,
      -3.223964580411365e-1,
      -2.400758277161838e0,
      -2.549732539343734e0,
      4.374664141464968e0,
      2.938163982698783e0
    ];
    const d = [
      7.784695709041462e-3,
      3.224671290700398e-1,
      2.445134137142996e0,
      3.754408661907416e0
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    if (p <= pHigh) {
      const q = p - 0.5;
      const r = q * q;
      return (
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
      );
    }

    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  /**
   * Computes signal detection sensitivity d' = Z(Hit) - Z(FA)
   * with Macmillan & Creelman 1/(2N) correction for 0 and 1 extreme rates.
   */
  function computeDPrime(hits, totalTargets, falseAlarms, totalNonTargets) {
    if (!totalTargets || !totalNonTargets || totalTargets <= 0 || totalNonTargets <= 0) {
      return null;
    }
    let hitRate = hits / totalTargets;
    let faRate = falseAlarms / totalNonTargets;

    if (hitRate >= 1) hitRate = 1 - 1 / (2 * totalTargets);
    else if (hitRate <= 0) hitRate = 1 / (2 * totalTargets);

    if (faRate >= 1) faRate = 1 - 1 / (2 * totalNonTargets);
    else if (faRate <= 0) faRate = 1 / (2 * totalNonTargets);

    const zHit = normInv(hitRate);
    const zFa = normInv(faRate);
    if (zHit === null || zFa === null) return null;
    return zHit - zFa;
  }

  function round(val, decimals) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    const d = typeof decimals === 'number' ? decimals : 2;
    const factor = Math.pow(10, d);
    return Math.round(val * factor) / factor;
  }

  function formatMetric(val, decimals, suffix) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
    const d = typeof decimals === 'number' ? decimals : 1;
    return val.toFixed(d) + (suffix ? ' ' + suffix : '');
  }

  function formatDelta(val, decimals, suffix, lowerIsBetter) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return { text: '—', cls: 'delta-neutral' };
    const d = typeof decimals === 'number' ? decimals : 1;
    const sign = val > 0 ? '+' : '';
    const text = sign + val.toFixed(d) + (suffix ? ' ' + suffix : '');
    let cls = 'delta-neutral';
    if (Math.abs(val) >= 0.01) {
      const improved = lowerIsBetter ? val < 0 : val > 0;
      cls = improved ? 'delta-good' : 'delta-bad';
    }
    return { text, cls };
  }

  function formatClock(totalSeconds) {
    const clamped = Math.max(0, Math.ceil(totalSeconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function buildCsv(headers, rows) {
    const lines = [];
    lines.push(headers.map(escapeCsvCell).join(','));
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = headers.map((h) => escapeCsvCell(row[h]));
      lines.push(cells.join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  function triggerDownload(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function playGentleChime(enabled) {
    if (!enabled) return;
    try {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach(function (freq, idx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.14 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.6);
      });

      setTimeout(function () {
        if (ctx.state !== 'closed') {
          ctx.close().catch(function () {});
        }
      }, 1500);
    } catch (_) {
      // Ignore audio restriction if browser blocks autoplay audio
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;

  function showToast(message, tone) {
    const el = document.getElementById('app-toast');
    if (!el || !message) return;
    el.textContent = String(message);
    el.className = 'app-toast is-visible is-' + (tone || 'info');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastTimer = null;
      el.classList.remove('is-visible');
      el.classList.add('is-hidden');
    }, 3600);
  }

  CogLab.Utils = {
    mulberry32,
    createFreshSeed,
    shuffle,
    assignBalancedGroup,
    classifyVideoHabit,
    getTimeOfDayBucket,
    mean,
    sampleSD,
    normInv,
    computeDPrime,
    round,
    formatMetric,
    formatDelta,
    formatClock,
    escapeCsvCell,
    buildCsv,
    triggerDownload,
    playGentleChime,
    escapeHtml,
    showToast
  };
})(window);
