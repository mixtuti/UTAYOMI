// 古典用語学習モードの土台
(function (global) {
  const study = (global.WakaStudy = global.WakaStudy || {});
  const app = global.WakaApp || {};

  study.constants = {
    MAX_EXAMPLES: 5,
  };

  // study 専用 state
  // 最後に表示した用例とハイライト語を保持する
  study.state = {
    dictionary: [],
    lastExamples: [],
    lastTerms: [],
  };

  // DOM 要素参照
  study.elements = {
    form: document.getElementById("studySearchForm"),
    input: document.getElementById("studySearchInput"),
    result: document.getElementById("studyResult"),
    examples: document.getElementById("studyExamples"),
    summary: document.getElementById("studySummary"),
    suggestions: document.getElementById("studySuggestions"),
    moreButton: document.getElementById("studyMoreExamples"),
    related: document.getElementById("studyRelated"),
  };

  study.hasRequiredElements = function hasRequiredElements() {
    const els = study.elements;
    return !!(els.form && els.input && els.result && els.examples);
  };

  // 初期化入口
  study.initialize = async function initializeStudyMode() {
    if (!study.hasRequiredElements()) return;
    study.bindEvents();
    await study.loadDictionary();
  };

  study.getPoems = function getPoems() {
    return Array.isArray(global.state?.poems) ? global.state.poems : [];
  };

  study.escapeHtml = app.escapeHtml || function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  study.normalizeText = app.normalizeText || function normalizeText(text) {
    return String(text || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  };
})(window);
