// 和歌生成・共作支援の土台
// ==================================================
// このファイルの役割
// --------------------------------------------------
// - 生成機能専用の state を保持する
// - 生成画面で使う DOM 要素をまとめる
// - 生成条件の基礎データ（連想語など）を定義する
// - 初期化処理の入口を用意する
//
// 依存:
// - window.state                : app 側の和歌データ
// - window.WakaApp / 既存関数   : 既存の検索側ユーティリティ
// ==================================================

(function (global) {
  const utayomi = (global.WakaUtayomi = global.WakaUtayomi || {});
  const app = global.WakaApp || {};

  // --------------------------------------------------
  // 生成機能専用 state
  // --------------------------------------------------
  // 検索画面の state とは別に、
  // 「今どのタブを見ているか」「直近で生成した歌は何か」を保持する。
  utayomi.state = {
    // 現在のタブ
    currentTab: "generator",

    // 自動生成で最後に作った一首
    currentGeneratedPoem: null,

    // 共作補完で最後に作った一首
    currentAssistPoem: null,

    // 「主要作者」とみなす最低首数
    minAuthorPoems: 10,
  };

  // 候補数がこの程度あると、比較的安定して組み立てやすい
  utayomi.constants = {
    GENERATION_MIN_CANDIDATES: 12,
    GENERATION_SOFT_MIN_CANDIDATES: 5,
  };

  // --------------------------------------------------
  // テーマ語 → 連想語
  // --------------------------------------------------
  // keywordMode === "theme" のときに、
  // 「その語を直接入れず、周辺イメージで歌を寄せる」ために使う。
  utayomi.keywordAssociations = {
    雪: ["冬", "白", "霜", "空", "朝", "庭", "降る", "寒"],
    春: ["霞", "花", "野", "梅", "桜", "若菜", "鶯"],
    秋: ["露", "風", "雁", "紅葉", "夜", "虫"],
    夢: ["夜", "寝", "袖", "恋", "明け", "暁"],
    波: ["海", "浜", "風", "寄る", "白波", "浦", "舟", "立ち返る", "渚"],
    袖: ["涙", "濡る", "乾く", "恋", "別れ", "秋風", "夜", "片敷く"],
    山: ["雲", "峰", "谷", "ほととぎす", "鹿", "紅葉", "霧", "越ゆ", "路"],
    雨: ["降る", "濡る", "時雨", "五月雨", "袖", "空", "雲", "音"],
    川: ["瀬", "流る", "淀む", "淵", "白波", "早き", "水"],
    夏: ["ほととぎす", "卯の花", "菖蒲", "五月雨", "蝉", "涼し", "茂る", "夏衣"],
    ほととぎす: ["忍び音", "待つ", "夜ふかく", "山", "鳴く", "雲ゐ", "暁"],
    冬: ["枯る", "氷", "千鳥", "網代", "炭竃", "冴ゆる", "時雨", "小夜更けて"],
    時雨: ["袖", "濡る", "紅葉", "音", "冬", "定まらぬ", "神奈備"],
    恋: ["逢ふ", "忍ぶ", "涙", "袖", "面影", "思ひ寝", "夕暮れ", "絶ゆ", "忘る"],
    涙: ["袖", "露", "濡る", "乾く", "川", "淵", "沈む", "玉"],
    海: ["波", "浜", "浦", "舟", "海人", "藻塩", "焼く", "寄る", "沖"],
    里: ["古里", "山里", "荒れたる", "住む", "訪ふ", "垣根", "柴の戸"],
    松: ["千代", "待つ", "磯", "風の音", "常盤", "翠"],
    紅葉: ["色", "染む", "散る", "錦", "竜田", "秋風", "鹿の音"],
    萩: ["露", "置く", "乱る", "野辺", "秋風", "しをる"],
    風: ["吹く", "音", "誘ふ", "秋", "松", "袖", "身にしむ"],
    霞: ["立ちいづる", "春", "山", "たなびく", "隔つ", "のどか"],
    露: ["置く", "消ゆ", "はかなし", "草", "袖", "涙", "命"],
    月: ["夜", "影", "光", "有明", "秋", "空", "雲", "山の端", "露", "小夜", "更ける"],
    月夜: ["さやか", "影", "照らす", "隈なき", "澄みわたる"],
    夜: ["更ける", "寝", "夢", "暁", "枕", "独り", "明かり"],
    空: ["雲", "星", "晴る", "天の河", "わたる", "たなびく"],
  };

  // --------------------------------------------------
  // DOM 要素参照
  // --------------------------------------------------
  utayomi.elements = {
    generatorTabButton: document.getElementById("generatorTabButton"),
    generatorV2TabButton: document.getElementById("generatorV2TabButton"),
    assistTabButton: document.getElementById("assistTabButton"),

    generatorModePanel: document.getElementById("generatorModePanel"),
    generatorV2ModePanel: document.getElementById("generatorV2ModePanel"),
    assistModePanel: document.getElementById("assistModePanel"),

    generatorForm: document.getElementById("generatorForm"),
    generatorModeSelect: document.getElementById("generatorModeSelect"),
    generatorSeasonFilter: document.getElementById("generatorSeasonFilter"),
    generatorCollectionFilter: document.getElementById("generatorCollectionFilter"),
    generatorAuthorFilter: document.getElementById("generatorAuthorFilter"),
    generatorKeywordInput: document.getElementById("generatorKeywordInput"),
    generatorKeywordModeSelect: document.getElementById("generatorKeywordModeSelect"),
    generatorStyleSelect: document.getElementById("generatorStyleSelect"),
    generatorShapeSelect: document.getElementById("generatorShapeSelect"),
    generatorUseSeasonOnlyToggle: document.getElementById("generatorUseSeasonOnlyToggle"),
    generatorUseAuthorThresholdToggle: document.getElementById("generatorUseAuthorThresholdToggle"),
    generatorPreferKigoToggle: document.getElementById("generatorPreferKigoToggle"),
    generateAutoPoemButton: document.getElementById("generateAutoPoemButton"),
    generateRandomPoemButton: document.getElementById("generateRandomPoemButton"),
    generatedPoemMeta: document.getElementById("generatedPoemMeta"),
    generatedPoemResult: document.getElementById("generatedPoemResult"),
    generatedPoemSource: document.getElementById("generatedPoemSource"),
    copyGeneratedPoemButton: document.getElementById("copyGeneratedPoemButton"),
    saveGeneratedPoemButton: document.getElementById("saveGeneratedPoemButton"),

    assistForm: document.getElementById("assistForm"),
    assistSeasonFilter: document.getElementById("assistSeasonFilter"),
    assistCollectionFilter: document.getElementById("assistCollectionFilter"),
    assistAuthorFilter: document.getElementById("assistAuthorFilter"),
    assistKeywordInput: document.getElementById("assistKeywordInput"),
    assistFillModeSelect: document.getElementById("assistFillModeSelect"),
    assistLine1: document.getElementById("assistLine1"),
    assistLine2: document.getElementById("assistLine2"),
    assistLine3: document.getElementById("assistLine3"),
    assistLine4: document.getElementById("assistLine4"),
    assistLine5: document.getElementById("assistLine5"),
    assistGenerateButton: document.getElementById("assistGenerateButton"),
    assistResetButton: document.getElementById("assistResetButton"),
    assistPresetFirstLineButton: document.getElementById("assistPresetFirstLineButton"),
    assistPresetLastLineButton: document.getElementById("assistPresetLastLineButton"),
    assistPresetRandomSlotsButton: document.getElementById("assistPresetRandomSlotsButton"),
    assistPoemMeta: document.getElementById("assistPoemMeta"),
    assistPoemResult: document.getElementById("assistPoemResult"),
    assistPoemSource: document.getElementById("assistPoemSource"),
    copyAssistPoemButton: document.getElementById("copyAssistPoemButton"),
    saveAssistPoemButton: document.getElementById("saveAssistPoemButton"),
    downloadGeneratedPoemImageButton: document.getElementById("downloadGeneratedPoemImageButton"),
    shareGeneratedPoemButton: document.getElementById("shareGeneratedPoemButton"),
    downloadAssistPoemImageButton: document.getElementById("downloadAssistPoemImageButton"),
    shareAssistPoemButton: document.getElementById("shareAssistPoemButton"),
  };

  // --------------------------------------------------
  // 初期化
  // --------------------------------------------------
  // app 側の state.poems が準備できてから、
  // フィルター構築・イベント登録・空状態表示を行う。
  utayomi.initialize = function initializeGenerationModes() {
    const state = global.state;

    if (!state || !Array.isArray(state.poems) || !state.poems.length) {
      setTimeout(utayomi.initialize, 200);
      return;
    }

    utayomi.populateGenerationFilters();
    utayomi.bindEvents();
    utayomi.setModeTab("generator");
    utayomi.renderGeneratorEmptyState();
    utayomi.renderAssistEmptyState();
  };

  utayomi.getAppState = function getAppState() {
    return global.state || app.state || { poems: [] };
  };
})(window);
