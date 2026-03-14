// 共作補完モード
(function (global) {
  const utayomi = global.WakaUtayomi;

  // 共作フォームの入力値をまとめる
  utayomi.getAssistOptions = function getAssistOptions() {
    const els = utayomi.elements;
    return {
      season: els.assistSeasonFilter?.value || "",
      collection: els.assistCollectionFilter?.value || "",
      author: els.assistAuthorFilter?.value || "",
      keyword: String(els.assistKeywordInput?.value || "").trim(),
      fillMode: els.assistFillModeSelect?.value || "natural",
      userLines: utayomi.getAssistInputLines(),
    };
  };

  // 5句入力欄の内容を配列化
  utayomi.getAssistInputLines = function getAssistInputLines() {
    const els = utayomi.elements;
    return [
      els.assistLine1?.value || "",
      els.assistLine2?.value || "",
      els.assistLine3?.value || "",
      els.assistLine4?.value || "",
      els.assistLine5?.value || "",
    ].map((line) => String(line || "").trim());
  };

  utayomi.handleAssistGenerate = function handleAssistGenerate() {
    const options = utayomi.getAssistOptions();
    const poem = utayomi.generateAssistPoem(options);

    if (!poem) {
      utayomi.renderAssistFailure(
        "入力された句や条件に合う補完候補が見つかりませんでした。空欄を増やすか条件を緩めてみてください。"
      );
      return;
    }

    utayomi.state.currentAssistPoem = poem;
    utayomi.renderAssistPoem(poem);
  };

  // ユーザー固定句を残しつつ、空欄を補う
  utayomi.generateAssistPoem = function generateAssistPoem(options) {
    const fixedCount = options.userLines.filter(Boolean).length;
    if (fixedCount < 1 || fixedCount > 4) return null;

    const candidateInfo = utayomi.resolveGenerationCandidates(options);
    const sourcePoems = candidateInfo.candidates;
    if (!sourcePoems.length) return null;

    const adjustedOptions = {
      ...options,
      relaxedLevel: candidateInfo.relaxedLevel,
    };

    const linePools = utayomi.buildLinePools(sourcePoems, adjustedOptions);
    const resultLines = [...options.userLines];
    const usedLineKeys = new Set(resultLines.filter(Boolean));
    const pickedSources = [null, null, null, null, null];
    const userLockedSlots = options.userLines.map((line) => !!line);

    const forcedAuthorSlot = utayomi.pickForcedAssistAuthorSlot(
      linePools,
      options,
      options.userLines,
      candidateInfo.mustKeepAuthor
    );

    for (let i = 0; i < 5; i++) {
      if (resultLines[i]) continue;

      let lineCandidate = null;

      if (i === forcedAuthorSlot && options.author) {
        const authorOnlyPool = linePools[i].filter(
          (item) => item.source?.author === options.author
        );

        lineCandidate = utayomi.pickAssistLineForSlot(
          i,
          authorOnlyPool,
          adjustedOptions,
          resultLines,
          usedLineKeys,
          pickedSources
        );
      } else {
        lineCandidate = utayomi.pickAssistLineForSlot(
          i,
          linePools[i],
          adjustedOptions,
          resultLines,
          usedLineKeys,
          pickedSources
        );
      }

      if (!lineCandidate) return null;

      resultLines[i] = lineCandidate.line;
      usedLineKeys.add(lineCandidate.line);
      pickedSources[i] = lineCandidate.source;
    }

    if (candidateInfo.mustKeepAuthor && options.author) {
      const hasAuthorLine = utayomi.assistHasAuthorLine(
        resultLines,
        pickedSources,
        options
      );

      if (!hasAuthorLine) {
        const replaced = utayomi.enforceAssistAuthorLine(
          resultLines,
          pickedSources,
          linePools,
          adjustedOptions,
          userLockedSlots
        );

        if (!replaced) return null;
      }
    }

    if (options.keyword && options.keywordMode === "must") {
      const fixedKeywordCount = utayomi.countKeywordInLines(resultLines, options.keyword);

      if (fixedKeywordCount === 0) {
        const replaced = utayomi.enforceMustKeyword(
          resultLines,
          linePools,
          options.keyword,
          options.userLines
        );

        if (!replaced) return null;
        resultLines.splice(0, 5, ...replaced);
      }
    }

    return {
      lines: resultLines,
      pickedSources,
      meta: {
        season: options.season || "指定なし",
        collection: options.collection || "指定なし",
        author: options.author || "指定なし",
        keyword: options.keyword || "なし",
        fillMode: options.fillMode,
        fixedCount,
        fixedSlots: resultLines
          .map((line, index) => (options.userLines[index] ? index + 1 : null))
          .filter(Boolean),
        candidateCount: sourcePoems.length,
        relaxedLevel: candidateInfo.relaxedLevel,
      },
      sourceMemo: utayomi.buildAssistSourceMemo(
        {
          ...options,
          relaxedLabel: candidateInfo.label,
        },
        pickedSources.filter(Boolean)
      ),
    };
  };

  // 共作補完時のスロット選択
  utayomi.pickAssistLineForSlot = function pickAssistLineForSlot(
    slotIndex,
    pool,
    options,
    currentLines,
    usedLineKeys,
    pickedSources = []
  ) {
    if (!Array.isArray(pool) || !pool.length) return null;

    const prev = currentLines[slotIndex - 1] || "";
    const next = currentLines[slotIndex + 1] || "";
    const sampled = utayomi.shuffleArray(pool).slice(0, Math.min(80, pool.length));

    let best = null;
    let bestScore = -Infinity;

    for (const item of sampled) {
      if (usedLineKeys.has(item.line)) continue;

      if (options.keyword) {
        const currentKeywordCount = utayomi.countKeywordOccurrences(
          currentLines.filter(Boolean),
          options.keyword
        );
        const maxKeywordCount = utayomi.getKeywordMaxCount(
          options.keywordMode || "prefer"
        );

        if (
          utayomi.normalizeLite(item.line).includes(utayomi.normalizeLite(options.keyword)) &&
          currentKeywordCount >= maxKeywordCount
        ) {
          continue;
        }
      }

      let score = item.score;
      score += utayomi.scoreLineConnection(prev, item.line, options, slotIndex);
      score += utayomi.scoreNeighborAffinity(item.line, next, options);
      score += utayomi.scoreLineVariety(currentLines.filter(Boolean), item.line);
      score += utayomi.scoreKeywordUsage(
        item.line,
        currentLines.filter(Boolean),
        options.keyword,
        options.keywordMode || "prefer"
      );
      score += utayomi.scoreKeywordMood(
        item.line,
        options.keyword,
        options.keywordMode || "prefer"
      );
      score += utayomi.scoreThemeKeywordPenalty(
        item.line,
        currentLines.filter(Boolean),
        options.keyword,
        options.keywordMode || "prefer"
      );

      const sameAuthorCount = pickedSources.filter(
        (src) => src?.author && src.author === item.source?.author
      ).length;
      const sameCollectionCount = pickedSources.filter(
        (src) => src?.collection && src.collection === item.source?.collection
      ).length;

      score -= sameAuthorCount * 1.0;
      score -= sameCollectionCount * 0.6;

      if (options.fillMode === "tight") {
        const target = [5, 7, 5, 7, 7][slotIndex];
        score += Math.max(
          0,
          8 - Math.abs(utayomi.countKanaLike(item.line) - target) * 2
        );
      }

      if (
        options.fillMode === "classical" &&
        /けり|かな|らむ|けむ|つつ|ぬ/.test(item.line)
      ) {
        score += 2;
      }

      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }

    return best;
  };

  utayomi.pickForcedAssistAuthorSlot = function pickForcedAssistAuthorSlot(
    linePools,
    options,
    userLines,
    mustKeepAuthor
  ) {
    if (!mustKeepAuthor || !options.author) return -1;

    const availableSlots = [];

    for (let i = 0; i < 5; i++) {
      if (userLines[i]) continue;

      const authorPool = linePools[i].filter(
        (item) => item.source?.author === options.author
      );

      if (authorPool.length > 0) {
        availableSlots.push(i);
      }
    }

    if (!availableSlots.length) return -1;

    return availableSlots[Math.floor(Math.random() * availableSlots.length)];
  };

  utayomi.assistHasAuthorLine = function assistHasAuthorLine(lines, pickedSources, options) {
    if (!options.author) return true;
    return pickedSources.some((src) => src?.author === options.author);
  };

  utayomi.enforceAssistAuthorLine = function enforceAssistAuthorLine(
    lines,
    pickedSources,
    linePools,
    options,
    userLockedSlots = []
  ) {
    if (!options.author) return false;

    if (pickedSources.some((src) => src?.author === options.author)) {
      return true;
    }

    for (let i = 0; i < 5; i++) {
      if (userLockedSlots[i]) continue;

      const authorOnlyPool = linePools[i].filter(
        (item) => item.source?.author === options.author
      );

      if (!authorOnlyPool.length) continue;

      const replacement = authorOnlyPool[0];
      lines[i] = replacement.line;
      pickedSources[i] = replacement.source;
      return true;
    }

    return false;
  };

  utayomi.resetAssistInputs = function resetAssistInputs() {
    const els = utayomi.elements;

    [
      els.assistLine1,
      els.assistLine2,
      els.assistLine3,
      els.assistLine4,
      els.assistLine5,
    ].forEach((input) => {
      if (input) input.value = "";
    });

    if (els.assistKeywordInput) els.assistKeywordInput.value = "";
    if (els.assistSeasonFilter) els.assistSeasonFilter.value = "";
    if (els.assistCollectionFilter) els.assistCollectionFilter.value = "";
    if (els.assistAuthorFilter) els.assistAuthorFilter.value = "";
    if (els.assistFillModeSelect) els.assistFillModeSelect.value = "natural";

    utayomi.renderAssistEmptyState();
  };

  utayomi.presetAssistFirstLineOnly = function presetAssistFirstLineOnly() {
    utayomi.resetAssistInputs();
    utayomi.elements.assistLine1.value = "春の野に";
  };

  utayomi.presetAssistLastLineOnly = function presetAssistLastLineOnly() {
    utayomi.resetAssistInputs();
    utayomi.elements.assistLine5.value = "名こそ惜しけれ";
  };

  utayomi.presetAssistRandomSlots = function presetAssistRandomSlots() {
    const state = utayomi.getAppState();
    utayomi.resetAssistInputs();

    const count = Math.floor(Math.random() * 4) + 1;
    const slotIndexes = utayomi.shuffleArray([0, 1, 2, 3, 4])
      .slice(0, count)
      .sort((a, b) => a - b);

    const validPoems = state.poems.filter(
      (poem) => utayomi.getPoemLinesFromData(poem).length >= 5
    );

    const randomPoem = validPoems[Math.floor(Math.random() * validPoems.length)];
    const lines = randomPoem ? utayomi.getPoemLinesFromData(randomPoem) : [];

    slotIndexes.forEach((slotIndex) => {
      const input = utayomi.elements[`assistLine${slotIndex + 1}`];
      if (input) input.value = lines[slotIndex] || "";
    });
  };
})(window);
