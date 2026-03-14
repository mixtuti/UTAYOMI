// 絞り込み条件・並び替え
(function (global) {
  const terms = global.WakaTerms;

  // 品詞候補一覧
  terms.getPartOptions = function getPartOptions() {
    return terms.uniqueStrings(terms.state.terms.map((term) => term.partOfSpeech));
  };

  // タグ候補一覧
  terms.getTagOptions = function getTagOptions() {
    return terms.uniqueStrings(
      terms.state.terms.flatMap((term) => Array.isArray(term.tags) ? term.tags : [])
    ).sort((a, b) => a.localeCompare(b, "ja"));
  };

  // select に option を追加
  terms.fillSelect = function fillSelect(select, values) {
    const first = select.querySelector("option");
    select.innerHTML = "";
    if (first) select.appendChild(first);

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  };

  // 画面上部のクイックタグを描画
  terms.renderQuickTags = function renderQuickTags() {
    const els = terms.elements;
    if (!els.tagQuickLinks) return;

    els.tagQuickLinks.innerHTML = "";

    terms.getTagOptions().slice(0, 40).forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-button";
      button.textContent = tag;

      button.addEventListener("click", () => {
        els.tagFilter.value = tag;
        terms.state.currentPage = 1;
        terms.applyFilters();
      });

      els.tagQuickLinks.appendChild(button);
    });
  };

  // 並び順に応じて並べ替える
  terms.sortTerms = function sortTerms(termList, sortKey) {
    const list = [...termList];

    list.sort((a, b) => {
      const wordA = String(a.word || "");
      const wordB = String(b.word || "");
      const readingA = String(a.reading || "");
      const readingB = String(b.reading || "");
      const partA = String(a.partOfSpeech || "");
      const partB = String(b.partOfSpeech || "");
      const tagsA = Array.isArray(a.tags) ? a.tags.length : 0;
      const tagsB = Array.isArray(b.tags) ? b.tags.length : 0;

      switch (sortKey) {
        case "word-desc":
          return wordB.localeCompare(wordA, "ja");
        case "reading-asc":
          return readingA.localeCompare(readingB, "ja") || wordA.localeCompare(wordB, "ja");
        case "reading-desc":
          return readingB.localeCompare(readingA, "ja") || wordB.localeCompare(wordA, "ja");
        case "part-asc":
          return partA.localeCompare(partB, "ja") || wordA.localeCompare(wordB, "ja");
        case "tag-count-desc":
          return tagsB - tagsA || wordA.localeCompare(wordB, "ja");
        case "word-asc":
        default:
          return wordA.localeCompare(wordB, "ja");
      }
    });

    return list;
  };

  // フォーム値を使って絞り込む
  terms.filterTerms = function filterTerms() {
    const els = terms.elements;
    const query = terms.normalizeText(els.searchInput.value);
    const part = els.partFilter.value;
    const tag = els.tagFilter.value;
    const sortKey = els.sortSelect.value;

    let results = [...terms.state.terms];

    if (part) {
      results = results.filter((term) => term.partOfSpeech === part);
    }

    if (tag) {
      results = results.filter((term) =>
        Array.isArray(term.tags) && term.tags.includes(tag)
      );
    }

    if (query) {
      results = results.filter((term) =>
        terms.normalizeText(terms.getSearchCorpus(term)).includes(query)
      );
    }

    return terms.sortTerms(results, sortKey);
  };

  // 画面の選択状態から state.filtered を更新
  terms.applyFilters = function applyFilters() {
    const state = terms.state;
    const els = terms.elements;

    state.pageSize = Number(els.pageSizeSelect.value || 50);
    state.viewMode = els.viewModeSelect.value || "cards";
    state.filtered = terms.filterTerms();
    state.currentPage = 1;

    els.summary.textContent =
      `登録 ${state.terms.length} 件 / 表示 ${state.filtered.length} 件`;

    terms.renderCurrentPage();
  };

  // フィルター初期化
  terms.clearFilters = function clearFilters() {
    const els = terms.elements;

    els.searchInput.value = "";
    els.partFilter.value = "";
    els.tagFilter.value = "";
    els.sortSelect.value = "word-asc";
    els.pageSizeSelect.value = "50";
    els.viewModeSelect.value = "cards";

    terms.applyFilters();
  };
})(window);
