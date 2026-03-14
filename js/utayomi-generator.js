// 自動生成モード
(function (global) {
  const utayomi = global.WakaUtayomi;
  const app = global.WakaApp || {};

  // 生成フォームの入力値をまとめて取得
  utayomi.getGeneratorOptions = function getGeneratorOptions() {
    const els = utayomi.elements;

    return {
      mode: els.generatorModeSelect?.value || "guided",
      season: els.generatorSeasonFilter?.value || "",
      collection: els.generatorCollectionFilter?.value || "",
      author: els.generatorAuthorFilter?.value || "",
      keyword: String(els.generatorKeywordInput?.value || "").trim(),
      keywordMode: els.generatorKeywordModeSelect?.value || "prefer",
      style: els.generatorStyleSelect?.value || "balanced",
      shape: els.generatorShapeSelect?.value || "auto",
      useSeasonOnly: !!els.generatorUseSeasonOnlyToggle?.checked,
      useThresholdAuthor: !!els.generatorUseAuthorThresholdToggle?.checked,
      preferKigo: !!els.generatorPreferKigoToggle?.checked,
      forceRandom: false,
    };
  };

  // ボタン押下時の自動生成
  utayomi.handleGenerateAutoPoem = function handleGenerateAutoPoem() {
    const options = utayomi.getGeneratorOptions();
    const poem = utayomi.generateAutoPoem(options);

    if (!poem) {
      utayomi.renderGeneratorFailure(
        "条件に合う候補が少ないため、一首を組み立てられませんでした。条件を少し緩めてみてください。"
      );
      return;
    }

    utayomi.state.currentGeneratedPoem = poem;
    utayomi.renderGeneratedPoem(poem);
  };

  // ランダム生成
  utayomi.handleGenerateRandomPoem = function handleGenerateRandomPoem() {
    const poem = utayomi.generateAutoPoem({
      mode: "random",
      season: "",
      collection: "",
      author: "",
      keyword: "",
      keywordMode: "prefer",
      style: "balanced",
      shape: "auto",
      useSeasonOnly: false,
      useThresholdAuthor: false,
      preferKigo: false,
      forceRandom: true,
    });

    if (!poem) {
      utayomi.renderGeneratorFailure(
        "ランダム生成に失敗しました。元データの句構造を確認してください。"
      );
      return;
    }

    utayomi.state.currentGeneratedPoem = poem;
    utayomi.renderGeneratedPoem(poem);
  };

  // 自動生成の上位ラッパー
  // 複数回試行して、全体バランスの良い案を採用する
  utayomi.generateAutoPoem = function generateAutoPoem(options) {
    let bestPoem = null;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 12; attempt++) {
      const poem = utayomi.generateAutoPoemOnce(options);
      if (!poem) continue;

      let score = 0;
      score += utayomi.scoreWholePoemKeywordBalance(
        poem.lines,
        options.keyword,
        options.keywordMode
      );

      if (options.author) {
        const hasAuthorLine = poem.pickedSources.some(
          (src) => src?.author === options.author
        );
        score += hasAuthorLine ? 40 : -120;
      }

      const tails = poem.lines.map((line) => utayomi.getLineTail(line, 2));
      score += new Set(tails).size * 1.5;

      if (score > bestScore) {
        bestPoem = poem;
        bestScore = score;
      }
    }

    if (!bestPoem) return null;

    return {
      lines: bestPoem.lines,
      meta: bestPoem.meta,
      sourceMemo: bestPoem.sourceMemo,
    };
  };

  // 自動生成1回分の本体
  // 5つのスロットごとに候補句を選んで一首を作る
  utayomi.generateAutoPoemOnce = function generateAutoPoemOnce(options) {
    const candidateInfo = utayomi.resolveGenerationCandidates(options);
    const candidates = candidateInfo.candidates;
    if (!candidates.length) return null;

    const adjustedOptions = {
      ...options,
      relaxedLevel: candidateInfo.relaxedLevel,
    };

    const linePools = utayomi.buildLinePools(candidates, adjustedOptions);
    const lines = [];
    const pickedSources = [];
    const usedLineKeys = new Set();

    let forcedAuthorSlot = -1;

    if (candidateInfo.mustKeepAuthor && options.author) {
      const authorPools = linePools.map((pool) =>
        pool.filter((item) => item.source?.author === options.author)
      );

      const availableSlots = authorPools
        .map((pool, index) => ({ index, count: pool.length }))
        .filter((entry) => entry.count > 0);

      if (availableSlots.length) {
        const picked =
          availableSlots[Math.floor(Math.random() * availableSlots.length)];
        forcedAuthorSlot = picked.index;
      }
    }

    for (let i = 0; i < 5; i++) {
      let lineCandidate = null;

      if (i === forcedAuthorSlot && options.author) {
        const authorOnlyPool = linePools[i].filter(
          (item) => item.source?.author === options.author
        );

        lineCandidate = utayomi.pickBestLineForSlot(
          i,
          authorOnlyPool,
          adjustedOptions,
          lines,
          usedLineKeys,
          pickedSources
        );
      } else {
        lineCandidate = utayomi.pickBestLineForSlot(
          i,
          linePools[i],
          adjustedOptions,
          lines,
          usedLineKeys,
          pickedSources
        );
      }

      if (!lineCandidate) return null;

      lines.push(lineCandidate.line);
      pickedSources.push(lineCandidate.source);
      usedLineKeys.add(`${lineCandidate.source?.id || "x"}:${lineCandidate.line}`);
    }

    if (candidateInfo.mustKeepAuthor && options.author) {
      const hasAuthorLine = pickedSources.some(
        (src) => src?.author === options.author
      );

      if (!hasAuthorLine) {
        const authorOnlyPools = linePools.map((pool) =>
          pool.filter((item) => item.source?.author === options.author)
        );

        let replaced = false;

        for (let i = 0; i < authorOnlyPools.length; i++) {
          const replacement = utayomi.pickBestLineForSlot(
            i,
            authorOnlyPools[i],
            adjustedOptions,
            lines.filter((_, idx) => idx !== i),
            new Set(),
            pickedSources
          );

          if (replacement) {
            lines[i] = replacement.line;
            pickedSources[i] = replacement.source;
            replaced = true;
            break;
          }
        }

        if (!replaced) return null;
      }
    }

    let finalLines = [...lines];

    if (options.keyword && options.keywordMode === "must") {
      finalLines = utayomi.enforceMustKeyword(finalLines, linePools, options.keyword);
      if (!finalLines) return null;
    }

    return {
      lines: finalLines,
      pickedSources,
      meta: {
        season: options.season || "指定なし",
        collection: options.collection || "指定なし",
        author: options.author || "指定なし",
        keyword: options.keyword || "なし",
        keywordMode: options.keywordMode,
        style: options.style,
        shape: options.shape,
        candidateCount: candidates.length,
        relaxedLevel: candidateInfo.relaxedLevel,
      },
      sourceMemo: utayomi.buildSourceMemo(pickedSources, {
        ...options,
        relaxedLabel: candidateInfo.label,
      }),
    };
  };

  // 条件に合う元歌候補を返す
  utayomi.getPoemsByConditions = function getPoemsByConditions(options = {}) {
    const state = utayomi.getAppState();
    let results = [...state.poems];

    if (options.collection) {
      results = results.filter((poem) => poem.collection === options.collection);
    }

    if (options.author) {
      results = results.filter((poem) => poem.author === options.author);
    }

    if (options.season) {
      results = results.filter((poem) => poem.season === options.season);
    } else if (options.useSeasonOnly) {
      results = results.filter((poem) => poem.season);
    }

    return results.filter((poem) => utayomi.getPoemLinesFromData(poem).length >= 5);
  };

  // 条件緩和込みで候補歌集合を決める
  utayomi.resolveGenerationCandidates = function resolveGenerationCandidates(options = {}) {
    const state = utayomi.getAppState();
    const strict = utayomi.getPoemsByConditions(options);

    if (strict.length >= utayomi.constants.GENERATION_MIN_CANDIDATES || options.forceRandom) {
      return {
        candidates: strict,
        coreCandidates: strict,
        relaxedLevel: 0,
        label: "条件をそのまま使用",
        mustKeepAuthor:
          !!options.author &&
          strict.some((poem) => poem.author === options.author),
      };
    }

    if (options.author && strict.length > 0) {
      const relatives = utayomi.getPoemsByConditions({
        ...options,
        author: "",
      });

      const merged = utayomi.uniquePoemList([...strict, ...relatives]);

      return {
        candidates: merged,
        coreCandidates: strict,
        relaxedLevel: 1,
        label: `${options.author}の句を核に、条件に合う句を補完`,
        mustKeepAuthor: true,
      };
    }

    const noAuthor = utayomi.getPoemsByConditions({ ...options, author: "" });
    if (noAuthor.length >= utayomi.constants.GENERATION_SOFT_MIN_CANDIDATES) {
      return {
        candidates: noAuthor,
        coreCandidates: [],
        relaxedLevel: 2,
        label: "作者条件を緩和",
        mustKeepAuthor: false,
      };
    }

    const noColl = utayomi.getPoemsByConditions({
      ...options,
      author: "",
      collection: "",
    });
    if (noColl.length >= utayomi.constants.GENERATION_SOFT_MIN_CANDIDATES) {
      return {
        candidates: noColl,
        coreCandidates: [],
        relaxedLevel: 3,
        label: "作者・出典条件を緩和",
        mustKeepAuthor: false,
      };
    }

    return {
      candidates: state.poems.filter((p) => utayomi.getPoemLinesFromData(p).length >= 5),
      coreCandidates: [],
      relaxedLevel: 4,
      label: "全体からランダム",
      mustKeepAuthor: false,
    };
  };

  // 5つの句スロットごとに候補プールを作る
  utayomi.buildLinePools = function buildLinePools(poems, options) {
    const pools = [[], [], [], [], []];
    poems.forEach((poem) => {
      const lines = utayomi.getPoemLinesFromData(poem);
      if (lines.length < 5) return;

      lines.slice(0, 5).forEach((line, i) => {
        pools[i].push({
          line,
          source: poem,
          score: utayomi.scoreLine(line, poem, options, i),
        });
      });
    });

    return pools.map((pool) => pool.sort((a, b) => b.score - a.score));
  };

  // 1句単位の基本スコア
  utayomi.scoreLine = function scoreLine(line, poem, options, index) {
    let score = Math.random() * 5;

    if (options.season && poem.season === options.season) score += 8;
    if (options.collection && poem.collection === options.collection) score += 5;
    if (options.author && poem.author === options.author) score += 7;

    if (options.keyword) {
      const normLine = utayomi.normalizeLite(line);
      const normKw = utayomi.normalizeLite(options.keyword);

      if (options.keywordMode === "theme") {
        score += utayomi.scoreKeywordMood(line, options.keyword, options.keywordMode);
      } else if (normLine.includes(normKw)) {
        score += options.keywordMode === "must" ? 4 : 2;
      }
    }

    if (options.preferKigo && typeof app.detectKigoWords === "function") {
      const kigoWords = app.detectKigoWords(poem);
      if (kigoWords && kigoWords.length) score += 2;
    }

    if (options.style === "classical") {
      if (/[けりぬつらむけむかなこそぞ]/.test(line)) score += 2;
    }

    if (options.style === "simple") {
      score += Math.max(0, 10 - String(line).length * 0.3);
    }

    if (options.style === "experimental") {
      score += index === 2 ? 3 : 1;
    }

    if (options.shape === "57577") {
      const target = [5, 7, 5, 7, 7][index];
      const diff = Math.abs(utayomi.countKanaLike(line) - target);
      score += Math.max(0, 6 - diff * 2);
    }

    if (options.forceRandom) {
      score = Math.random() * 100;
    }

    return score;
  };

  // 指定スロットで最良候補を1句選ぶ
  utayomi.pickBestLineForSlot = function pickBestLineForSlot(
    slotIndex,
    pool,
    options,
    currentLines,
    usedLineKeys,
    pickedSources = []
  ) {
    if (!Array.isArray(pool) || !pool.length) return null;

    const candidates = utayomi.shuffleArray(pool).slice(0, Math.min(80, pool.length));
    const previous = currentLines[currentLines.length - 1] || "";

    let best = null;
    let bestScore = -Infinity;

    for (const item of candidates) {
      const lineKey = `${item.source?.id || "x"}:${item.line}`;
      if (usedLineKeys.has(lineKey)) continue;

      if (options.keyword) {
        const currentKeywordCount = utayomi.countKeywordOccurrences(
          currentLines,
          options.keyword
        );
        const maxKeywordCount = utayomi.getKeywordMaxCount(options.keywordMode);

        if (
          utayomi.normalizeLite(item.line).includes(utayomi.normalizeLite(options.keyword)) &&
          currentKeywordCount >= maxKeywordCount
        ) {
          continue;
        }
      }

      let tempScore = item.score;
      tempScore += utayomi.scoreLineConnection(previous, item.line, options, slotIndex);
      tempScore += utayomi.scoreLineVariety(currentLines, item.line);
      tempScore += utayomi.scoreThemeKeywordPenalty(
        item.line,
        currentLines,
        options.keyword,
        options.keywordMode
      );
      tempScore += utayomi.scoreKeywordMood(
        item.line,
        options.keyword,
        options.keywordMode
      );

      const sameAuthorCount = pickedSources.filter(
        (src) => src?.author && src.author === item.source?.author
      ).length;
      const sameCollectionCount = pickedSources.filter(
        (src) => src?.collection && src.collection === item.source?.collection
      ).length;

      tempScore -= sameAuthorCount * 1.2;
      tempScore -= sameCollectionCount * 0.8;

      const allUsedKanji = [
        ...new Set(currentLines.join("").match(/[\u4E00-\u9FFF]/g) || []),
      ];
      const keywordChars = options.keyword
        ? options.keyword.match(/[\u4E00-\u9FFF]/g) || []
        : [];

      for (const k of allUsedKanji) {
        if (keywordChars.includes(k)) continue;
        if (item.line.includes(k)) tempScore += 1.2;
      }

      if (tempScore > bestScore) {
        best = item;
        bestScore = tempScore;
      }
    }

    return best;
  };
})(window);
