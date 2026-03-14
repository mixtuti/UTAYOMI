// 文字処理・共通ユーティリティ
(function (global) {
  const app = global.WakaApp;

  // 検索語を空白・読点・カンマ区切りで複数語へ分割
  app.parseMultipleTerms = function parseMultipleTerms(query) {
    return String(query)
      .split(/[\s\u3000,、]+/)
      .map((term) => term.trim())
      .filter(Boolean);
  };

  // 後続語検索用のキー正規化
  app.normalizePhraseKey = function normalizePhraseKey(text) {
    return String(text)
      .normalize("NFKC")
      .replace(/[\s\u3000]+/g, "");
  };

  // 通常検索用の共通正規化
  app.normalizeText = function normalizeText(text) {
    return String(text)
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  };

  // カタカナ → ひらがな
  app.katakanaToHiragana = function katakanaToHiragana(text) {
    return String(text).replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  };

  // かな欄ハイライト用語を組み立てる
  app.buildKanaHighlightTerms = function buildKanaHighlightTerms(terms) {
    const result = new Set();

    terms.forEach((term) => {
      const raw = String(term || "").trim();
      if (!raw) return;

      result.add(raw);

      const hira = app.katakanaToHiragana(raw);
      if (hira) result.add(hira);
    });

    return [...result];
  };

  // HTMLエスケープ
  app.escapeHtml = function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  // 正規表現エスケープ
  app.escapeRegExp = function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // キー重複除去
  app.uniqueBy = function uniqueBy(array, getKey) {
    const seen = new Set();
    return array.filter((item) => {
      const key = getKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // 複数語ハイライト
  app.highlightMultipleTerms = function highlightMultipleTerms(text, terms) {
    let html = app.escapeHtml(text);

    const sortedTerms = [...new Set(terms.map(String).filter(Boolean))].sort(
      (a, b) => b.length - a.length
    );

    sortedTerms.forEach((term) => {
      const escapedTerm = app.escapeHtml(term);
      const pattern = new RegExp(`(${app.escapeRegExp(escapedTerm)})`, "gi");
      html = html.replace(pattern, "<mark>$1</mark>");
    });

    return html;
  };
})(window);
