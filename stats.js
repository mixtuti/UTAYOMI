(() => {

    // ===============================
    // 統計ページ設定
    // ===============================
    const CONFIG = {
        // 1回の処理で解析する和歌数
        ANALYSIS_CHUNK: 1,

        // 次の処理までの待ち時間(ms)
        ANALYSIS_DELAY: 5,

        // 各ランキングの表示件数
        RANK_LIMIT: 30,

        // 月の共起語の表示件数
        COOC_LIMIT: 10,

        // 自立語ランキング表示件数
        INDEPENDENT_WORD_LIMIT: 50,

        // バーの伸び倍率
        BAR_SCALE: 3,

        // 矢印比較用スナップショットの更新間隔
        RANK_SNAPSHOT_INTERVAL: 50,

        // 解析中和歌の表示上限
        CURRENT_POEM_MAX_LENGTH: 60,
        CURRENT_POEM_KANA_MAX_LENGTH: 60,
    };

    const DICTIONARY_URL = "./data/classical_terms.json";

    const poemFiles = [
        "./data/poems.json",
        "./data/poems1.json",
        "./data/poems2.json",
        "./data/poems3.json",
        "./data/poems4.json",
        "./data/poems5.json",
        "./data/poems6.json"
    ];

    const NON_INDEPENDENT_TOKENS = new Set([
        "に", "を", "が", "は", "へ", "と", "ど", "も",
        "の", "ね", "や", "か", "ぞ", "なむ", "こそ",
        "より", "から", "まで", "して", "つつ",
        "て", "で", "し", "き", "けり", "ける", "けむ",
        "らむ", "らし", "べし", "む", "ぬ", "つ", "たり", "り",
        "この", "その", "あの", "どの",
        "これ", "それ", "あれ", "どれ",
        "なり", "なる", "たる", "だに", "さへ", "のみ", "ばかり"
    ]);

    const state = {
        dictionary: [],
        poems: [],
        processedCount: 0,
        isFinished: false,

        // 矢印比較用の前回スナップショット
        previousRankItems: {
            makura: [],
            plants: [],
            animals: [],
            places: [],
            endingBlocks: [],
            independentWords: [],
            moon: [],
            followers: [],
        },

        // 初回スナップショット取得済みか
        hasRankSnapshot: {
            makura: false,
            plants: false,
            animals: false,
            places: false,
            endingBlocks: false,
            independentWords: false,
            moon: false,
            followers: false,
        }
    };

    const stats = {
        makura: new Map(),
        plants: new Map(),
        animals: new Map(),
        places: new Map(),
        endingBlocks: new Map(),
        independentWords: new Map(),
        moon: new Map(),
        makuraFollowers: new Map(),
        tagDistribution: new Map(),
        conjugationCounts: new Map(),
    };

    const elements = {
        summary: document.getElementById("statsSummary"),
        overview: document.getElementById("statsOverviewCards"),
        tagDistribution: document.getElementById("statsTagDistribution"),
        makurakotoba: document.getElementById("statsMakurakotoba"),
        plants: document.getElementById("statsPlants"),
        animals: document.getElementById("statsAnimals"),
        places: document.getElementById("statsPlaces"),
        endingBlocks: document.getElementById("statsEndingBlocks"),
        independentWords: document.getElementById("statsIndependentWords"),
        moonCooccurrence: document.getElementById("statsMoonCooccurrence"),
        makuraFollowers: document.getElementById("statsMakuraFollowers"),
        progressText: document.getElementById("statsProgressText"),
        progressBar: document.getElementById("statsProgressBar"),
        currentPoem: document.getElementById("statsCurrentPoem"),
        currentPoemMeta: document.getElementById("statsCurrentPoemMeta"),
    };

    function normalize(text) {
        return String(text || "")
            .normalize("NFKC")
            .replace(/\s+/g, "")
            .toLowerCase();
    }

    function escapeHtml(v) {
        return String(v || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function truncateText(text, maxLength) {
        const value = String(text || "").trim();
        if (!value) return "";
        if (value.length <= maxLength) return value;
        return value.slice(0, maxLength) + "…";
    }

    function increment(map, key, val = 1) {
        map.set(key, (map.get(key) || 0) + val);
    }

    function incrementNested(map, key, sub, val = 1) {
        if (!map.has(key)) map.set(key, new Map());
        const inner = map.get(key);
        inner.set(sub, (inner.get(sub) || 0) + val);
    }

    function unique(arr) {
        return [...new Set(arr.filter(Boolean))];
    }

    function sortMapEntries(map) {
        return [...map.entries()]
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return String(a.word || "").localeCompare(String(b.word || ""), "ja");
            });
    }

    function findRank(items, word) {
        const index = items.findIndex((item) => item.word === word);
        return index >= 0 ? index + 1 : null;
    }

    function cloneRankItems(items) {
        return items.map((item) => ({
            word: item.word,
            count: item.count
        }));
    }

    function shouldRefreshRankSnapshot() {
        return (
            state.isFinished ||
            (
                state.processedCount > 0 &&
                state.processedCount % CONFIG.RANK_SNAPSHOT_INTERVAL === 0
            )
        );
    }

    function getRankDiffByAdjacentSwap(previousItems, currentItems, word, currentRank, hasSnapshot) {
        if (!hasSnapshot || !previousItems.length) {
            return { text: "", className: "is-stay" };
        }

        const prevRank = findRank(previousItems, word);

        if (prevRank == null) {
            return { text: "NEW", className: "is-new" };
        }

        if (prevRank === currentRank) {
            return { text: "→→", className: "is-stay" };
        }

        if (prevRank === currentRank + 1) {
            const prevOccupantAtCurrentRank = previousItems[currentRank - 1]?.word;
            if (prevOccupantAtCurrentRank) {
                const nowRankOfPrevOccupant = findRank(currentItems, prevOccupantAtCurrentRank);
                if (nowRankOfPrevOccupant === prevRank) {
                    return { text: "↑1", className: "is-up" };
                }
            }
        }

        if (prevRank === currentRank - 1) {
            const prevOccupantAtCurrentRank = previousItems[currentRank - 1]?.word;
            if (prevOccupantAtCurrentRank) {
                const nowRankOfPrevOccupant = findRank(currentItems, prevOccupantAtCurrentRank);
                if (nowRankOfPrevOccupant === prevRank) {
                    return { text: "↓1", className: "is-down" };
                }
            }
        }

        return { text: "→→", className: "is-stay" };
    }

    function getLastKanaBlock(kana) {
        const parts = String(kana || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        return parts.length ? parts[parts.length - 1] : "";
    }

    function isIndependentToken(token) {
        const word = String(token || "").trim();
        if (!word) return false;
        if (word.length <= 1) return false;
        if (NON_INDEPENDENT_TOKENS.has(word)) return false;
        return true;
    }

    async function loadDictionary() {
        const res = await fetch(DICTIONARY_URL);
        if (!res.ok) {
            throw new Error("辞書データの読み込みに失敗しました。");
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    async function loadPoems() {
        const results = await Promise.all(
            poemFiles.map(async (file) => {
                try {
                    const res = await fetch(file);
                    if (!res.ok) return [];
                    const data = await res.json();
                    return Array.isArray(data) ? data : [];
                } catch {
                    return [];
                }
            })
        );
        return results.flat();
    }

    function prepareEntries(dictionary, tag) {
        return dictionary
            .filter((entry) => Array.isArray(entry.tags) && entry.tags.includes(tag))
            .map((entry) => {
                const forms = unique([
                    entry.word,
                    entry.reading,
                    ...(entry.aliases || []),
                    ...(entry.surface_forms || [])
                ].map(normalize));

                return {
                    word: entry.word,
                    forms,
                };
            });
    }

    function buildDictionaryStats(dictionary) {
        const tagMap = new Map();
        const conjugationMap = new Map();

        dictionary.forEach((entry) => {
            const tags = Array.isArray(entry.tags) ? entry.tags : [];
            tags.forEach((tag) => increment(tagMap, tag));

            if (entry.conjugation) {
                const part = entry.partOfSpeech || "未分類";
                increment(conjugationMap, part);
            }
        });

        stats.tagDistribution = tagMap;
        stats.conjugationCounts = conjugationMap;
    }

    function createOverviewCard(label, value, note = "") {
        const card = document.createElement("article");
        card.className = "stats-mini-card";
        card.innerHTML = `
            <div class="stats-mini-label">${escapeHtml(label)}</div>
            <div class="stats-mini-value">${escapeHtml(value)}</div>
            ${note ? `<div class="stats-mini-note">${escapeHtml(note)}</div>` : ""}
        `;
        return card;
    }

    function renderBarListFromMap(
        map,
        container,
        previousItems,
        previousKey,
        max = CONFIG.RANK_LIMIT,
        suffix = "回"
    ) {
        if (!container) return;

        const items = sortMapEntries(map).slice(0, max);
        container.innerHTML = "";

        if (!items.length) {
            container.innerHTML = `<div class="empty-state">データがありません。</div>`;
            return;
        }

        const maxCount = Math.max(...items.map((item) => item.count), 1);
        const hasSnapshot = state.hasRankSnapshot[previousKey];

        items.forEach((item, i) => {
            const row = document.createElement("div");
            row.className = "stats-bar-row";

            const width = Math.max(
                6,
                Math.min((item.count / maxCount) * 100 * (CONFIG.BAR_SCALE / 3), 100)
            );

            const diff = getRankDiffByAdjacentSwap(
                previousItems,
                items,
                item.word,
                i + 1,
                hasSnapshot
            );

            row.innerHTML = `
                <div class="stats-bar-meta">
                    <div class="stats-bar-label">
                        <span class="stats-rank">${i + 1}</span>
                        <span>${escapeHtml(item.word)}</span>
                        <span class="stats-rank-diff ${diff.className}">${escapeHtml(diff.text)}</span>
                    </div>
                    <div class="stats-bar-count">${escapeHtml(item.count)}${escapeHtml(suffix)}</div>
                </div>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill" style="width:${width}%"></div>
                </div>
            `;

            container.appendChild(row);
        });
    }

    function refreshRankSnapshotsIfNeeded() {
        if (!shouldRefreshRankSnapshot()) return;

        const followerTopMap = new Map();

        stats.makuraFollowers.forEach((innerMap, key) => {
            const top = [...innerMap.entries()]
                .map(([word, count]) => ({ word, count }))
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return String(a.word || "").localeCompare(String(b.word || ""), "ja");
                })[0];

            if (top) {
                followerTopMap.set(`${key} → ${top.word}`, top.count);
            }
        });

        state.previousRankItems.makura = cloneRankItems(
            sortMapEntries(stats.makura).slice(0, CONFIG.RANK_LIMIT)
        );
        state.previousRankItems.plants = cloneRankItems(
            sortMapEntries(stats.plants).slice(0, CONFIG.RANK_LIMIT)
        );
        state.previousRankItems.animals = cloneRankItems(
            sortMapEntries(stats.animals).slice(0, CONFIG.RANK_LIMIT)
        );
        state.previousRankItems.places = cloneRankItems(
            sortMapEntries(stats.places).slice(0, CONFIG.RANK_LIMIT)
        );
        state.previousRankItems.endingBlocks = cloneRankItems(
            sortMapEntries(stats.endingBlocks).slice(0, CONFIG.RANK_LIMIT)
        );
        state.previousRankItems.independentWords = cloneRankItems(
            sortMapEntries(stats.independentWords).slice(0, CONFIG.INDEPENDENT_WORD_LIMIT)
        );
        state.previousRankItems.moon = cloneRankItems(
            sortMapEntries(stats.moon).slice(0, CONFIG.COOC_LIMIT)
        );
        state.previousRankItems.followers = cloneRankItems(
            sortMapEntries(followerTopMap).slice(0, CONFIG.RANK_LIMIT)
        );

        state.hasRankSnapshot.makura = true;
        state.hasRankSnapshot.plants = true;
        state.hasRankSnapshot.animals = true;
        state.hasRankSnapshot.places = true;
        state.hasRankSnapshot.endingBlocks = true;
        state.hasRankSnapshot.independentWords = true;
        state.hasRankSnapshot.moon = true;
        state.hasRankSnapshot.followers = true;
    }

    function renderTagDistribution() {
        renderStaticBarList(stats.tagDistribution, elements.tagDistribution, 20, "語");
    }

    function renderStaticBarList(map, container, max = 20, suffix = "語") {
        if (!container) return;

        const items = sortMapEntries(map).slice(0, max);
        container.innerHTML = "";

        if (!items.length) {
            container.innerHTML = `<div class="empty-state">データがありません。</div>`;
            return;
        }

        const maxCount = Math.max(...items.map((item) => item.count), 1);

        items.forEach((item, i) => {
            const row = document.createElement("div");
            row.className = "stats-bar-row";

            const width = Math.max(6, (item.count / maxCount) * 100);

            row.innerHTML = `
                <div class="stats-bar-meta">
                    <div class="stats-bar-label">
                        <span class="stats-rank">${i + 1}</span>
                        <span>${escapeHtml(item.word)}</span>
                    </div>
                    <div class="stats-bar-count">${escapeHtml(item.count)}${escapeHtml(suffix)}</div>
                </div>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill" style="width:${width}%"></div>
                </div>
            `;

            container.appendChild(row);
        });
    }

    function renderOverview() {
        if (!elements.summary || !elements.overview) return;

        const processed = state.processedCount;
        const total = state.poems.length;
        const percent = total ? ((processed / total) * 100).toFixed(1) : "0.0";

        elements.summary.textContent = state.isFinished
            ? `辞書 ${state.dictionary.length} 件 / 和歌 ${state.poems.length} 首 の解析が完了しました。`
            : `辞書 ${state.dictionary.length} 件 / 和歌 ${processed} / ${total} 首 を解析中（${percent}%）`;

        const tagKinds = stats.tagDistribution.size;
        const makuraCount = state.dictionary.filter(
            (entry) => Array.isArray(entry.tags) && entry.tags.includes("枕詞")
        ).length;

        const placeCount = state.dictionary.filter(
            (entry) => Array.isArray(entry.tags) && entry.tags.includes("地名")
        ).length;

        const conjugationCount = state.dictionary.filter((entry) => entry.conjugation).length;

        elements.overview.innerHTML = "";

        const fragment = document.createDocumentFragment();
        fragment.appendChild(createOverviewCard("登録語数", state.dictionary.length));
        fragment.appendChild(createOverviewCard("和歌データ数", state.poems.length));
        fragment.appendChild(createOverviewCard("タグ種類数", tagKinds));
        fragment.appendChild(createOverviewCard("枕詞登録数", makuraCount));
        fragment.appendChild(createOverviewCard("地名登録数", placeCount));
        fragment.appendChild(createOverviewCard("活用表つき語数", conjugationCount));

        elements.overview.appendChild(fragment);

        renderProgress();
    }

    function renderProgress() {
        if (!elements.progressText || !elements.progressBar) return;

        const processed = state.processedCount;
        const total = state.poems.length;
        const percent = total ? (processed / total) * 100 : 0;

        elements.progressText.textContent = `${processed} / ${total} 首`;
        elements.progressBar.style.width = `${percent}%`;
    }

    function renderCurrentPoem(poem, index) {
        if (!elements.currentPoem || !elements.currentPoemMeta) return;
        if (!poem) return;

        const metaParts = [
            poem.collection,
            poem.book,
            poem.ref_no || (poem.poem_no ? `歌番号 ${poem.poem_no}` : ""),
            poem.author
        ].filter(Boolean);

        elements.currentPoemMeta.textContent =
            `解析中 ${index + 1}首目 / ${metaParts.join(" / ")}`;

        const poemText = truncateText(poem.text || "本文なし", CONFIG.CURRENT_POEM_MAX_LENGTH);
        const kanaText = truncateText(poem.kana || "", CONFIG.CURRENT_POEM_KANA_MAX_LENGTH);

        elements.currentPoem.innerHTML = `
            <div class="stats-current-poem-text">${escapeHtml(poemText)}</div>
            ${kanaText ? `<div class="stats-current-poem-kana muted">${escapeHtml(kanaText)}</div>` : ""}
        `;
    }

    function renderLiveStats() {
        const flatFollowers = new Map();

        stats.makuraFollowers.forEach((innerMap, key) => {
            const top = [...innerMap.entries()]
                .map(([word, count]) => ({ word, count }))
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return String(a.word || "").localeCompare(String(b.word || ""), "ja");
                })[0];

            if (top) {
                flatFollowers.set(`${key} → ${top.word}`, top.count);
            }
        });

        renderBarListFromMap(
            stats.makura,
            elements.makurakotoba,
            state.previousRankItems.makura,
            "makura",
            CONFIG.RANK_LIMIT,
            "首"
        );

        renderBarListFromMap(
            stats.plants,
            elements.plants,
            state.previousRankItems.plants,
            "plants",
            CONFIG.RANK_LIMIT,
            "首"
        );

        renderBarListFromMap(
            stats.animals,
            elements.animals,
            state.previousRankItems.animals,
            "animals",
            CONFIG.RANK_LIMIT,
            "首"
        );

        renderBarListFromMap(
            stats.places,
            elements.places,
            state.previousRankItems.places,
            "places",
            CONFIG.RANK_LIMIT,
            "首"
        );

        renderBarListFromMap(
            stats.endingBlocks,
            elements.endingBlocks,
            state.previousRankItems.endingBlocks,
            "endingBlocks",
            CONFIG.RANK_LIMIT,
            "首"
        );

        renderBarListFromMap(
            stats.independentWords,
            elements.independentWords,
            state.previousRankItems.independentWords,
            "independentWords",
            CONFIG.INDEPENDENT_WORD_LIMIT,
            "回"
        );

        renderBarListFromMap(
            stats.moon,
            elements.moonCooccurrence,
            state.previousRankItems.moon,
            "moon",
            CONFIG.COOC_LIMIT,
            "回"
        );

        renderBarListFromMap(
            flatFollowers,
            elements.makuraFollowers,
            state.previousRankItems.followers,
            "followers",
            CONFIG.RANK_LIMIT,
            "回"
        );
    }

    function analyzePoem(poem, prepared) {
        const tokens = Array.isArray(poem.search_tokens)
            ? poem.search_tokens
            : Array.isArray(poem.tokens)
                ? poem.tokens
                : [];

        const joined = normalize([
            poem.text || "",
            poem.kana || "",
            ...tokens
        ].join(" "));

        prepared.makura.forEach((entry) => {
            if (entry.forms.some((form) => joined.includes(form))) {
                increment(stats.makura, entry.word);
            }
        });

        prepared.plants.forEach((entry) => {
            if (entry.forms.some((form) => joined.includes(form))) {
                increment(stats.plants, entry.word);
            }
        });

        prepared.animals.forEach((entry) => {
            if (entry.forms.some((form) => joined.includes(form))) {
                increment(stats.animals, entry.word);
            }
        });

        prepared.places.forEach((entry) => {
            if (entry.forms.some((form) => joined.includes(form))) {
                increment(stats.places, entry.word);
            }
        });

        const endingBlock = getLastKanaBlock(poem.kana);
        if (endingBlock) {
            increment(stats.endingBlocks, endingBlock);
        }

        tokens.forEach((token) => {
            const word = String(token || "").trim();
            if (!isIndependentToken(word)) return;
            increment(stats.independentWords, word);
        });

        if (joined.includes(normalize("月"))) {
            tokens.forEach((token) => {
                const word = String(token || "").trim();
                if (!word || word === "月" || word.length <= 1) return;
                increment(stats.moon, word);
            });
        }

        prepared.makura.forEach((entry) => {
            for (let i = 0; i < tokens.length; i++) {
                const token = normalize(tokens[i]);
                if (entry.forms.includes(token)) {
                    const next = String(tokens[i + 1] || "").trim();
                    if (next) {
                        incrementNested(stats.makuraFollowers, entry.word, next);
                    }
                }
            }
        });
    }

    function startLiveAnalysis(prepared) {
        let index = 0;
        const chunk = CONFIG.ANALYSIS_CHUNK;

        function step() {
            const end = Math.min(index + chunk, state.poems.length);

            for (let i = index; i < end; i++) {
                analyzePoem(state.poems[i], prepared);
                renderCurrentPoem(state.poems[i], i);
            }

            index = end;
            state.processedCount = index;

            renderOverview();
            renderLiveStats();
            refreshRankSnapshotsIfNeeded();

            if (index < state.poems.length) {
                setTimeout(step, CONFIG.ANALYSIS_DELAY);
            } else {
                state.isFinished = true;

                renderOverview();
                renderLiveStats();
                refreshRankSnapshotsIfNeeded();

                if (elements.currentPoemMeta) {
                    elements.currentPoemMeta.textContent = "解析完了";
                }
            }
        }

        step();
    }

    async function init() {
        try {
            const [dictionary, poems] = await Promise.all([
                loadDictionary(),
                loadPoems()
            ]);

            state.dictionary = dictionary;
            state.poems = poems;

            buildDictionaryStats(dictionary);
            renderOverview();
            renderTagDistribution();

            const prepared = {
                makura: prepareEntries(dictionary, "枕詞"),
                plants: prepareEntries(dictionary, "植物"),
                animals: prepareEntries(dictionary, "動物"),
                places: prepareEntries(dictionary, "地名"),
            };

            startLiveAnalysis(prepared);

        } catch (e) {
            console.error(e);
            if (elements.summary) {
                elements.summary.textContent = "統計データ読み込み失敗";
            }
        }
    }

    init();

})();