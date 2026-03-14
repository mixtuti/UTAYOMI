// 文字処理・共通ユーティリティ
(function (global) {
  const study = global.WakaStudy;

  study.toHiragana = function toHiragana(text) {
    return String(text || "").replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  };

  study.toKatakana = function toKatakana(text) {
    return String(text || "").replace(/[\u3041-\u3096]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60)
    );
  };

  study.uniqueStrings = function uniqueStrings(list) {
    const set = new Set();
    list.forEach((value) => {
      const str = String(value || "").trim();
      if (str) set.add(str);
    });
    return [...set];
  };

  study.shuffle = function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
})(window);
