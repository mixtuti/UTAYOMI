// 描画関連
(function (global) {
  const statsPage = global.WakaStats;

  statsPage.createOverviewCard = function createOverviewCard(label, value, note = "") {
    const card = document.createElement("article");
    card.className = "stats-mini-card";
    card.innerHTML = `
      <div class="stats-mini-label">${statsPage.escapeHtml(label)}</div>
      <div class="stats-mini-value">${statsPage.escapeHtml(value)}</div>
      ${note ? `<div class="stats-mini-note">${statsPage.escapeHtml(note)}</div>` : ""}
    `;
    return card;
  };

  statsPage.renderStaticBarList = function renderStaticBarList(map, container, max = 20, suffix = "語") {
    if (!container) return;

    const items = statsPage.sortMapEntries(map).slice(0, max);
    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `<div class="empty-state">データがありません。</div>`;
      return;
    }

    const maxCount = Math.max(...items.map((item) => item.count), 1);

    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "stats-bar-row";

      const width = Math.max(6, (item.count / maxCount) * 100);

      row.innerHTML = `
        <div class="stats-bar-meta">
          <div class="stats-bar-label">
            <span class="stats-rank">${i + 1}</span>
            <span>${statsPage.escapeHtml(item.word)}</span>
          </div>
          <div class="stats-bar-count">${statsPage.escapeHtml(item.count)}${statsPage.escapeHtml(suffix)}</div>
        </div>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${width}%"></div>
        </div>
      `;

      container.appendChild(row);
    });
  };

  statsPage.renderBarListFromMap = function renderBarListFromMap(map, container, previousItems, previousKey, max = 10, suffix = "回") {
    if (!container) return;

    const CONFIG = statsPage.CONFIG;
    const state = statsPage.state;

    const items = statsPage.sortMapEntries(map).slice(0, max);
    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `<div class="empty-state">データがありません。</div>`;
      return;
    }

    const maxCount = Math.max(...items.map((item) => item.count), 1);
    const hasSnapshot = state.hasRankSnapshot[previousKey];

    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "stats-bar-row";

      const width = Math.max(
        6,
        Math.min((item.count / maxCount) * 100 * (CONFIG.BAR_SCALE / 3), 100)
      );

      const diff = statsPage.getRankDiffByAdjacentSwap(
        previousItems,
        items,
        item.word,
        i + 1,
        hasSnapshot
      );

      row.innerHTML = `
        <div class="stats-bar-meta">
          <div class="stats-bar-label">
            <span class="stats-rank">${i + 1}</span>
            <span>${statsPage.escapeHtml(item.word)}</span>
            <span class="stats-rank-diff ${diff.className}">${statsPage.escapeHtml(diff.text)}</span>
          </div>
          <div class="stats-bar-count">${statsPage.escapeHtml(item.count)}${statsPage.escapeHtml(suffix)}</div>
        </div>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${width}%"></div>
        </div>
      `;

      container.appendChild(row);
    });
  };

  statsPage.refreshRankSnapshotsIfNeeded = function refreshRankSnapshotsIfNeeded() {
    const CONFIG = statsPage.CONFIG;
    const state = statsPage.state;
    const stats = statsPage.stats;

    if (!statsPage.shouldRefreshRankSnapshot()) return;

    const followerTopMap = new Map();

    stats.makuraFollowers.forEach((innerMap, key) => {
      const top = [...innerMap.entries()]
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return String(a.word || "").localeCompare(String(b.word || ""), "ja");
        })[0];

      if (top) {
        followerTopMap.set(`${key} → ${top.word}`, top.count);
      }
    });

    state.previousRankItems.makura = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.makura).slice(0, CONFIG.RANK_LIMIT)
    );
    state.previousRankItems.plants = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.plants).slice(0, CONFIG.RANK_LIMIT)
    );
    state.previousRankItems.animals = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.animals).slice(0, CONFIG.RANK_LIMIT)
    );
    state.previousRankItems.places = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.places).slice(0, CONFIG.RANK_LIMIT)
    );
    state.previousRankItems.endingBlocks = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.endingBlocks).slice(0, CONFIG.RANK_LIMIT)
    );
    state.previousRankItems.independentWords = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.independentWords).slice(0, CONFIG.INDEPENDENT_WORD_LIMIT)
    );
    state.previousRankItems.moon = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.moon).slice(0, CONFIG.COOC_LIMIT)
    );
    state.previousRankItems.followers = statsPage.cloneRankItems(
      statsPage.sortMapEntries(followerTopMap).slice(0, CONFIG.RANK_LIMIT)
    );
    state.previousRankItems.longPoemLengths = statsPage.cloneRankItems(
      statsPage.sortMapEntries(stats.longPoemLengths).slice(0, CONFIG.RANK_LIMIT)
    );

    state.hasRankSnapshot.makura = true;
    state.hasRankSnapshot.plants = true;
    state.hasRankSnapshot.animals = true;
    state.hasRankSnapshot.places = true;
    state.hasRankSnapshot.endingBlocks = true;
    state.hasRankSnapshot.independentWords = true;
    state.hasRankSnapshot.moon = true;
    state.hasRankSnapshot.followers = true;
    state.hasRankSnapshot.longPoemLengths = true;
  };

  statsPage.renderTagDistribution = function renderTagDistribution() {
    statsPage.renderStaticBarList(statsPage.stats.tagDistribution, statsPage.elements.tagDistribution, 20, "語");
  };

  statsPage.renderOverview = function renderOverview() {
    const state = statsPage.state;
    const stats = statsPage.stats;
    const elements = statsPage.elements;

    if (!elements.summary || !elements.overview) return;

    const processed = state.processedCount;
    const total = state.poems.length;
    const percent = total ? ((processed / total) * 100).toFixed(1) : "0.0";

    elements.summary.textContent = state.isFinished
      ? `辞書 ${state.dictionary.length} 件 / 和歌 ${state.poems.length} 首 の解析が完了しました。`
      : `辞書 ${state.dictionary.length} 件 / 和歌 ${processed} / ${total} 首 を解析中（${percent}%）`;

    const tagKinds = stats.tagDistribution.size;
    const makuraCount = state.dictionary.filter(
      (entry) => Array.isArray(entry.tags) && entry.tags.includes("枕詞")
    ).length;

    const placeCount = state.dictionary.filter(
      (entry) => Array.isArray(entry.tags) && entry.tags.includes("地名")
    ).length;

    const conjugationCount = state.dictionary.filter((entry) => entry.conjugation).length;

    elements.overview.innerHTML = "";

    const fragment = document.createDocumentFragment();
    fragment.appendChild(statsPage.createOverviewCard("登録語数", state.dictionary.length));
    fragment.appendChild(statsPage.createOverviewCard("和歌データ数", state.poems.length));
    fragment.appendChild(statsPage.createOverviewCard("タグ種類数", tagKinds));
    fragment.appendChild(statsPage.createOverviewCard("枕詞登録数", makuraCount));
    fragment.appendChild(statsPage.createOverviewCard("地名登録数", placeCount));
    fragment.appendChild(statsPage.createOverviewCard("活用表つき語数", conjugationCount));

    elements.overview.appendChild(fragment);
    statsPage.renderProgress();
  };

  statsPage.renderProgress = function renderProgress() {
    const state = statsPage.state;
    const elements = statsPage.elements;

    if (!elements.progressText || !elements.progressBar) return;

    const processed = state.processedCount;
    const total = state.poems.length;
    const percent = total ? (processed / total) * 100 : 0;

    elements.progressText.textContent = `${processed} / ${total} 首`;
    elements.progressBar.style.width = `${percent}%`;
  };

  statsPage.renderCurrentPoem = function renderCurrentPoem(poem, index) {
    const elements = statsPage.elements;
    const CONFIG = statsPage.CONFIG;
    if (!elements.currentPoem || !elements.currentPoemMeta || !poem) return;

    const metaParts = [
      poem.collection,
      poem.book,
      poem.ref_no || (poem.poem_no ? `歌番号 ${poem.poem_no}` : ""),
      poem.author
    ].filter(Boolean);

    elements.currentPoemMeta.textContent =
      `解析中 ${index + 1}首目 / ${metaParts.join(" / ")}`;

    const poemText = statsPage.truncateText(poem.text || "本文なし", CONFIG.CURRENT_POEM_MAX_LENGTH);
    const kanaText = statsPage.truncateText(poem.kana || "", CONFIG.CURRENT_POEM_KANA_MAX_LENGTH);

    elements.currentPoem.innerHTML = `
      <div class="stats-current-poem-text">${statsPage.escapeHtml(poemText)}</div>
      ${kanaText ? `<div class="stats-current-poem-kana muted">${statsPage.escapeHtml(kanaText)}</div>` : ""}
    `;
  };

  statsPage.renderLiveStats = function renderLiveStats() {
    const CONFIG = statsPage.CONFIG;
    const stats = statsPage.stats;
    const state = statsPage.state;
    const elements = statsPage.elements;

    const flatFollowers = new Map();

    stats.makuraFollowers.forEach((innerMap, key) => {
      const top = [...innerMap.entries()]
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return String(a.word || "").localeCompare(String(b.word || ""), "ja");
        })[0];

      if (top) {
        flatFollowers.set(`${key} → ${top.word}`, top.count);
      }
    });

    statsPage.renderBarListFromMap(stats.makura, elements.makurakotoba, state.previousRankItems.makura, "makura", CONFIG.RANK_LIMIT, "首");
    statsPage.renderBarListFromMap(stats.plants, elements.plants, state.previousRankItems.plants, "plants", CONFIG.RANK_LIMIT, "首");
    statsPage.renderBarListFromMap(stats.animals, elements.animals, state.previousRankItems.animals, "animals", CONFIG.RANK_LIMIT, "首");
    statsPage.renderBarListFromMap(stats.places, elements.places, state.previousRankItems.places, "places", CONFIG.RANK_LIMIT, "首");
    statsPage.renderBarListFromMap(stats.endingBlocks, elements.endingBlocks, state.previousRankItems.endingBlocks, "endingBlocks", CONFIG.RANK_LIMIT, "首");
    statsPage.renderBarListFromMap(stats.independentWords, elements.independentWords, state.previousRankItems.independentWords, "independentWords", CONFIG.INDEPENDENT_WORD_LIMIT, "回");
    statsPage.renderBarListFromMap(stats.moon, elements.moonCooccurrence, state.previousRankItems.moon, "moon", CONFIG.COOC_LIMIT, "回");
    statsPage.renderBarListFromMap(flatFollowers, elements.makuraFollowers, state.previousRankItems.followers, "followers", CONFIG.RANK_LIMIT, "回");
    statsPage.renderBarListFromMap(stats.longPoemLengths, elements.longPoemLengths, state.previousRankItems.longPoemLengths, "longPoemLengths", CONFIG.RANK_LIMIT, "首");
  };
})(window);
