// 古典用語一覧ページの土台
// ==================================================
// このファイルの役割
// --------------------------------------------------
// - terms 機能専用の state を持つ
// - 一覧画面で使う DOM 要素をまとめる
// - 初期化の入口を用意する
//
// 依存:
// - window.WakaAPI があれば辞書取得に利用可能
// - 単独動作時は terms-dictionary.js 側で直接 JSON を読む
// ==================================================

(function (global) {
  const terms = (global.WakaTerms = global.WakaTerms || {});

  // 辞書JSONの既定URL
  terms.constants = {
    DATA_URL: "./data/classical_terms.json",
  };

  // --------------------------------------------------
  // terms 専用 state
  // --------------------------------------------------
  // 一覧ページなので、
  // 「元データ」「絞り込み結果」「ページ状態」「表示モード」を保持する。
  terms.state = {
    terms: [],          // 元の辞書データ
    filtered: [],       // 現在の絞り込み結果
    currentPage: 1,     // 現在ページ
    pageSize: 50,       // 1ページ表示件数
    viewMode: "cards",  // cards / table
  };

  // --------------------------------------------------
  // DOM 要素参照
  // --------------------------------------------------
  terms.elements = {
    form: document.getElementById("termsFilterForm"),
    searchInput: document.getElementById("termsSearchInput"),
    partFilter: document.getElementById("termsPartOfSpeechFilter"),
    tagFilter: document.getElementById("termsTagFilter"),
    sortSelect: document.getElementById("termsSortSelect"),
    pageSizeSelect: document.getElementById("termsPageSizeSelect"),
    viewModeSelect: document.getElementById("termsViewModeSelect"),
    clearButton: document.getElementById("termsClearButton"),
    results: document.getElementById("termsResults"),
    summary: document.getElementById("termsSummary"),
    pagination: document.getElementById("termsPagination"),
    tagQuickLinks: document.getElementById("termsTagQuickLinks"),
    template: document.getElementById("termCardTemplate"),
  };

  // 必須要素がない場合は起動しない
  terms.hasRequiredElements = function hasRequiredElements() {
    const els = terms.elements;
    return !!(
      els.form &&
      els.searchInput &&
      els.partFilter &&
      els.tagFilter &&
      els.sortSelect &&
      els.pageSizeSelect &&
      els.viewModeSelect &&
      els.clearButton &&
      els.results &&
      els.summary &&
      els.pagination
    );
  };

  // 初期化入口
  terms.initialize = async function initializeTermsPage() {
    if (!terms.hasRequiredElements()) return;
    terms.bindEvents();
    await terms.loadTerms();
  };
})(window);
