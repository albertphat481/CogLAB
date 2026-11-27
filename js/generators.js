(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  function getDeps() {
    return {
      Config: CogLab.Config,
      Utils: CogLab.Utils
    };
  }

  function hasStroopViolation(seq) {
    let sameCondRun = 1;
    let sameKeyRun = 1;
    for (let i = 1; i < seq.length; i++) {
      const prev = seq[i - 1];
      const curr = seq[i];
      if (prev.wordId === curr.wordId && prev.inkId === curr.inkId) {
        return true;
      }
      sameCondRun = curr.condition === prev.condition ? sameCondRun + 1 : 1;
      sameKeyRun = curr.correctKey === prev.correctKey ? sameKeyRun + 1 : 1;
      if (sameCondRun > 3 || sameKeyRun > 3) {
        return true;
      }
    }
    return false;
  }

  function generateStroopTrials(count, seed) {
    const { Config, Utils } = getDeps();
    const colors = Config.STROOP_COLORS;
    const rng = Utils.mulberry32(typeof seed === 'number' ? seed : Utils.createFreshSeed());

    const congruentTotal = Math.floor(count / 2);
    const incongruentTotal = count - congruentTotal;

    const pool = [];
    // Balanced congruent trials across all 4 colors
    const congColors = Utils.shuffle(colors, rng);
    for (let i = 0; i < congruentTotal; i++) {
      const c = congColors[i % colors.length];
      pool.push({
        wordId: c.id,
        wordText: c.label,
        inkId: c.id,
        inkHex: c.hex,
        condition: 'congruent',
        correctKey: c.key
      });
    }

    // Balanced incongruent trials across all 4 ink colors and varied word labels
    const inkOrder = Utils.shuffle(colors, rng);
    for (let i = 0; i < incongruentTotal; i++) {
      const ink = inkOrder[i % colors.length];
      const otherWords = colors.filter((c) => c.id !== ink.id);
      const word = otherWords[Math.floor(rng() * otherWords.length)];
      pool.push({
        wordId: word.id,
        wordText: word.label,
        inkId: ink.id,
        inkHex: ink.hex,
        condition: 'incongruent',
        correctKey: ink.key
      });
    }

    let chosen = Utils.shuffle(pool, rng);
    for (let attempt = 0; attempt < 250; attempt++) {
      if (!hasStroopViolation(chosen)) break;
      chosen = Utils.shuffle(pool, rng);
    }

    // Fallback greedy swap if ultra-short sequence still had an immediate duplicate
    if (hasStroopViolation(chosen)) {
      for (let i = 1; i < chosen.length; i++) {
        if (chosen[i].wordId === chosen[i - 1].wordId && chosen[i].inkId === chosen[i - 1].inkId) {
          for (let j = i + 1; j < chosen.length; j++) {
            if (chosen[j].wordId !== chosen[i - 1].wordId || chosen[j].inkId !== chosen[i - 1].inkId) {
              const tmp = chosen[i];
              chosen[i] = chosen[j];
              chosen[j] = tmp;
              break;
            }
          }
        }
      }
    }

    return chosen.map(function (item, idx) {
      return {
        trialIndex: idx,
        test: 'stroop',
        wordId: item.wordId,
        wordText: item.wordText,
        inkId: item.inkId,
        inkHex: item.inkHex,
        condition: item.condition,
        correctKey: item.correctKey
      };
    });
  }

  function hasGoNoGoViolation(seq) {
    if (seq.length >= 2 && (seq[0] !== 'go' || seq[1] !== 'go')) {
      return true;
    }
    let nogoRun = 0;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i] === 'nogo') {
        nogoRun++;
        if (nogoRun > 2) return true;
      } else {
        nogoRun = 0;
      }
    }
    return false;
  }

  function generateGoNoGoTrials(count, seed) {
    const { Utils } = getDeps();
    const rng = Utils.mulberry32(typeof seed === 'number' ? seed : Utils.createFreshSeed());

    const goCount = Math.round(count * 0.8);
    const nogoCount = Math.max(0, count - goCount);

    const restPool = [];
    const leadGos = Math.min(2, goCount);
    for (let i = 0; i < goCount - leadGos; i++) restPool.push('go');
    for (let i = 0; i < nogoCount; i++) restPool.push('nogo');

    let seq = [];
    for (let attempt = 0; attempt < 250; attempt++) {
      const tail = Utils.shuffle(restPool, rng);
      seq = [];
      for (let k = 0; k < leadGos; k++) seq.push('go');
      seq = seq.concat(tail);
      if (!hasGoNoGoViolation(seq)) break;
    }

    return seq.map(function (cond, idx) {
      return {
        trialIndex: idx,
        test: 'gonogo',
        condition: cond,
        correctKey: cond === 'go' ? ' ' : null
      };
    });
  }

  function hasTwoBackTargetRunViolation(flags) {
    let run = 0;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i]) {
        run++;
        if (run > 2) return true;
      } else {
        run = 0;
      }
    }
    return false;
  }

  function generateTwoBackTrials(count, seed) {
    const { Config, Utils } = getDeps();
    const letters = Config.TWOBACK_LETTERS;
    const rng = Utils.mulberry32(typeof seed === 'number' ? seed : Utils.createFreshSeed());

    const evaluableCount = Math.max(0, count - 2);
    const targetCount = Math.min(evaluableCount, Math.max(1, Math.round(count * 0.3)));

    // Choose target mask on evaluable indices [0 .. evaluableCount - 1]
    const maskPool = [];
    for (let i = 0; i < targetCount; i++) maskPool.push(true);
    for (let i = targetCount; i < evaluableCount; i++) maskPool.push(false);

    let evalMask = Utils.shuffle(maskPool, rng);
    for (let attempt = 0; attempt < 250; attempt++) {
      if (!hasTwoBackTargetRunViolation(evalMask)) break;
      evalMask = Utils.shuffle(maskPool, rng);
    }

    const trials = [];
    const chosenLetters = [];

    for (let i = 0; i < count; i++) {
      const isBuffer = i < 2;
      const isTarget = !isBuffer && evalMask[i - 2] === true;
      let letter;

      if (isBuffer) {
        // Avoid immediate self-repeat on buffer trials to keep flow natural
        const candidates = i === 1 ? letters.filter((l) => l !== chosenLetters[0]) : letters;
        letter = candidates[Math.floor(rng() * candidates.length)];
      } else if (isTarget) {
        letter = chosenLetters[i - 2];
      } else {
        // Strictly exclude i - 2 so accidental 2-back matches cannot happen on non-targets
        const twoBackLetter = chosenLetters[i - 2];
        const candidates = letters.filter((l) => l !== twoBackLetter);
        letter = candidates[Math.floor(rng() * candidates.length)];
      }

      chosenLetters.push(letter);
      trials.push({
        trialIndex: i,
        test: 'twoback',
        letter: letter,
        isBuffer: isBuffer,
        isTarget: isTarget,
        condition: isBuffer ? 'buffer' : isTarget ? 'target' : 'nontarget',
        correctKey: isTarget ? ' ' : null
      });
    }

    // Verify 2-back target count invariant
    let actualTargets = 0;
    for (let i = 2; i < trials.length; i++) {
      if (trials[i].letter === trials[i - 2].letter) actualTargets++;
    }
    if (actualTargets !== targetCount) {
      throw new Error('2-Back invariant failed: expected ' + targetCount + ' targets, got ' + actualTargets);
    }

    return trials;
  }

  function signatureStroop(seq) {
    return seq.map((t) => t.wordId + ':' + t.inkId).join('|');
  }

  function signatureGoNoGo(seq) {
    return seq.map((t) => (t.condition === 'go' ? '1' : '0')).join('');
  }

  function signatureTwoBack(seq) {
    return seq.map((t) => t.letter).join('');
  }

  function generateBattery(modeConfig, previousBattery) {
    const { Utils } = getDeps();

    let stroop = generateStroopTrials(modeConfig.stroopTrials, Utils.createFreshSeed());
    let gonogo = generateGoNoGoTrials(modeConfig.gonogoTrials, Utils.createFreshSeed());
    let twoback = generateTwoBackTrials(modeConfig.twobackTrials, Utils.createFreshSeed());

    if (previousBattery) {
      let guard = 0;
      while (signatureStroop(stroop) === signatureStroop(previousBattery.stroop) && guard < 10) {
        stroop = generateStroopTrials(modeConfig.stroopTrials, Utils.createFreshSeed() + guard + 1);
        guard++;
      }
      guard = 0;
      while (signatureGoNoGo(gonogo) === signatureGoNoGo(previousBattery.gonogo) && guard < 10) {
        gonogo = generateGoNoGoTrials(modeConfig.gonogoTrials, Utils.createFreshSeed() + guard + 1);
        guard++;
      }
      guard = 0;
      while (signatureTwoBack(twoback) === signatureTwoBack(previousBattery.twoback) && guard < 10) {
        twoback = generateTwoBackTrials(modeConfig.twobackTrials, Utils.createFreshSeed() + guard + 1);
        guard++;
      }
    }

    return { stroop, gonogo, twoback };
  }

  CogLab.Generators = {
    generateStroopTrials,
    generateGoNoGoTrials,
    generateTwoBackTrials,
    generateBattery
  };
})(window);
