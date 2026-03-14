// 表示関連
(function (global) {
  const study = global.WakaStudy;
  const app = global.WakaApp || {};

  study.renderSuggestions = function renderSuggestions() {
    const els = study.elements;
    if (!els.suggestions) return;

    els.suggestions.innerHTML = "";

    const uniqueWords = [];
    const seen = new Set();

    study.state.dictionary.forEach((entry) => {
      const word = String(entry?.word || "").trim();
      if (!word || seen.has(word)) return;
      seen.add(word);
      uniqueWords.push(entry);
    });

    uniqueWords.slice(0, 20).forEach((entry) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-button";
      btn.textContent = entry.word;

      btn.addEventListener("click", () => {
        els.input.value = entry.word;
        study.search(entry.word);
      });

      els.suggestions.appendChild(btn);
    });
  };

  study.renderTagList = function renderTagList(tags) {
    if (!Array.isArray(tags) || !tags.length) return "";
    return `
      <div class="tag-list">
        ${tags.map((tag) => `<span class="tag-chip">${study.escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
  };

  study.renderRelated = function renderRelated(entries) {
    const els = study.elements;
    if (!els.related) return;

    const relatedWords = study.uniqueStrings(
      entries.flatMap((entry) =>
        Array.isArray(entry?.related) ? entry.related : []
      )
    );

    els.related.innerHTML = "";

    if (!relatedWords.length) {
      els.related.innerHTML = "<div class='empty-state'>関連語はありません。</div>";
      return;
    }

    const fragment = document.createDocumentFragment();

    relatedWords.forEach((item) => {
      const relatedWord =
        typeof item === "string"
          ? item
          : String(item?.word || "").trim();

      if (!relatedWord) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-button";

      if (typeof item === "object" && item !== null && item.type) {
        btn.textContent = `${relatedWord}（${item.type}）`;
      } else {
        btn.textContent = relatedWord;
      }

      btn.addEventListener("click", () => {
        if (els.input) els.input.value = relatedWord;
        study.search(relatedWord);
      });

      fragment.appendChild(btn);
    });

    els.related.appendChild(fragment);
  };

  study.renderEntryCard = function renderEntryCard(entry, index, total) {
    let html = "";
    html += `<div class="study-entry-card">`;

    if (total > 1) {
      html += `<div class="muted">候補 ${index + 1} / ${total}</div>`;
    }

    html += `<h4>${study.escapeHtml(entry.word || "")}</h4>`;

    if (entry.reading) {
      html += `<p class="muted">${study.escapeHtml(entry.reading)}</p>`;
    }

    const aliases = study.getEntryDisplayAliases(entry);
    if (aliases.length) {
      html += `<p><strong>異表記:</strong> ${aliases.map(study.escapeHtml).join("、")}</p>`;
    }

    if (entry.partOfSpeech) {
      html += `<p><strong>品詞:</strong> ${study.escapeHtml(entry.partOfSpeech)}</p>`;
    }

    if (Array.isArray(entry.tags) && entry.tags.length) {
      html += `<div><strong>タグ:</strong></div>`;
      html += study.renderTagList(entry.tags);
    }

    if (Array.isArray(entry.meaning) && entry.meaning.length) {
      html += "<ul>";
      entry.meaning.forEach((m) => {
        html += `<li>${study.escapeHtml(m)}</li>`;
      });
      html += "</ul>";
    } else if (entry.meaning) {
      html += `<p>${study.escapeHtml(entry.meaning)}</p>`;
    }

    if (entry.note) {
      html += `<p class="muted">${study.escapeHtml(entry.note)}</p>`;
    }

    if (entry.conjugation) {
      html += `<div><strong>活用:</strong></div>`;
      html += study.renderConjugationTable(entry.conjugation);
    }

    html += `</div>`;
    return html;
  };

  study.renderMeanings = function renderMeanings(entries) {
    const els = study.elements;

    if (!Array.isArray(entries) || !entries.length) {
      els.result.innerHTML = "";
      study.renderRelated([]);
      return;
    }

    let html = "";
    entries.forEach((entry, index) => {
      html += study.renderEntryCard(entry, index, entries.length);
    });

    els.result.innerHTML = html;
    study.renderRelated(entries);
  };

  study.renderNoMeaning = function renderNoMeaning(word) {
    const els = study.elements;
    els.result.innerHTML =
      `<div class="empty-state">「${study.escapeHtml(word)}」は辞書に登録されていません。</div>`;

    if (els.related) {
      els.related.innerHTML = "<div class='empty-state'>関連語はありません。</div>";
    }
  };

  study.updateMoreButton = function updateMoreButton(totalCount) {
    const els = study.elements;
    if (!els.moreButton) return;

    if (totalCount > 1) {
      els.moreButton.hidden = false;
      els.moreButton.disabled = false;
    } else {
      els.moreButton.hidden = true;
      els.moreButton.disabled = true;
    }
  };

  study.renderExamples = function renderExamples(list, highlightTerms = []) {
    const els = study.elements;

    els.examples.innerHTML = "";
    study.state.lastExamples = Array.isArray(list) ? [...list] : [];
    study.state.lastTerms = Array.isArray(highlightTerms) ? [...highlightTerms] : [];

    if (!list.length) {
      els.examples.innerHTML =
        "<div class='empty-state'>用例が見つかりませんでした。</div>";
      study.updateMoreButton(0);
      return;
    }

    const fragment = document.createDocumentFragment();
    const randomList = study.shuffle(list);

    randomList.slice(0, study.constants.MAX_EXAMPLES).forEach((poem) => {
      if (typeof app.createPoemCard === "function") {
        fragment.appendChild(
          app.createPoemCard(poem, {
            highlightTerms,
            useHighlight: true,
          })
        );
      } else if (typeof global.createPoemCard === "function") {
        fragment.appendChild(
          global.createPoemCard(poem, {
            highlightTerms,
            useHighlight: true,
          })
        );
      } else {
        const div = document.createElement("div");
        div.className = "poem-card";
        div.textContent = poem.text || "";
        fragment.appendChild(div);
      }
    });

    els.examples.appendChild(fragment);
    study.updateMoreButton(list.length);
  };

  study.renderConjugationTable = function renderConjugationTable(conjugation) {
    if (!conjugation || typeof conjugation !== "object") return "";

    if (!conjugation.rows) {
      const typeHtml = conjugation.type
        ? `<p><strong>活用型:</strong> ${study.escapeHtml(conjugation.type)}</p>`
        : "";

      const noteHtml = conjugation.note
        ? `<p><strong>接続:</strong> ${study.escapeHtml(conjugation.note)}</p>`
        : "";

      const forms =
        conjugation.forms && typeof conjugation.forms === "object"
          ? conjugation.forms
          : conjugation;

      const rowsHtml = Object.entries(forms)
        .filter(([key]) => key !== "type" && key !== "note")
        .map(([k, v]) =>
          `<tr><th>${study.escapeHtml(k)}</th><td>${study.escapeHtml(v)}</td></tr>`
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

    const headers = Array.isArray(conjugation.header)
      ? conjugation.header
      : ["接続", "未然形", "連用形", "終止形", "連体形", "已然形", "命令形", "活用型"];

    const rows = Array.isArray(conjugation.rows) ? conjugation.rows : [];
    if (!rows.length) return "";

    const thead = `
      <thead>
        <tr>
          ${headers.map((h) => `<th>${study.escapeHtml(h)}</th>`).join("")}
        </tr>
      </thead>
    `;

    const tbody = `
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${headers.map((h) => `<td>${study.escapeHtml(row[h] ?? "—")}</td>`).join("")}
          </tr>
        `).join("")}
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
