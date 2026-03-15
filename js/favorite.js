const FAVORITES_KEY = "utayomi_my_collection";

const Favorites = {
  // すべての歌を取得
  getAll() {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  },

  // 歌を保存（オリジナル/生成物 両対応）
  save(poem, type = "original") {
    const favorites = this.getAll();

    // オリジナルの場合は重複チェック（IDで判定）
    if (type === "original") {
      const exists = favorites.find(
        (f) => f.type === "original" && f.poem.id === poem.id,
      );
      if (exists) {
        alert("この歌は既に和歌集に綴じられています。");
        return;
      }
    }

    const entry = {
      favId: Date.now(), // 管理用ユニークID
      type: type, // 'original' または 'generated'
      addedDate: new Date().toISOString(),
      poem: poem, // 和歌データ本体
    };

    favorites.push(entry);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    alert("和歌集に綴じました。");
  },

  // 歌を削除
  remove(favId) {
    let favorites = this.getAll();
    favorites = favorites.filter((f) => f.favId !== favId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  },
};
