// 表示関連
(function (global) {
  const terms = global.WakaTerms;

  // badge を1個作る
  terms.createChip = function createChip(text) {
    const span = document.createElement("span");
    span.className = "badge";
    span.textContent = text;
    return span;
  };

  // 関連語ボタンを1個作る
  // 押すと検索語へ入れて再絞り込みする
  terms.createTagButton = function createTagButton(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-button";
    button.textContent = text;

    button.addEventListener("click", () => {
      terms.elements.searchInput.value = text;
      terms.state.currentPage = 1;
      terms.applyFilters();
    });

    return button;
  };

  // カード表示1件分を組み立てる
  terms.createTermCard = function createTermCard(term) {
    const fragment = terms.elements.template.content.cloneNode(true);

    fragment.querySelector(".term-word").textContent = term.word || "";
    fragment.querySelector(".term-reading").textContent = term.reading || "";

    const partWrap = fragment.querySelector(".term-part");
    if (term.partOfSpeech) {
      partWrap.appendChild(terms.createChip(term.partOfSpeech));
    }

    const tagsWrap = fragment.querySelector(".term-tags");
    const tags = Array.isArray(term.tags) ? term.tags : [];
    tags.forEach((tag) => tagsWrap.appendChild(terms.createChip(tag)));

    const meaningWrap = fragment.querySelector(".term-meaning");
    const meanings = Array.isArray(term.meaning) ? term.meaning : [term.meaning];
    meanings.filter(Boolean).forEach((meaning) => {
      const li = document.createElement("li");
      li.textContent = meaning;
      meaningWrap.appendChild(li);
    });

    const aliases = terms.uniqueStrings([
      ...(Array.isArray(term.aliases) ? term.aliases : []),
      ...(Array.isArray(term.surface_forms) ? term.surface_forms : []),
    ]).filter((value) => value !== term.word);

    const aliasesWrap = fragment.querySelector(".term-aliases-wrap");
    if (aliases.length) {
      fragment.querySelector(".term-aliases").textContent = aliases.join("、");
    } else if (aliasesWrap) {
      aliasesWrap.remove();
    }

    const relatedWrap = fragment.querySelector(".term-related-wrap");
    const related = Array.isArray(term.related) ? term.related : [];
    if (related.length) {
      const relatedBox = fragment.querySelector(".term-related");
      related.forEach((item) => {
        const word = typeof item === "string" ? item : String(item?.word || "").trim();
        if (!word) return;
        relatedBox.appendChild(terms.createTagButton(word));
      });
    } else if (relatedWrap) {
      relatedWrap.remove();
    }

    const conjugationWrap = fragment.querySelector(".term-conjugation-wrap");
    if (term.conjugation && conjugationWrap) {
      const target = fragment.querySelector(".term-conjugation");
      if (target) {
        target.innerHTML = terms.renderConjugationTable(term.conjugation);
      }
    } else if (conjugationWrap) {
      conjugationWrap.remove();
    }

    const noteWrap = fragment.querySelector(".term-note-wrap");
    if (term.note) {
      fragment.querySelector(".term-note").textContent = term.note;
    } else if (noteWrap) {
      noteWrap.remove();
    }

    return fragment;
  };

  // カード一覧表示
  terms.renderCards = function renderCards(items) {
    const wrapper = document.createElement("div");
    wrapper.className = "term-card-list";

    items.forEach((term) => {
      wrapper.appendChild(terms.createTermCard(term));
    });

    terms.elements.results.innerHTML = "";
    terms.elements.results.className = "results-list";
    terms.elements.results.appendChild(wrapper);
  };

  // 表形式表示
  terms.renderTable = function renderTable(items) {
    const table = document.createElement("table");
    table.className = "terms-table";

    table.innerHTML = `
      <thead>
        <tr>
          <th>語</th>
          <th>読み</th>
          <th>分類</th>
          <th>タグ</th>
          <th>意味</th>
          <th>活用</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    items.forEach((term) => {
      const meanings = Array.isArray(term.meaning)
        ? term.meaning
        : (term.meaning ? [term.meaning] : []);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${terms.escapeHtml(term.word || "")}</td>
        <td>${terms.escapeHtml(term.reading || "")}</td>
        <td>${terms.escapeHtml(term.partOfSpeech || "")}</td>
        <td>${terms.escapeHtml((term.tags || []).join("、"))}</td>
        <td>${terms.escapeHtml(meanings.join(" / "))}</td>
        <td>${term.conjugation ? "あり" : "—"}</td>
      `;
      tbody.appendChild(tr);
    });

    terms.elements.results.innerHTML = "";
    terms.elements.results.className = "results-list";
    terms.elements.results.appendChild(table);
  };

  // ページャー描画
  terms.renderPagination = function renderPagination(totalCount) {
    const state = terms.state;
    const els = terms.elements;

    els.pagination.innerHTML = "";

    if (state.pageSize >= 9999) return;

    const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize));
    if (totalPages <= 1) return;

    const makeButton = (label, page, disabled = false, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = active ? "button" : "button secondary";
      button.textContent = label;
      button.disabled = disabled;

      button.addEventListener("click", () => {
        state.currentPage = page;
        terms.renderCurrentPage();
      });

      return button;
    };

    els.pagination.appendChild(
      makeButton("前へ", Math.max(1, state.currentPage - 1), state.currentPage === 1)
    );

    for (let page = 1; page <= totalPages; page++) {
      if (
        page === 1 ||
        page === totalPages ||
        Math.abs(page - state.currentPage) <= 1
      ) {
        els.pagination.appendChild(
          makeButton(String(page), page, false, page === state.currentPage)
        );
      } else if (Math.abs(page - state.currentPage) === 2) {
        const span = document.createElement("span");
        span.className = "pagination-ellipsis";
        span.textContent = "…";
        els.pagination.appendChild(span);
      }
    }

    els.pagination.appendChild(
      makeButton(
        "次へ",
        Math.min(totalPages, state.currentPage + 1),
        state.currentPage === totalPages
      )
    );
  };

  // 現在ページ分だけ描画
  terms.renderCurrentPage = function renderCurrentPage() {
    const state = terms.state;
    const els = terms.elements;

    const start = (state.currentPage - 1) * state.pageSize;
    const end = state.pageSize >= 9999 ? state.filtered.length : start + state.pageSize;
    const pageItems = state.filtered.slice(start, end);

    if (!pageItems.length) {
      els.results.className = "results-list empty-state";
      els.results.textContent = "該当する単語がありません。";
      els.pagination.innerHTML = "";
      return;
    }

    if (state.viewMode === "table") {
      terms.renderTable(pageItems);
    } else {
      terms.renderCards(pageItems);
    }

    terms.renderPagination(state.filtered.length);
  };
})(window);
