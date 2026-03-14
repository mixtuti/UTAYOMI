// 和歌生成用ユーティリティ
(function (global) {
  const utayomi = global.WakaUtayomi;
  const app = global.WakaApp || {};

  // 値の件数を Map 化する共通関数
  utayomi.buildCountMap = function buildCountMap(items) {
    const map = new Map();
    items.forEach((value) => {
      if (!value) return;
      map.set(value, (map.get(value) || 0) + 1);
    });
    return map;
  };

  // <select> に option を安全に追加する
  utayomi.appendOptionsSafe = function appendOptionsSafe(selectElement, values, countMap = null) {
    if (!selectElement) return;

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;

      const count = countMap?.get(value) ?? null;
      option.textContent = count !== null ? `${value} (${count})` : value;
      selectElement.appendChild(option);
    });
  };

  // 「主要作者」一覧を返す
  // 生成モードで、データ数の少ない作者を除外したいときに使う
  utayomi.getMajorAuthors = function getMajorAuthors(minPoems = 10) {
    const counts = new Map();
    const state = utayomi.getAppState();

    state.poems.forEach((poem) => {
      const author = String(poem.author || "").trim();
      if (!author) return;
      counts.set(author, (counts.get(author) || 0) + 1);
    });

    return [...counts.entries()]
      .filter(([, count]) => count >= minPoems)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0], "ja");
      })
      .map(([author]) => author);
  };

  // 和歌データから5句を取り出す
  // poem.tokens があれば優先し、なければ kana の空白区切りを利用する
  utayomi.getPoemLinesFromData = function getPoemLinesFromData(poem) {
    if (Array.isArray(poem.tokens) && poem.tokens.length >= 5) {
      return poem.tokens
        .slice(0, 5)
        .map((line) => String(line || "").trim())
        .filter(Boolean);
    }

    if (typeof poem.kana === "string" && poem.kana.trim().includes(" ")) {
      const kanaLines = poem.kana.trim().split(/\s+/).filter(Boolean);
      if (kanaLines.length >= 5) {
        return kanaLines.slice(0, 5);
      }
    }

    return [];
  };

  // 軽量正規化
  // 生成ロジック内の比較用なので、既存の normalizeText より軽く使う
  utayomi.normalizeLite = function normalizeLite(text) {
    return String(text || "")
      .normalize("NFKC")
      .replace(/[\s　]+/g, "")
      .toLowerCase();
  };

  // 文字数っぽいものをざっくり数える
  // 厳密な音数ではなく、句形評価の目安として使う
  utayomi.countKanaLike = function countKanaLike(text) {
    return String(text || "")
      .replace(/[\s　]/g, "")
      .replace(/[、。・]/g, "").length;
  };

  utayomi.getLineHead = function getLineHead(text, size = 2) {
    return String(text || "").trim().slice(0, size);
  };

  utayomi.getLineTail = function getLineTail(text, size = 2) {
    const value = String(text || "").trim();
    return value.slice(Math.max(0, value.length - size));
  };

  utayomi.splitChars = function splitChars(text) {
    return [...String(text || "").replace(/[\s　]/g, "")];
  };

  // 配列をシャッフルして返す
  utayomi.shuffleArray = function shuffleArray(array) {
    const cloned = [...array];
    for (let i = cloned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
  };

  utayomi.safeJsonParse = function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  // poem の重複除去
  utayomi.uniquePoems = function uniquePoems(poems) {
    const seen = new Set();
    return poems.filter((poem) => {
      const key = poem?.id || `${poem?.collection || ""}:${poem?.ref_no || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  utayomi.uniquePoemList = function uniquePoemList(list) {
    return utayomi.uniquePoems(list);
  };

  utayomi.escapeHtml = app.escapeHtml || function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };
})(window);
