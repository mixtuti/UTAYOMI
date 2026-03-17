// 統計ページの土台
(function (global) {
  const statsPage = (global.WakaStats = global.WakaStats || {});

  // 統計ページ設定
  statsPage.CONFIG = {
    ANALYSIS_CHUNK: 1,
    ANALYSIS_DELAY: 5,
    RANK_LIMIT: 10,
    COOC_LIMIT: 10,
    INDEPENDENT_WORD_LIMIT: 50,
    BAR_SCALE: 3,
    RANK_SNAPSHOT_INTERVAL: 20,
    CURRENT_POEM_MAX_LENGTH: 60,
    CURRENT_POEM_KANA_MAX_LENGTH: 60,
    LONG_POEM_MIN_TOKENS: 6,
  };

  statsPage.DICTIONARY_URL = "./data/classical_terms.json";

  // URLパラメータ
  // ?ura が付いているときは waka-api.js 側の追加和歌データも統計対象に含める
  const params = new URLSearchParams(global.location.search);

  statsPage.flags = {
    includeExtraPoems: params.has("ura"),
  };

  // 自立語ランキングから外したい語
  statsPage.NON_INDEPENDENT_TOKENS = new Set([
    "に", "を", "が", "は", "へ", "と", "ど", "も",
    "の", "ね", "や", "か", "ぞ", "なむ", "こそ",
    "より", "から", "まで", "して", "つつ",
    "て", "で", "し", "き", "けり", "ける", "けむ",
    "らむ", "らし", "べし", "む", "ぬ", "つ", "たり", "り",
    "この", "その", "あの", "どの",
    "これ", "それ", "あれ", "どれ",
    "なり", "なる", "たる", "だに", "さへ", "のみ", "ばかり"
  ]);

  // state
  statsPage.state = {
    dictionary: [],
    poems: [],
    processedCount: 0,
    isFinished: false,

    previousRankItems: {
      makura: [],
      plants: [],
      animals: [],
      places: [],
      endingBlocks: [],
      independentWords: [],
      moon: [],
      followers: [],
      longPoemLengths: [],
    },

    hasRankSnapshot: {
      makura: false,
      plants: false,
      animals: false,
      places: false,
      endingBlocks: false,
      independentWords: false,
      moon: false,
      followers: false,
      longPoemLengths: false,
    }
  };

  // 集計先
  statsPage.stats = {
    makura: new Map(),
    plants: new Map(),
    animals: new Map(),
    places: new Map(),
    endingBlocks: new Map(),
    independentWords: new Map(),
    moon: new Map(),
    makuraFollowers: new Map(),
    tagDistribution: new Map(),
    conjugationCounts: new Map(),
    longPoemLengths: new Map(),
  };

  // DOM 要素参照
  statsPage.elements = {
    summary: document.getElementById("statsSummary"),
    overview: document.getElementById("statsOverviewCards"),
    tagDistribution: document.getElementById("statsTagDistribution"),
    makurakotoba: document.getElementById("statsMakurakotoba"),
    plants: document.getElementById("statsPlants"),
    animals: document.getElementById("statsAnimals"),
    places: document.getElementById("statsPlaces"),
    endingBlocks: document.getElementById("statsEndingBlocks"),
    independentWords: document.getElementById("statsIndependentWords"),
    moonCooccurrence: document.getElementById("statsMoonCooccurrence"),
    makuraFollowers: document.getElementById("statsMakuraFollowers"),
    progressText: document.getElementById("statsProgressText"),
    progressBar: document.getElementById("statsProgressBar"),
    currentPoem: document.getElementById("statsCurrentPoem"),
    currentPoemMeta: document.getElementById("statsCurrentPoemMeta"),
    longPoemLengths: document.getElementById("statsLongPoemLengths"),
  };

  // 初期化入口
  statsPage.init = async function init() {
    try {
      const [dictionary, poems] = await Promise.all([
        statsPage.loadDictionary(),
        statsPage.loadPoems()
      ]);

      statsPage.state.dictionary = dictionary;
      statsPage.state.poems = poems;

      statsPage.buildDictionaryStats(dictionary);
      statsPage.renderOverview();
      statsPage.renderTagDistribution();

      const prepared = {
        makura: statsPage.prepareEntries(dictionary, "枕詞"),
        plants: statsPage.prepareEntries(dictionary, "植物"),
        animals: statsPage.prepareEntries(dictionary, "動物"),
        places: statsPage.prepareEntries(dictionary, "地名"),
      };

      statsPage.startLiveAnalysis(prepared);
    } catch (error) {
      console.error(error);
      if (statsPage.elements.summary) {
        statsPage.elements.summary.textContent = "統計データ読み込み失敗";
      }
    }
  };
})(window);
