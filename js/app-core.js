// アプリの土台
// ==================================================
// このファイルは「全ファイル共通で使う土台」をまとめます。
// - アプリ共通名前空間 (window.WakaApp)
// - state
// - DOM参照
// - 定数
// - 起動処理

(function (global) {
  const app = (global.WakaApp = global.WakaApp || {});

  // --------------------------------------------------
  // アプリ全体の状態
  // --------------------------------------------------
  // 検索結果や辞書データなど、画面全体で共有する値をここに集約します。
  app.state = {
    // 和歌データ本体
    poems: [],

    // 季語辞書
    kigoDictionary: [],

    // 古典用語辞書
    termDictionary: [],

    // 現在画面に出している検索結果
    currentResults: [],

    // 現在のページ番号
    currentPage: 1,

    // 1ページの表示件数
    resultsPerPage: 20,

    // ハイライト対象語
    currentHighlightTerms: [],
  };

  // 他ファイル・他スクリプトからも参照しやすいように公開
  global.state = app.state;

  // --------------------------------------------------
  // URLパラメータ
  // --------------------------------------------------
  // ?ura が付いているときだけ拡張和歌データを読み込みます。
  const params = new URLSearchParams(global.location.search);
  app.flags = {
    showPoemEx: params.has("ura"),
  };

  // --------------------------------------------------
  // 後続語検索で飛ばしたい語
  // --------------------------------------------------
  app.constants = {
    SKIP_NEXT_WORDS: new Set([
      "の", "に", "を", "は", "が", "と", "も", "へ", "や", "か",
      "ね", "よ", "ぞ", "なむ", "やは", "こそ",
      "て", "で", "し", "ば", "ど", "ども",
      "たり", "けり", "ぬ", "つ", "き", "けむ", "らむ", "なり"
    ]),

    // token 分割に使うパターン
    TOKEN_SPLIT_PATTERNS: [
      "べらなり",
      "たまひて",
      "たまへば",
      "たまひ",
      "しらしめし",
      "しらしめす",
      "おもほしめせ",
      "おもほしけめ",
      "かむながら",
      "あらたへの",
      "たかてらす",
      "ももしきの",
      "うつせみの",
      "あをによし",
      "そらみつ",
      "やすみしし",
      "たまたすき",
      "かすみたつ",
      "しろたへの",
      "あきづしま",
      "あまざかる",
      "わたつみの",
      "ひむがしの",
      "ささなみの",
      "いはばしる",
      "しきたへの",
      "あしひきの",
      "ぬばたまの",
      "みよしのの",
      "やまとなる",
      "あをまつ",
      "あまの",
      "やまの",
      "かぜ",
      "つき",
      "よ",
      "ゆふ",
      "はる",
      "あき",
      "ふゆ",
      "なつ",
      "かぎろひ",
      "もみち",
      "あられ",
      "しも",
      "かすみ",
      "はりはら",
      "まつばら",
      "たび",
      "いも",
      "やま",
      "かは",
      "うら",
      "の",
      "に",
      "を",
      "は",
      "が",
      "と",
      "も",
      "へ",
      "や",
      "か",
      "ぞ",
      "なむ",
      "こそ",
      "て",
      "で",
      "し",
      "ぬ",
      "つ",
      "ば",
      "ど",
      "ね",
      "けり",
      "ける",
      "なり",
      "らむ",
      "けむ"
    ].sort((a, b) => b.length - a.length),
  };

  // --------------------------------------------------
  // DOM要素参照
  // --------------------------------------------------
  app.elements = {
    randomPoem: document.getElementById("randomPoem"),
    shufflePoemButton: document.getElementById("shufflePoemButton"),

    searchForm: document.getElementById("searchForm"),
    searchInput: document.getElementById("searchInput"),
    collectionFilter: document.getElementById("collectionFilter"),
    themeFilter: document.getElementById("themeFilter"),
    seasonFilter: document.getElementById("seasonFilter"),
    authorFilter: document.getElementById("authorFilter"),
    kigoFilter: document.getElementById("kigoFilter"),
    kanaSearchToggle: document.getElementById("kanaSearchToggle"),
    clearSearchButton: document.getElementById("clearSearchButton"),

    searchResults: document.getElementById("searchResults"),
    searchSummary: document.getElementById("searchSummary"),
    activeFilters: document.getElementById("activeFilters"),
    pagination: document.getElementById("pagination"),

    ngramForm: document.getElementById("ngramForm"),
    ngramInput: document.getElementById("ngramInput"),
    ngramResults: document.getElementById("ngramResults"),

    highlightToggle: document.getElementById("highlightToggle"),
    verticalModeToggle: document.getElementById("verticalModeToggle"),

    poemCardTemplate: document.getElementById("poemCardTemplate"),
    tagButtons: document.querySelectorAll(".tag-button"),

    poemDetailModal: document.getElementById("poemDetailModal"),
    closeDetail: document.getElementById("closeDetail"),
    detailTitle: document.getElementById("detailTitle"),
    detailMetaLine: document.getElementById("detailMetaLine"),
    detailPoemText: document.getElementById("detailPoemText"),
    detailKana: document.getElementById("detailKana"),

    detailTagSection: document.getElementById("detailTagSection"),
    detailTags: document.getElementById("detailTags"),

    detailWordsSection: document.getElementById("detailWordsSection"),
    detailWords: document.getElementById("detailWords"),

    detailMetaInfoSection: document.getElementById("detailMetaInfoSection"),
    detailMetaInfo: document.getElementById("detailMetaInfo"),
  };

  // --------------------------------------------------
  // 起動前データ準備
  // --------------------------------------------------
  app.initializeAppData = function initializeAppData(dataset) {
    const state = app.state;

    state.poems = Array.isArray(dataset?.poems) ? dataset.poems : [];
    state.kigoDictionary = Array.isArray(dataset?.kigoDictionary)
      ? dataset.kigoDictionary
      : [];
    state.termDictionary = Array.isArray(dataset?.termDictionary)
      ? dataset.termDictionary
      : [];

    global.state = state;

    app.initializePoemCaches();
    app.initializeTermCaches();
  };

  // --------------------------------------------------
  // UI初期化
  // --------------------------------------------------
  app.initializeUI = function initializeUI() {
    app.populateCollectionFilter();
    app.populateThemeFilterFromData();
    app.populateSeasonFilter();
    app.populateAuthorFilter();
    app.populateKigoFilter();

    app.renderRandomPoem();
    app.applyVerticalMode();
    app.renderInitialResults();
  };

  // --------------------------------------------------
  // ロードエラー表示
  // --------------------------------------------------
  app.renderLoadError = function renderLoadError(error) {
    const elements = app.elements;
    const message = app.escapeHtml(error?.message || "不明なエラー");

    elements.randomPoem.innerHTML =
      `<div class="empty-state">読み込みエラー: ${message}</div>`;

    elements.searchResults.innerHTML =
      '<div class="empty-state">データを読み込めませんでした。</div>';

    elements.ngramResults.innerHTML =
      '<div class="empty-state">データを読み込めませんでした。</div>';

    if (elements.pagination) {
      elements.pagination.innerHTML = "";
    }
  };

  // --------------------------------------------------
  // アプリ起動
  // --------------------------------------------------
  app.bootstrapApp = async function bootstrapApp() {
    try {
      const dataset = await global.WakaAPI.loadAll({
        includeExtra: app.flags.showPoemEx,
      });

      app.initializeAppData(dataset);
      app.initializeUI();
      app.bindEvents();
    } catch (error) {
      app.renderLoadError(error);
    }
  };
})(window);
