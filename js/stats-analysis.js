// 解析ロジック
(function (global) {
  const statsPage = global.WakaStats;

  statsPage.analyzePoem = function analyzePoem(poem, prepared) {
    const CONFIG = statsPage.CONFIG;
    const stats = statsPage.stats;

    const searchTokens = Array.isArray(poem.search_tokens)
      ? poem.search_tokens
      : Array.isArray(poem.tokens)
        ? poem.tokens
        : [];

    const normalizedTokens = searchTokens
      .map((token) => statsPage.normalize(token))
      .filter(Boolean);

    const phraseTokens = statsPage.getPhraseBlocks(poem);

    const joined = statsPage.normalize([
      poem.text || "",
      poem.kana || "",
      ...searchTokens
    ].join(" "));

    prepared.makura.forEach((entry) => {
      if (statsPage.entryMatchesPoem(entry, joined, normalizedTokens)) {
        statsPage.increment(stats.makura, entry.word);
      }
    });

    prepared.plants.forEach((entry) => {
      if (statsPage.entryMatchesPoem(entry, joined, normalizedTokens)) {
        statsPage.increment(stats.plants, entry.word);
      }
    });

    prepared.animals.forEach((entry) => {
      if (statsPage.entryMatchesPoem(entry, joined, normalizedTokens)) {
        statsPage.increment(stats.animals, entry.word);
      }
    });

    prepared.places.forEach((entry) => {
      if (statsPage.entryMatchesPoem(entry, joined, normalizedTokens)) {
        statsPage.increment(stats.places, entry.word);
      }
    });

    const endingBlock = phraseTokens.at(-1) || "";
    if (endingBlock) {
      statsPage.increment(stats.endingBlocks, endingBlock);
    }

    const tokenLength = phraseTokens.length;
    if (tokenLength >= CONFIG.LONG_POEM_MIN_TOKENS) {
      statsPage.increment(stats.longPoemLengths, `${tokenLength}句`);
    }

    searchTokens.forEach((token) => {
      const word = String(token || "").trim();
      if (!statsPage.isIndependentToken(word)) return;
      statsPage.increment(stats.independentWords, word);
    });

    if (joined.includes(statsPage.normalize("月"))) {
      searchTokens.forEach((token) => {
        const word = String(token || "").trim();
        if (!word || word === "月" || word.length <= 1) return;
        statsPage.increment(stats.moon, word);
      });
    }

    prepared.makura.forEach((entry) => {
      const entryMatched = statsPage.entryMatchesPoem(entry, joined, normalizedTokens);
      if (!entryMatched) return;

      for (let i = 0; i < searchTokens.length; i++) {
        const token = statsPage.normalize(searchTokens[i]);
        const matchedByText = Array.isArray(entry.textForms) && entry.textForms.includes(token);
        const matchedByReading = Array.isArray(entry.readingForms) && entry.readingForms.includes(token);

        if (matchedByText || matchedByReading) {
          const next = String(searchTokens[i + 1] || "").trim();
          if (next) {
            statsPage.incrementNested(stats.makuraFollowers, entry.word, next);
          }
        }
      }
    });
  };

  statsPage.startLiveAnalysis = function startLiveAnalysis(prepared) {
    const state = statsPage.state;
    const CONFIG = statsPage.CONFIG;
    let index = 0;
    const chunk = CONFIG.ANALYSIS_CHUNK;

    function step() {
      const end = Math.min(index + chunk, state.poems.length);

      for (let i = index; i < end; i++) {
        statsPage.analyzePoem(state.poems[i], prepared);
        statsPage.renderCurrentPoem(state.poems[i], i);
      }

      index = end;
      state.processedCount = index;

      statsPage.renderOverview();
      statsPage.renderLiveStats();
      statsPage.refreshRankSnapshotsIfNeeded();

      if (index < state.poems.length) {
        setTimeout(step, CONFIG.ANALYSIS_DELAY);
      } else {
        state.isFinished = true;

        statsPage.renderOverview();
        statsPage.renderLiveStats();
        statsPage.refreshRankSnapshotsIfNeeded();

        if (statsPage.elements.currentPoemMeta) {
          statsPage.elements.currentPoemMeta.textContent = "解析完了";
        }
      }
    }

    step();
  };
})(window);
