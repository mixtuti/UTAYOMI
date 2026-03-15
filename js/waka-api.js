// 和歌データ読み込み用の共通API
// --------------------------------------------------
// このファイルの役割:
// - app.js から「データ取得処理」だけを切り離す
// - どの画面からでも同じ方法で和歌データを取得できるようにする
// - 将来、JSON直読みから /api/... のような本物のAPIへ移行しやすくする

(function (global) {
  // ==================================================
  // 1. 初期設定
  // --------------------------------------------------
  // 読み込むJSONファイルの場所をまとめて管理する設定オブジェクトです。
  // 後から setConfig() を使って差し替えられるように、
  // ここで「標準値」を定義しています。
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
  // --------------------------------------------------
  // 指定URLからJSONを1つ読み込みます。
  // すべてのロード処理の土台になる基本関数です。
  //
  // 処理内容:
  // 1) fetchでURLへアクセス
  // 2) HTTPエラーなら例外を投げる
  // 3) JSONとして返す
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
  // --------------------------------------------------
  // 和歌データのように、JSONの中身が配列であることを前提に読む関数です。
  //
  // 例:
  // [
  //   { ...和歌1件分... },
  //   { ...和歌1件分... }
  // ]
  //
  // 配列でなかった場合は、データ形式が想定と違うのでエラーにします。
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
  // --------------------------------------------------
  // poems.json / poems1.json / poems2.json ... のように、
  // 複数ファイルに分割された和歌データを一括で読み込みます。
  //
  // options.ignoreErrors が true の場合:
  // - ある1ファイルが壊れていても全体停止しない
  // - 読めなかったファイルだけスキップする
  //
  // 最後に chunks.flat() で
  // [[...], [...], [...]] → [...]
  // にまとめて、1本の配列として返します。
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
  // 5. 読み込む和歌ファイル一覧を組み立てる関数
  // --------------------------------------------------
  // includeExtra が true のときだけ poemsex.json を追加します。
  //
  // 役割:
  // - 「どの和歌ファイルを読むか」を決める
  // - loadPoems() 本体をシンプルにする
  // ==================================================
  function buildPoemFileList(options = {}, config = DEFAULT_CONFIG) {
    const includeExtra = !!options.includeExtra;

    return [
      ...config.poemFiles,
      ...(includeExtra ? config.extraPoemFiles : []),
    ];
  }

  // ==================================================
  // 6. 外部公開するAPI本体
  // --------------------------------------------------
  // このオブジェクトが「和歌データ取得の窓口」です。
  // app.js や他のスクリプトは、基本的にこの WakaAPI を通して
  // データを読み込むことになります。
  // ==================================================
  const WakaAPI = {
    // 現在使っている設定を保持
    // 初期値として DEFAULT_CONFIG をコピーして持っておく
    config: { ...DEFAULT_CONFIG },

    // --------------------------------------------------
    // 設定差し替え用
    // --------------------------------------------------
    // 外部からファイルパスを上書きしたいときに使います。
    //
    // 例:
    // WakaAPI.setConfig({
    //   kigoFile: "./mock/kigo-test.json"
    // });
    //
    // 主な用途:
    // - テスト用データへの差し替え
    // - 開発環境 / 本番環境でパスを変える
    // - 将来APIのURLに切り替える準備
    // --------------------------------------------------
    setConfig(nextConfig = {}) {
      this.config = {
        ...this.config,
        ...nextConfig,
      };
    },

    // --------------------------------------------------
    // 和歌データ本体だけを取得する
    // --------------------------------------------------
    // includeExtra が true なら poemsex.json も含めて読み込みます。
    //
    // 戻り値:
    // - 和歌オブジェクトの配列
    // --------------------------------------------------
    async loadPoems(options = {}) {
      const poemFiles = buildPoemFileList(options, this.config);
      return fetchJsonArrayFiles(poemFiles, { ignoreErrors: true });
    },

    // --------------------------------------------------
    // 季語辞書だけを取得する
    // --------------------------------------------------
    // 戻り値:
    // - kigo.json の中身
    // --------------------------------------------------
    async loadKigoDictionary() {
      return fetchJson(this.config.kigoFile);
    },

    // --------------------------------------------------
    // 古典用語辞書だけを取得する
    // --------------------------------------------------
    // 戻り値:
    // - classical_terms.json の中身
    // --------------------------------------------------
    async loadTermDictionary() {
      return fetchJson(this.config.termFile);
    },

    // --------------------------------------------------
    // 画面初期化に必要なデータをまとめて取得する
    // --------------------------------------------------
    // app.js 側で最もよく使う想定の関数です。
    //
    // 並列で以下をまとめて読み込みます:
    // - 和歌データ
    // - 季語辞書
    // - 古典用語辞書
    //
    // 戻り値:
    // {
    //   poems,
    //   kigoDictionary,
    //   termDictionary
    // }
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 簡易API風の共通取得窓口
    // --------------------------------------------------
    // "poems" / "kigo" / "terms" / "all" のように
    // 名前で欲しいデータを指定して取得できます。
    //
    // 例:
    // await WakaAPI.get("poems")
    // await WakaAPI.get("all", { includeExtra: true })
    //
    // メリット:
    // - 外部から使うときに統一感がある
    // - 将来APIエンドポイントっぽい形に寄せやすい
    // --------------------------------------------------
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

  // ==================================================
  // 7. グローバル公開
  // --------------------------------------------------
  // window.WakaAPI として外部から使えるようにします。
  //
  // これで他のJSから:
  //   window.WakaAPI.loadAll()
  //   window.WakaAPI.get("poems")
  // のように呼び出せます。
  // ==================================================
  global.WakaAPI = WakaAPI;
})(window);

