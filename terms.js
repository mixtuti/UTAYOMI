(() => {
    const DATA_URL = "./data/classical_terms.json";

    const state = {
        terms: [],
        filtered: [],
        currentPage: 1,
        pageSize: 50,
        viewMode: "cards",
    };

    const elements = {
        form: document.getElementById("termsFilterForm"),
        searchInput: document.getElementById("termsSearchInput"),
        partFilter: document.getElementById("termsPartOfSpeechFilter"),
        tagFilter: document.getElementById("termsTagFilter"),
        sortSelect: document.getElementById("termsSortSelect"),
        pageSizeSelect: document.getElementById("termsPageSizeSelect"),
        viewModeSelect: document.getElementById("termsViewModeSelect"),
        clearButton: document.getElementById("termsClearButton"),
        results: document.getElementById("termsResults"),
        summary: document.getElementById("termsSummary"),
        pagination: document.getElementById("termsPagination"),
        tagQuickLinks: document.getElementById("termsTagQuickLinks"),
        template: document.getElementById("termCardTemplate"),
    };

    function normalizeText(text) {
        return String(text || "")
            .normalize("NFKC")
            .replace(/\s+/g, "")
            .toLowerCase();
    }

    function escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function renderConjugationTable(conjugation) {
        if (!conjugation || typeof conjugation !== "object") return "";

        // 旧形式
        if (!conjugation.rows) {
            const typeHtml = conjugation.type
                ? `<p><strong>活用型:</strong> ${escapeHtml(conjugation.type)}</p>`
                : "";

            const noteHtml = conjugation.note
                ? `<p><strong>接続:</strong> ${escapeHtml(conjugation.note)}</p>`
                : "";

            const forms =
                conjugation.forms && typeof conjugation.forms === "object"
                    ? conjugation.forms
                    : conjugation;

            const rowsHtml = Object.entries(forms)
                .filter(([key]) => !["type", "note", "forms"].includes(key))
                .map(
                    ([k, v]) =>
                        `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`
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
                    ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
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
                                    .map((h) => `<td>${escapeHtml(row[h] ?? "—")}</td>`)
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
    }

    function uniqueStrings(list) {
        return [...new Set(list.map((v) => String(v || "").trim()).filter(Boolean))];
    }

    function getSearchCorpus(term) {
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
    }

    function getPartOptions() {
        return uniqueStrings(state.terms.map((term) => term.partOfSpeech));
    }

    function getTagOptions() {
        return uniqueStrings(
            state.terms.flatMap((term) => Array.isArray(term.tags) ? term.tags : [])
        ).sort((a, b) => a.localeCompare(b, "ja"));
    }

    function fillSelect(select, values) {
        const first = select.querySelector("option");
        select.innerHTML = "";
        if (first) select.appendChild(first);

        values.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function renderQuickTags() {
        if (!elements.tagQuickLinks) return;
        elements.tagQuickLinks.innerHTML = "";

        getTagOptions().slice(0, 40).forEach((tag) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "tag-button";
            button.textContent = tag;
            button.addEventListener("click", () => {
                elements.tagFilter.value = tag;
                state.currentPage = 1;
                applyFilters();
            });
            elements.tagQuickLinks.appendChild(button);
        });
    }

    function sortTerms(terms, sortKey) {
        const list = [...terms];

        list.sort((a, b) => {
            const wordA = String(a.word || "");
            const wordB = String(b.word || "");
            const readingA = String(a.reading || "");
            const readingB = String(b.reading || "");
            const partA = String(a.partOfSpeech || "");
            const partB = String(b.partOfSpeech || "");
            const tagsA = Array.isArray(a.tags) ? a.tags.length : 0;
            const tagsB = Array.isArray(b.tags) ? b.tags.length : 0;

            switch (sortKey) {
                case "word-desc":
                    return wordB.localeCompare(wordA, "ja");
                case "reading-asc":
                    return readingA.localeCompare(readingB, "ja") || wordA.localeCompare(wordB, "ja");
                case "reading-desc":
                    return readingB.localeCompare(readingA, "ja") || wordB.localeCompare(wordA, "ja");
                case "part-asc":
                    return partA.localeCompare(partB, "ja") || wordA.localeCompare(wordB, "ja");
                case "tag-count-desc":
                    return tagsB - tagsA || wordA.localeCompare(wordB, "ja");
                case "word-asc":
                default:
                    return wordA.localeCompare(wordB, "ja");
            }
        });

        return list;
    }

    function filterTerms() {
        const query = normalizeText(elements.searchInput.value);
        const part = elements.partFilter.value;
        const tag = elements.tagFilter.value;
        const sortKey = elements.sortSelect.value;

        let results = [...state.terms];

        if (part) {
            results = results.filter((term) => term.partOfSpeech === part);
        }

        if (tag) {
            results = results.filter((term) =>
                Array.isArray(term.tags) && term.tags.includes(tag)
            );
        }

        if (query) {
            results = results.filter((term) =>
                normalizeText(getSearchCorpus(term)).includes(query)
            );
        }

        return sortTerms(results, sortKey);
    }

    function createChip(text) {
        const span = document.createElement("span");
        span.className = "badge";
        span.textContent = text;
        return span;
    }

    function createTagButton(text) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tag-button";
        button.textContent = text;
        button.addEventListener("click", () => {
            elements.searchInput.value = text;
            state.currentPage = 1;
            applyFilters();
        });
        return button;
    }

    function createTermCard(term) {
        const fragment = elements.template.content.cloneNode(true);

        fragment.querySelector(".term-word").textContent = term.word || "";
        fragment.querySelector(".term-reading").textContent = term.reading || "";

        const partWrap = fragment.querySelector(".term-part");
        if (term.partOfSpeech) {
            partWrap.appendChild(createChip(term.partOfSpeech));
        }

        const tagsWrap = fragment.querySelector(".term-tags");
        const tags = Array.isArray(term.tags) ? term.tags : [];
        tags.forEach((tag) => tagsWrap.appendChild(createChip(tag)));

        const meaningWrap = fragment.querySelector(".term-meaning");
        const meanings = Array.isArray(term.meaning) ? term.meaning : [term.meaning];
        meanings.filter(Boolean).forEach((meaning) => {
            const li = document.createElement("li");
            li.textContent = meaning;
            meaningWrap.appendChild(li);
        });

        const aliases = uniqueStrings([
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
                relatedBox.appendChild(createTagButton(word));
            });
        } else if (relatedWrap) {
            relatedWrap.remove();
        }

        const conjugationWrap = fragment.querySelector(".term-conjugation-wrap");
        if (term.conjugation && conjugationWrap) {
            const target = fragment.querySelector(".term-conjugation");
            if (target) {
                target.innerHTML = renderConjugationTable(term.conjugation);
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
    }

    function renderCards(items) {
        const wrapper = document.createElement("div");
        wrapper.className = "term-card-list";

        items.forEach((term) => {
            wrapper.appendChild(createTermCard(term));
        });

        elements.results.innerHTML = "";
        elements.results.className = "results-list";
        elements.results.appendChild(wrapper);
    }

    function renderTable(items) {
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
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(term.word || "")}</td>
                <td>${escapeHtml(term.reading || "")}</td>
                <td>${escapeHtml(term.partOfSpeech || "")}</td>
                <td>${escapeHtml((term.tags || []).join("、"))}</td>
                <td>${escapeHtml((term.meaning || []).join(" / "))}</td>
                <td>${term.conjugation ? "あり" : "—"}</td>
            `;
            tbody.appendChild(tr);
        });

        elements.results.innerHTML = "";
        elements.results.className = "results-list";
        elements.results.appendChild(table);
    }

    function renderPagination(totalCount) {
        elements.pagination.innerHTML = "";

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
                renderCurrentPage();
            });
            return button;
        };

        elements.pagination.appendChild(
            makeButton("前へ", Math.max(1, state.currentPage - 1), state.currentPage === 1)
        );

        for (let page = 1; page <= totalPages; page++) {
            if (
                page === 1 ||
                page === totalPages ||
                Math.abs(page - state.currentPage) <= 1
            ) {
                elements.pagination.appendChild(
                    makeButton(String(page), page, false, page === state.currentPage)
                );
            } else if (Math.abs(page - state.currentPage) === 2) {
                const span = document.createElement("span");
                span.className = "pagination-ellipsis";
                span.textContent = "…";
                elements.pagination.appendChild(span);
            }
        }

        elements.pagination.appendChild(
            makeButton(
                "次へ",
                Math.min(totalPages, state.currentPage + 1),
                state.currentPage === totalPages
            )
        );
    }

    function renderCurrentPage() {
        const start = (state.currentPage - 1) * state.pageSize;
        const end = state.pageSize >= 9999 ? state.filtered.length : start + state.pageSize;
        const pageItems = state.filtered.slice(start, end);

        if (!pageItems.length) {
            elements.results.className = "results-list empty-state";
            elements.results.textContent = "該当する単語がありません。";
            elements.pagination.innerHTML = "";
            return;
        }

        if (state.viewMode === "table") {
            renderTable(pageItems);
        } else {
            renderCards(pageItems);
        }

        renderPagination(state.filtered.length);
    }

    function applyFilters() {
        state.pageSize = Number(elements.pageSizeSelect.value || 50);
        state.viewMode = elements.viewModeSelect.value || "cards";
        state.filtered = filterTerms();
        state.currentPage = 1;

        elements.summary.textContent =
            `登録 ${state.terms.length} 件 / 表示 ${state.filtered.length} 件`;

        renderCurrentPage();
    }

    function clearFilters() {
        elements.searchInput.value = "";
        elements.partFilter.value = "";
        elements.tagFilter.value = "";
        elements.sortSelect.value = "word-asc";
        elements.pageSizeSelect.value = "50";
        elements.viewModeSelect.value = "cards";
        applyFilters();
    }

    async function loadTerms() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error("辞書JSONの読み込みに失敗しました。");

            const data = await response.json();
            state.terms = Array.isArray(data) ? data : [];

            fillSelect(
                elements.partFilter,
                getPartOptions().sort((a, b) => a.localeCompare(b, "ja"))
            );
            fillSelect(elements.tagFilter, getTagOptions());
            renderQuickTags();
            applyFilters();
        } catch (error) {
            console.error(error);
            elements.results.className = "results-list empty-state";
            elements.results.textContent = "辞書データを読み込めませんでした。";
            elements.summary.textContent = "読み込み失敗";
        }
    }

    elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        applyFilters();
    });

    elements.clearButton.addEventListener("click", clearFilters);
    elements.sortSelect.addEventListener("change", applyFilters);
    elements.pageSizeSelect.addEventListener("change", applyFilters);
    elements.viewModeSelect.addEventListener("change", applyFilters);

    loadTerms();
})();