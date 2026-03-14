// イベント登録
(function (global) {
  const terms = global.WakaTerms;

  // 画面上のフォーム操作と処理を接続する
  terms.bindEvents = function bindEvents() {
    const els = terms.elements;

    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      terms.applyFilters();
    });

    els.clearButton.addEventListener("click", terms.clearFilters);
    els.sortSelect.addEventListener("change", terms.applyFilters);
    els.pageSizeSelect.addEventListener("change", terms.applyFilters);
    els.viewModeSelect.addEventListener("change", terms.applyFilters);
  };
})(window);
