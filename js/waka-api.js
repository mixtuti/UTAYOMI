// 和歌データ読み込み用の共通API
// --------------------------------------------------
// このファイルの役割:
// - app.js から「データ取得処理」だけを切り離す
// - どの画面からでも同じ方法で和歌データを取得できるようにする
// - 将来、JSON直読みから /api/... のような本物のAPIへ移行しやすくする

(function (global) {
  // ==================================================
  // 1. 初期設定
  // ==================================================
  const DEFAULT_CONFIG = {
    // 通常表示で使う和歌データ本体
    poemFiles: [
      "./data/poems.json",
      "./data/poems1.json",
      "./data/poems2.json",
      "./data/poems3.json",
      "./data/poems4.json",
      "./data/poems5.json",
      "./data/poems6.json",
      "./data/poems7.json",
    ],

    // 追加表示ONのときだけ読み込む拡張和歌データ
    extraPoemFiles: [
      "./data/poemsex.json",
      "./data/poemsex1.json",
      "./data/poemsex2.json"
    ],

    // 季語辞書
    kigoFile: "./data/kigo.json",

    // 古典用語辞書
    termFile: "./data/classical_terms.json",
  };

  // ==================================================
  // 2. 汎用JSON読み込み関数
  // ==================================================
  async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`データの読み込みに失敗しました: ${url}`);
    }

    return response.json();
  }

  // ==================================================
  // 3. 「配列形式のJSON」専用読み込み関数
  // ==================================================
  async function fetchJsonArrayFile(url) {
    const data = await fetchJson(url);

    if (!Array.isArray(data)) {
      throw new Error(`配列JSONではありません: ${url}`);
    }

    return data;
  }

  // ==================================================
  // 4. 複数の配列JSONをまとめて読み込む関数
  // ==================================================
  async function fetchJsonArrayFiles(urls, options = {}) {
    const { ignoreErrors = true } = options;

    const chunks = await Promise.all(
      urls.map(async (url) => {
        try {
          return await fetchJsonArrayFile(url);
        } catch (error) {
          if (!ignoreErrors) {
            throw error;
          }

          console.warn(`[WakaAPI] 読み込みをスキップしました: ${url}`, error);
          return [];
        }
      })
    );

    return chunks.flat();
  }

  // ==================================================
  // 5. URLパラメータ・モード解決
  // ==================================================
  // stats.html?ura
  //   -> 通常 + extra
  //
  // stats.html?ura_only
  //   -> extra のみ
  //
  // 通常画面は従来どおり includeExtra だけでも使えるようにしつつ、
  // mode でも制御できるようにしている。
  function getUrlFlags() {
    const params = new URLSearchParams(global.location.search);

    return {
      includeExtraFromUrl: params.has("ura"),
      extraOnlyFromUrl: params.has("ura_only"),
    };
  }

  // options から最終的な読込モードを決める
  //
  // 優先順位:
  // 1. options.mode
  // 2. options.extraOnly
  // 3. options.includeExtra
  // 4. URL ?ura_only / ?ura
  // 5. 通常
  //
  // mode:
  // - "normal" : 通常のみ
  // - "all"    : 通常 + extra
  // - "extra"  : extraのみ
  function resolvePoemLoadMode(options = {}) {
    const flags = getUrlFlags();

    if (options.mode === "normal" || options.mode === "all" || options.mode === "extra") {
      return options.mode;
    }

    if (options.extraOnly) {
      return "extra";
    }

    if (options.includeExtra) {
      return "all";
    }

    if (flags.extraOnlyFromUrl) {
      return "extra";
    }

    if (flags.includeExtraFromUrl) {
      return "all";
    }

    return "normal";
  }

  // ==================================================
  // 6. 読み込む和歌ファイル一覧を組み立てる関数
  // ==================================================
  function buildPoemFileList(options = {}, config = DEFAULT_CONFIG) {
    const mode = resolvePoemLoadMode(options);

    switch (mode) {
      case "extra":
        return [...config.extraPoemFiles];
      case "all":
        return [...config.poemFiles, ...config.extraPoemFiles];
      case "normal":
      default:
        return [...config.poemFiles];
    }
  }

  // ==================================================
  // 7. 外部公開するAPI本体
  // ==================================================
  const WakaAPI = {
    config: { ...DEFAULT_CONFIG },

    setConfig(nextConfig = {}) {
      this.config = {
        ...this.config,
        ...nextConfig,
      };
    },

    // 現在のURLから見たフラグを返す
    getUrlFlags() {
      return getUrlFlags();
    },

    // 現在の options / URL から見た最終モードを返す
    resolvePoemLoadMode(options = {}) {
      return resolvePoemLoadMode(options);
    },

    // --------------------------------------------------
    // 和歌データ本体だけを取得する
    // --------------------------------------------------
    // mode:
    // - "normal" : 通常のみ
    // - "all"    : 通常 + extra
    // - "extra"  : extraのみ
    //
    // 後方互換:
    // - includeExtra: true -> "all"
    // - extraOnly: true    -> "extra"
    //
    // 戻り値:
    // - 和歌オブジェクトの配列
    async loadPoems(options = {}) {
      const poemFiles = buildPoemFileList(options, this.config);
      return fetchJsonArrayFiles(poemFiles, { ignoreErrors: true });
    },

    async loadKigoDictionary() {
      return fetchJson(this.config.kigoFile);
    },

    async loadTermDictionary() {
      return fetchJson(this.config.termFile);
    },

    async loadAll(options = {}) {
      const [poems, kigoDictionary, termDictionary] = await Promise.all([
        this.loadPoems(options),
        this.loadKigoDictionary(),
        this.loadTermDictionary(),
      ]);

      return {
        poems,
        kigoDictionary,
        termDictionary,
      };
    },

    async get(resourceName, options = {}) {
      switch (resourceName) {
        case "poems":
          return this.loadPoems(options);
        case "kigo":
          return this.loadKigoDictionary();
        case "terms":
          return this.loadTermDictionary();
        case "all":
          return this.loadAll(options);
        default:
          throw new Error(`未知のリソースです: ${resourceName}`);
      }
    },
  };

  global.WakaAPI = WakaAPI;
})(window);
