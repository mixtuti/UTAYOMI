// 辞書ロード
(function (global) {
  const terms = global.WakaTerms;

  // 辞書JSONを読み込み、フィルター候補を初期化する
  terms.loadTerms = async function loadTerms() {
    const state = terms.state;
    const els = terms.elements;

    try {
      let data = [];

      if (global.WakaAPI?.loadTermDictionary) {
        data = await global.WakaAPI.loadTermDictionary();
      } else {
        const response = await fetch(terms.constants.DATA_URL);
        if (!response.ok) {
          throw new Error("辞書JSONの読み込みに失敗しました。");
        }
        data = await response.json();
      }

      state.terms = Array.isArray(data) ? data : [];

      terms.fillSelect(
        els.partFilter,
        terms.getPartOptions().sort((a, b) => a.localeCompare(b, "ja"))
      );
      terms.fillSelect(els.tagFilter, terms.getTagOptions());
      terms.renderQuickTags();
      terms.applyFilters();
    } catch (error) {
      console.error(error);
      els.results.className = "results-list empty-state";
      els.results.textContent = "辞書データを読み込めませんでした。";
      els.summary.textContent = "読み込み失敗";
    }
  };
})(window);
