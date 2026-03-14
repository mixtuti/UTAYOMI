// 文字処理・共通ユーティリティ
(function (global) {
  const terms = global.WakaTerms;

  // 検索比較用の正規化
  terms.normalizeText = function normalizeText(text) {
    return String(text || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  };

  // HTMLエスケープ
  terms.escapeHtml = function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  // 重複を除いた文字列配列を返す
  terms.uniqueStrings = function uniqueStrings(list) {
    return [...new Set(list.map((v) => String(v || "").trim()).filter(Boolean))];
  };

  // 辞書1件を検索対象文字列へまとめる
  // フリーワード検索で本文以外もまとめて引けるようにする
  terms.getSearchCorpus = function getSearchCorpus(term) {
    return [
      term.word,
      term.reading,
      term.partOfSpeech,
      ...(Array.isArray(term.meaning) ? term.meaning : [term.meaning]),
      ...(Array.isArray(term.tags) ? term.tags : []),
      ...(Array.isArray(term.aliases) ? term.aliases : []),
      ...(Array.isArray(term.surface_forms) ? term.surface_forms : []),
      ...(Array.isArray(term.related)
        ? term.related.map((v) => (typeof v === "string" ? v : v?.word))
        : []),
      term.note,
      term.conjugation ? JSON.stringify(term.conjugation) : "",
    ].join(" ");
  };

  // 活用表HTMLを生成
  // 旧形式 / 新形式の両方に対応
  terms.renderConjugationTable = function renderConjugationTable(conjugation) {
    if (!conjugation || typeof conjugation !== "object") return "";

    // 旧形式
    if (!conjugation.rows) {
      const typeHtml = conjugation.type
        ? `<p><strong>活用型:</strong> ${terms.escapeHtml(conjugation.type)}</p>`
        : "";

      const noteHtml = conjugation.note
        ? `<p><strong>接続:</strong> ${terms.escapeHtml(conjugation.note)}</p>`
        : "";

      const forms =
        conjugation.forms && typeof conjugation.forms === "object"
          ? conjugation.forms
          : conjugation;

      const rowsHtml = Object.entries(forms)
        .filter(([key]) => !["type", "note", "forms"].includes(key))
        .map(
          ([k, v]) =>
            `<tr><th>${terms.escapeHtml(k)}</th><td>${terms.escapeHtml(v)}</td></tr>`
        )
        .join("");

      return `
        <div class="conjugation-block">
          ${typeHtml}
          ${noteHtml}
          <table class="conj-table">
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    // 新形式
    const headers = Array.isArray(conjugation.header)
      ? conjugation.header
      : ["接続", "未然形", "連用形", "終止形", "連体形", "已然形", "命令形", "活用型"];

    const rows = Array.isArray(conjugation.rows) ? conjugation.rows : [];
    if (!rows.length) return "";

    const thead = `
      <thead>
        <tr>
          ${headers.map((h) => `<th>${terms.escapeHtml(h)}</th>`).join("")}
        </tr>
      </thead>
    `;

    const tbody = `
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                ${headers
                  .map((h) => `<td>${terms.escapeHtml(row[h] ?? "—")}</td>`)
                  .join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    `;

    return `
      <div class="conjugation-block">
        <table class="conj-table conjugation-wide-table">
          ${thead}
          ${tbody}
        </table>
      </div>
    `;
  };
})(window);
