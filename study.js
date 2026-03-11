(function () {
    const MAX_EXAMPLES = 5;

    const elements = {
        form: document.getElementById("studySearchForm"),
        input: document.getElementById("studySearchInput"),
        result: document.getElementById("studyResult"),
        examples: document.getElementById("studyExamples"),
        summary: document.getElementById("studySummary"),
        suggestions: document.getElementById("studySuggestions"),
        moreButton: document.getElementById("studyMoreExamples"),
        related: document.getElementById("studyRelated"),
    };

    if (
        !elements.form ||
        !elements.input ||
        !elements.result ||
        !elements.examples
    ) {
        return;
    }

    let dictionary = [];
    let lastExamples = [];
    let lastTerms = [];

    async function loadDictionary() {
        try {
            const res = await fetch("./data/classical_terms.json");
            if (!res.ok) {
                throw new Error("辞書JSONの読み込みに失敗しました");
            }
            dictionary = await res.json();
            renderSuggestions();
        } catch (err) {
            console.error("辞書JSONの読み込み失敗:", err);
            elements.result.innerHTML =
                `<div class="empty-state">辞書データを読み込めませんでした。</div>`;
            if (elements.related) {
                elements.related.innerHTML =
                    `<div class="empty-state">関連語を読み込めませんでした。</div>`;
            }
        }
    }

    function normalize(text) {
        if (typeof normalizeText === "function") {
            return normalizeText(text);
        }
        return String(text || "")
            .normalize("NFKC")
            .replace(/\s+/g, "")
            .toLowerCase();
    }

    function escape(text) {
        if (typeof escapeHtml === "function") {
            return escapeHtml(text);
        }
        return String(text || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function toHiragana(text) {
        return String(text || "").replace(/[\u30A1-\u30F6]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0x60)
        );
    }

    function toKatakana(text) {
        return String(text || "").replace(/[\u3041-\u3096]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) + 0x60)
        );
    }

    function uniqueStrings(list) {
        const set = new Set();
        list.forEach((value) => {
            const str = String(value || "").trim();
            if (str) set.add(str);
        });
        return [...set];
    }

    function getEntryDisplayAliases(entry) {
        return uniqueStrings([
            ...(Array.isArray(entry.aliases) ? entry.aliases : []),
            ...(Array.isArray(entry.variants) ? entry.variants : []),
            ...(Array.isArray(entry.surface_forms) ? entry.surface_forms : []),
        ]).filter((item) => item !== entry.word);
    }

    function getEntrySearchKeys(entry) {
        const keys = new Set();

        [
            entry.word,
            entry.reading,
            ...(Array.isArray(entry.variants) ? entry.variants : []),
            ...(Array.isArray(entry.aliases) ? entry.aliases : []),
            ...(Array.isArray(entry.surface_forms) ? entry.surface_forms : []),
        ]
            .filter(Boolean)
            .forEach((v) => {
                const value = String(v).trim();
                if (!value) return;

                keys.add(value);
                keys.add(toHiragana(value));
                keys.add(toKatakana(value));
            });

        return [...keys].filter(Boolean);
    }

    function getEntriesSearchKeys(entries) {
        return uniqueStrings(
            entries.flatMap((entry) => getEntrySearchKeys(entry))
        );
    }

    function renderSuggestions() {
        if (!elements.suggestions) return;

        elements.suggestions.innerHTML = "";

        const uniqueWords = [];
        const seen = new Set();

        dictionary.forEach((entry) => {
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
                elements.input.value = entry.word;
                search(entry.word);
            });

            elements.suggestions.appendChild(btn);
        });
    }

    function renderTagList(tags) {
        if (!Array.isArray(tags) || !tags.length) return "";

        return `
            <div class="tag-list">
                ${tags
                .map((tag) => `<span class="tag-chip">${escape(tag)}</span>`)
                .join("")}
            </div>
        `;
    }

    function renderRelated(entries) {
        if (!elements.related) return;

        const relatedWords = uniqueStrings(
            entries.flatMap((entry) =>
                Array.isArray(entry?.related) ? entry.related : []
            )
        );

        elements.related.innerHTML = "";

        if (!relatedWords.length) {
            elements.related.innerHTML =
                "<div class='empty-state'>関連語はありません。</div>";
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
                if (elements.input) {
                    elements.input.value = relatedWord;
                }
                search(relatedWord);
            });

            fragment.appendChild(btn);
        });

        elements.related.appendChild(fragment);
    }

    function renderEntryCard(entry, index, total) {
        let html = "";

        html += `<div class="study-entry-card">`;

        if (total > 1) {
            html += `<div class="muted">候補 ${index + 1} / ${total}</div>`;
        }

        html += `<h4>${escape(entry.word || "")}</h4>`;

        if (entry.reading) {
            html += `<p class="muted">${escape(entry.reading)}</p>`;
        }

        const aliases = getEntryDisplayAliases(entry);
        if (aliases.length) {
            html += `<p><strong>異表記:</strong> ${aliases.map(escape).join("、")}</p>`;
        }

        if (entry.partOfSpeech) {
            html += `<p><strong>品詞:</strong> ${escape(entry.partOfSpeech)}</p>`;
        }

        if (Array.isArray(entry.tags) && entry.tags.length) {
            html += `<div><strong>タグ:</strong></div>`;
            html += renderTagList(entry.tags);
        }

        if (Array.isArray(entry.meaning) && entry.meaning.length) {
            html += "<ul>";
            entry.meaning.forEach((m) => {
                html += `<li>${escape(m)}</li>`;
            });
            html += "</ul>";
        } else if (entry.meaning) {
            html += `<p>${escape(entry.meaning)}</p>`;
        }

        if (entry.note) {
            html += `<p class="muted">${escape(entry.note)}</p>`;
        }

        if (entry.conjugation) {
            html += `<div><strong>活用:</strong></div>`;
            html += renderConjugationTable(entry.conjugation);
        }

        html += `</div>`;
        return html;
    }

    function renderMeanings(entries) {
        if (!Array.isArray(entries) || !entries.length) {
            elements.result.innerHTML = "";
            renderRelated([]);
            return;
        }

        let html = "";

        entries.forEach((entry, index) => {
            html += renderEntryCard(entry, index, entries.length);
        });

        elements.result.innerHTML = html;
        renderRelated(entries);
    }

    function renderNoMeaning(word) {
        elements.result.innerHTML =
            `<div class="empty-state">「${escape(word)}」は辞書に登録されていません。</div>`;

        if (elements.related) {
            elements.related.innerHTML =
                "<div class='empty-state'>関連語はありません。</div>";
        }
    }

    function findDictionaryEntries(word) {
        const normalized = normalize(word);
        const hira = normalize(toHiragana(word));
        const kata = normalize(toKatakana(word));

        return dictionary.filter((entry) =>
            getEntrySearchKeys(entry).some((key) => {
                const normalizedKey = normalize(key);
                return (
                    normalizedKey === normalized ||
                    normalizedKey === hira ||
                    normalizedKey === kata
                );
            })
        );
    }

    function poemMatchesAnyTerm(poem, terms) {
        if (!Array.isArray(terms) || !terms.length) return false;

        if (typeof poemMatchesTerm === "function") {
            return terms.some((term) => poemMatchesTerm(poem, term, true));
        }

        const joined = [
            poem.text || "",
            poem.kana || "",
            ...(Array.isArray(poem.tokens) ? poem.tokens : []),
            ...(Array.isArray(poem.search_tokens) ? poem.search_tokens : []),
            ...(Array.isArray(poem.keywords) ? poem.keywords : []),
        ]
            .join("")
            .toString();

        const normalizedJoined = normalize(joined);
        const hiraJoined = normalize(toHiragana(joined));
        const kataJoined = normalize(toKatakana(joined));

        return terms.some((term) => {
            const normalizedTerm = normalize(term);
            const hiraTerm = normalize(toHiragana(term));
            const kataTerm = normalize(toKatakana(term));

            return (
                normalizedJoined.includes(normalizedTerm) ||
                normalizedJoined.includes(hiraTerm) ||
                normalizedJoined.includes(kataTerm) ||
                hiraJoined.includes(normalizedTerm) ||
                hiraJoined.includes(hiraTerm) ||
                kataJoined.includes(normalizedTerm) ||
                kataJoined.includes(kataTerm)
            );
        });
    }

    function findExamples(word, entries = []) {
        if (!Array.isArray(state?.poems) || !state.poems.length) {
            return [];
        }

        const terms =
            Array.isArray(entries) && entries.length
                ? getEntriesSearchKeys(entries)
                : [word];

        return state.poems.filter((poem) => poemMatchesAnyTerm(poem, terms));
    }

    function findPoemsByIds(entries) {
        if (!Array.isArray(state?.poems) || !state.poems.length) {
            return [];
        }

        const ids = entries.flatMap(entry =>
            Array.isArray(entry.poem_ids) ? entry.poem_ids : []
        );

        if (!ids.length) return [];

        return state.poems.filter(poem => ids.includes(poem.id));
    }

    function shuffle(array) {
        const arr = [...array];

        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        return arr;
    }

    function updateMoreButton(totalCount) {
        if (!elements.moreButton) return;

        if (totalCount > 1) {
            elements.moreButton.hidden = false;
            elements.moreButton.disabled = false;
        } else {
            elements.moreButton.hidden = true;
            elements.moreButton.disabled = true;
        }
    }

    function renderExamples(list, highlightTerms = []) {
        elements.examples.innerHTML = "";

        lastExamples = Array.isArray(list) ? [...list] : [];
        lastTerms = Array.isArray(highlightTerms) ? [...highlightTerms] : [];

        if (!list.length) {
            elements.examples.innerHTML =
                "<div class='empty-state'>用例が見つかりませんでした。</div>";
            updateMoreButton(0);
            return;
        }

        const fragment = document.createDocumentFragment();
        const randomList = shuffle(list);

        randomList.slice(0, MAX_EXAMPLES).forEach((poem) => {
            if (typeof createPoemCard === "function") {
                fragment.appendChild(
                    createPoemCard(poem, {
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

        elements.examples.appendChild(fragment);
        updateMoreButton(list.length);
    }

    function search(rawWord) {
        const word = String(rawWord || "").trim();
        if (!word) return;

        if (!Array.isArray(state?.poems) || !state.poems.length) {
            elements.result.innerHTML =
                "<div class='empty-state'>和歌データの読み込み待ちです。少し待ってからもう一度お試しください。</div>";
            elements.examples.innerHTML = "";
            updateMoreButton(0);

            if (elements.related) {
                elements.related.innerHTML =
                    "<div class='empty-state'>和歌データ未読み込み</div>";
            }

            if (elements.summary) {
                elements.summary.textContent = "和歌データ未読み込み";
            }
            return;
        }

        const entries = findDictionaryEntries(word);

        if (entries.length) {
            renderMeanings(entries);
        } else {
            renderNoMeaning(word);
        }

        const searchTerms = entries.length
            ? getEntriesSearchKeys(entries)
            : [word];

        const examples = findExamples(word, entries);

        const fixedPoems = findPoemsByIds(entries);

        renderExamples([...fixedPoems, ...examples], searchTerms);

        if (elements.summary) {
            if (entries.length && entries.length > 1) {
                if (examples.length) {
                    elements.summary.textContent =
                        `「${word}」に一致する辞書項目 ${entries.length} 件・用例 ${examples.length} 件`;
                } else {
                    elements.summary.textContent =
                        `「${word}」に一致する辞書項目 ${entries.length} 件`;
                }
            } else if (examples.length) {
                elements.summary.textContent =
                    `「${word}」の用例 ${examples.length} 件`;
            } else {
                elements.summary.textContent =
                    `「${word}」の用例は見つかりませんでした`;
            }
        }
    }

    function renderConjugationTable(conjugation) {
        if (!conjugation || typeof conjugation !== "object") return "";

        if (!conjugation.rows) {
            const typeHtml = conjugation.type
                ? `<p><strong>活用型:</strong> ${escape(conjugation.type)}</p>`
                : "";

            const noteHtml = conjugation.note
                ? `<p><strong>接続:</strong> ${escape(conjugation.note)}</p>`
                : "";

            const forms =
                conjugation.forms && typeof conjugation.forms === "object"
                    ? conjugation.forms
                    : conjugation;

            const rowsHtml = Object.entries(forms)
                .filter(([key]) => key !== "type" && key !== "note")
                .map(
                    ([k, v]) =>
                        `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`
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
                ${headers.map((h) => `<th>${escape(h)}</th>`).join("")}
            </tr>
        </thead>
    `;

        const tbody = `
        <tbody>
            ${rows
                .map((row) => {
                    return `
                        <tr>
                            ${headers
                            .map((h) => `<td>${escape(row[h] ?? "—")}</td>`)
                            .join("")}
                        </tr>
                    `;
                })
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

    elements.form.addEventListener("submit", (e) => {
        e.preventDefault();
        search(elements.input.value);
    });

    if (elements.moreButton) {
        elements.moreButton.hidden = true;
        elements.moreButton.disabled = true;

        elements.moreButton.addEventListener("click", () => {
            if (!lastExamples.length) return;
            renderExamples(lastExamples, lastTerms);
        });
    }

    loadDictionary();
})();