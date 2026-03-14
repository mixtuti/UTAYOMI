// 句選択スコアリング
(function (global) {
  const utayomi = global.WakaUtayomi;

  utayomi.countKeywordInLines = function countKeywordInLines(lines, keyword) {
    const safeKeyword = utayomi.normalizeLite(keyword);
    if (!safeKeyword) return 0;

    return lines.reduce((count, line) => {
      return count + (utayomi.normalizeLite(line).includes(safeKeyword) ? 1 : 0);
    }, 0);
  };

  utayomi.countKeywordOccurrences = function countKeywordOccurrences(lines, keyword) {
    return utayomi.countKeywordInLines(lines, keyword);
  };

  utayomi.getKeywordMaxCount = function getKeywordMaxCount(keywordMode) {
    if (keywordMode === "must") return 1;
    if (keywordMode === "prefer") return 1;
    if (keywordMode === "theme") return 0;
    return 1;
  };

  // 句同士の接続感をざっくり評価
  utayomi.scoreLineConnection = function scoreLineConnection(previousLine, currentLine, options, slotIndex) {
    if (!previousLine) return 0;

    const prevLast = utayomi.getLineTail(previousLine);
    const currentHead = utayomi.getLineHead(currentLine);

    let score = 0;
    if (prevLast && currentHead && prevLast !== currentHead) score += 1;

    const prevChars = new Set(utayomi.splitChars(previousLine));
    const currentChars = new Set(utayomi.splitChars(currentLine));
    const overlap = [...prevChars].filter((char) => currentChars.has(char)).length;
    score += Math.min(3, overlap * 0.5);

    if (options.shape === "57577") {
      const target = [5, 7, 5, 7, 7][slotIndex];
      score += Math.max(0, 4 - Math.abs(utayomi.countKanaLike(currentLine) - target));
    }

    return score;
  };

  utayomi.scoreNeighborAffinity = function scoreNeighborAffinity(line, neighborLine) {
    if (!neighborLine) return 0;

    const lineChars = new Set(utayomi.splitChars(line));
    const neighborChars = new Set(utayomi.splitChars(neighborLine));
    const overlap = [...lineChars].filter((char) => neighborChars.has(char)).length;
    return Math.min(4, overlap * 0.7);
  };

  utayomi.scoreLineVariety = function scoreLineVariety(existingLines, candidateLine) {
    const existingJoined = existingLines.join("");
    if (!existingJoined) return 0;

    let penalty = 0;
    if (existingLines.includes(candidateLine)) penalty -= 10;

    const tail = utayomi.getLineTail(candidateLine, 2);
    const repeatedTailCount = existingLines.filter(
      (line) => utayomi.getLineTail(line, 2) === tail
    ).length;
    penalty -= repeatedTailCount * 1.5;

    return penalty;
  };

  // keyword を直接入れたい / 避けたい の調整
  utayomi.scoreKeywordUsage = function scoreKeywordUsage(candidateLine, currentLines, keyword, keywordMode) {
    if (!keyword || keywordMode === "theme") return 0;

    const safeKeyword = utayomi.normalizeLite(keyword);
    const includesKeyword = utayomi.normalizeLite(candidateLine).includes(safeKeyword);
    const currentCount = utayomi.countKeywordInLines(currentLines, keyword);

    if (!includesKeyword) return 0;

    if (currentCount === 0) {
      return keywordMode === "must" ? 10 : 5;
    }

    if (currentCount === 1) return -6;
    return -14;
  };

  // keyword を直接出さず、連想語で寄せる評価
  utayomi.scoreKeywordMood = function scoreKeywordMood(candidateLine, keyword, keywordMode) {
    if (!keyword || keywordMode !== "theme") return 0;

    const assoc = utayomi.keywordAssociations[keyword] || [];
    const normalizedLine = utayomi.normalizeLite(candidateLine);

    let score = 0;

    for (const word of assoc) {
      if (normalizedLine.includes(utayomi.normalizeLite(word))) {
        score += 3;
      }
    }

    if (normalizedLine.includes(utayomi.normalizeLite(keyword))) {
      score -= 8;
    }

    return score;
  };

  utayomi.scoreThemeKeywordPenalty = function scoreThemeKeywordPenalty(
    candidateLine,
    currentLines,
    keyword,
    keywordMode
  ) {
    if (!keyword) return 0;

    const safeKeyword = utayomi.normalizeLite(keyword);
    const includesKeyword = utayomi.normalizeLite(candidateLine).includes(safeKeyword);
    const currentCount = utayomi.countKeywordOccurrences(currentLines, keyword);

    if (keywordMode === "must") {
      if (!includesKeyword) return 0;
      if (currentCount === 0) return 6;
      return -40;
    }

    if (keywordMode === "prefer") {
      if (!includesKeyword) return 0;
      if (currentCount === 0) return 2;
      return -35;
    }

    if (keywordMode === "theme") {
      if (!includesKeyword) return 0;
      return -50;
    }

    return 0;
  };

  // 一首全体として keyword の使い方が自然かを評価
  utayomi.scoreWholePoemKeywordBalance = function scoreWholePoemKeywordBalance(lines, keyword, keywordMode) {
    if (!keyword) return 0;

    const count = utayomi.countKeywordOccurrences(lines, keyword);

    if (keywordMode === "must") {
      if (count === 1) return 30;
      if (count === 0) return -80;
      if (count === 2) return -60;
      return -120;
    }

    if (keywordMode === "prefer") {
      if (count === 0) return 8;
      if (count === 1) return 16;
      if (count === 2) return -45;
      return -100;
    }

    if (keywordMode === "theme") {
      if (count === 0) return 20;
      if (count === 1) return -20;
      return -100;
    }

    return 0;
  };

  // must 指定時、最低1句は keyword を含むように補正する
  utayomi.enforceMustKeyword = function enforceMustKeyword(lines, linePools, keyword, lockedLines = []) {
    if (utayomi.countKeywordInLines(lines, keyword) >= 1) {
      return lines;
    }

    const safeKeyword = utayomi.normalizeLite(keyword);
    if (!safeKeyword) return lines;

    for (let i = 0; i < linePools.length; i++) {
      if (lockedLines[i]) continue;

      const candidate = linePools[i].find((item) =>
        utayomi.normalizeLite(item.line).includes(safeKeyword)
      );

      if (!candidate) continue;

      const cloned = [...lines];
      cloned[i] = candidate.line;
      return cloned;
    }

    return null;
  };
})(window);
