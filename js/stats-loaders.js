// データ読み込み
(function (global) {
  const statsPage = global.WakaStats;

  // 辞書データ読み込み
  // WakaAPI があれば共通ローダーを利用する
  statsPage.loadDictionary = async function loadDictionary() {
    if (global.WakaAPI?.loadTermDictionary) {
      const data = await global.WakaAPI.loadTermDictionary();
      return Array.isArray(data) ? data : [];
    }

    const res = await fetch(statsPage.DICTIONARY_URL);
    if (!res.ok) {
      throw new Error("辞書データの読み込みに失敗しました。");
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  // 和歌データ読み込み
  // waka-api.js を使い、?ura が付いているときは追加和歌データも含める
  statsPage.loadPoems = async function loadPoems() {
    if (!global.WakaAPI?.loadPoems) {
      throw new Error("WakaAPI.loadPoems が見つかりません。waka-api.js を先に読み込んでください。");
    }

    const poems = await global.WakaAPI.loadPoems({
      includeExtra: !!statsPage.flags?.includeExtraPoems
    });

    return Array.isArray(poems) ? poems : [];
  };
})(window);
