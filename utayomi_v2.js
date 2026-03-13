(function () {
    "use strict";

    const utayomiV2State = {
        initialized: false,
        currentPoem: null,
        lastOptions: null,
    };

    const utayomiV2Elements = {
        tabButton: document.getElementById("generatorV2TabButton"),
        panel: document.getElementById("generatorV2ModePanel"),

        seasonFilter: document.getElementById("generatorV2SeasonFilter"),
        collectionFilter: document.getElementById("generatorV2CollectionFilter"),
        authorFilter: document.getElementById("generatorV2AuthorFilter"),

        keywordInput: document.getElementById("generatorV2KeywordInput"),
        keywordModeSelect: document.getElementById("generatorV2KeywordModeSelect"),
        shapeSelect: document.getElementById("generatorV2ShapeSelect"),

        preferKigoToggle: document.getElementById("generatorV2PreferKigoToggle"),
        preferNaturalToggle: document.getElementById("generatorV2PreferNaturalToggle"),
        useMakuraToggle: document.getElementById("generatorV2UseMakuraToggle"),

        generateButton: document.getElementById("generateAutoPoemV2Button"),
        randomButton: document.getElementById("generateRandomPoemV2Button"),
        copyButton: document.getElementById("copyGeneratedPoemV2Button"),

        result: document.getElementById("generatedPoemV2Result"),
        meta: document.getElementById("generatedPoemV2Meta"),
        source: document.getElementById("generatedPoemV2Source"),
    };

    const V2_LINE_CACHE = new Map();
    const V2_TERM_CACHE = {
        ready: false,
        terms: [],
    };

    function initializeUtaYomiV2() {
        if (utayomiV2State.initialized) return;
        if (!utayomiV2Elements.panel) return;

        if (
            !window.state ||
            !Array.isArray(window.state.poems) ||
            !window.state.poems.length ||
            !Array.isArray(window.state.termDictionary)
        ) {
            setTimeout(initializeUtaYomiV2, 200);
            return;
        }

        buildTermCacheForV2();
        populateUtaYomiV2Filters();
        bindUtaYomiV2Events();
        renderGeneratedPoemV2Empty();

        utayomiV2State.initialized = true;
    }

    function bindUtaYomiV2Events() {
        utayomiV2Elements.generateButton?.addEventListener("click", handleGenerateAutoPoemV2);
        utayomiV2Elements.randomButton?.addEventListener("click", handleGenerateRandomPoemV2);
        utayomiV2Elements.copyButton?.addEventListener("click", copyGeneratedPoemV2);
    }

    function populateUtaYomiV2Filters() {
        const poems = Array.isArray(window.state?.poems) ? window.state.poems : [];

        const collections = [...new Set(poems.map((poem) => poem.collection).filter(Boolean))]
            .sort((a, b) => String(a).localeCompare(String(b), "ja"));

        const authors = [...new Set(poems.map((poem) => poem.author).filter(Boolean))]
            .sort((a, b) => String(a).localeCompare(String(b), "ja"));

        const collectionCounts = buildCountMap(poems.map((poem) => poem.collection));
        const authorCounts = buildCountMap(poems.map((poem) => poem.author));

        appendOptionsSafe(utayomiV2Elements.collectionFilter, collections, collectionCounts);
        appendOptionsSafe(utayomiV2Elements.authorFilter, authors, authorCounts);
    }

    function handleGenerateAutoPoemV2() {
        const options = getGeneratorV2Options();
        utayomiV2State.lastOptions = options;

        const poem = generateSeriousAutoPoem(options);

        if (!poem) {
            renderGeneratedPoemV2Failure("条件に合う一首を生成できませんでした。条件を少し緩めてみてください。");
            return;
        }

        utayomiV2State.currentPoem = poem;
        renderGeneratedPoemV2(poem);
    }

    function handleGenerateRandomPoemV2() {
        const options = {
            season: "",
            collection: "",
            author: "",
            keyword: "",
            keywordMode: "prefer",
            shape: "57577",
            preferKigo: true,
            preferNatural: true,
            useMakuraRules: true,
            forceRandom: true,
        };

        utayomiV2State.lastOptions = options;

        const poem = generateSeriousAutoPoem(options);

        if (!poem) {
            renderGeneratedPoemV2Failure("おまかせ生成に失敗しました。");
            return;
        }

        utayomiV2State.currentPoem = poem;
        renderGeneratedPoemV2(poem);
    }

    function getGeneratorV2Options() {
        return {
            season: utayomiV2Elements.seasonFilter?.value || "",
            collection: utayomiV2Elements.collectionFilter?.value || "",
            author: utayomiV2Elements.authorFilter?.value || "",
            keyword: String(utayomiV2Elements.keywordInput?.value || "").trim(),
            keywordMode: utayomiV2Elements.keywordModeSelect?.value || "prefer",
            shape: utayomiV2Elements.shapeSelect?.value || "57577",
            preferKigo: !!utayomiV2Elements.preferKigoToggle?.checked,
            preferNatural: !!utayomiV2Elements.preferNaturalToggle?.checked,
            useMakuraRules: !!utayomiV2Elements.useMakuraToggle?.checked,
            forceRandom: false,
        };
    }

    function generateSeriousAutoPoem(options) {
        const poems = filterPoemsForV2(options);
        if (!poems.length) return null;

        const linePools = buildSeriousLinePools(poems, options);
        if (!linePools.every((pool) => Array.isArray(pool) && pool.length)) {
            return null;
        }

        const lines = [];
        const sourceNotes = [];
        let previousLine = "";

        for (let slotIndex = 0; slotIndex < 5; slotIndex += 1) {
            const line = pickBestSeriousLineForSlot(linePools[slotIndex], previousLine, slotIndex, options, lines);
            if (!line) return null;

            lines.push(line.line);
            previousLine = line.line;

            if (line.source) {
                sourceNotes.push(formatSourceNote(line.source, slotIndex + 1));
            }
        }

        return {
            mode: "generator-v2",
            lines,
            meta: {
                season: options.season || "",
                keyword: options.keyword || "",
                collection: options.collection || "",
                author: options.author || "",
                shape: options.shape || "57577",
            },
            sourceMemo: uniqueStrings(sourceNotes).join("\n"),
        };
    }

    function filterPoemsForV2(options) {
        const allPoems = Array.isArray(window.state?.poems) ? window.state.poems : [];

        return allPoems.filter((poem) => {
            if (options.collection && poem.collection !== options.collection) return false;
            if (options.author && poem.author !== options.author) return false;
            if (options.season && poem.season && poem.season !== options.season) return false;
            return true;
        });
    }

    function buildSeriousLinePools(poems, options) {
        const pools = [[], [], [], [], []];

        poems.forEach((poem) => {
            const lines = getPoemLinesForV2(poem);
            if (lines.length < 5) return;

            for (let i = 0; i < 5; i += 1) {
                const line = lines[i];
                const entry = {
                    line,
                    source: poem,
                    score: scoreSeriousLine(line, poem, options, i),
                    features: getCachedLineFeaturesV2(line),
                };
                pools[i].push(entry);
            }
        });

        return pools.map((pool) => pool.sort((a, b) => b.score - a.score));
    }

    function pickBestSeriousLineForSlot(pool, previousLine, slotIndex, options, existingLines) {
        if (!Array.isArray(pool) || !pool.length) return null;

        const candidates = options.forceRandom
            ? shuffleArray(pool).slice(0, Math.min(20, pool.length))
            : pool.slice(0, Math.min(24, pool.length));

        let best = null;
        let bestScore = -Infinity;

        for (const item of candidates) {
            if (!item?.line) continue;

            if (existingLines.includes(item.line)) continue;

            if (options.useMakuraRules && hasUnresolvedMakurakotobaV2(previousLine, item.line)) {
                continue;
            }

            let totalScore = item.score;

            if (previousLine) {
                totalScore += scoreSeriousLineConnection(previousLine, item.line, options, slotIndex);
            } else {
                totalScore += scoreSeriousOpeningLine(item.line, options, slotIndex);
            }

            totalScore += scoreSeriousLineRole(item.line, slotIndex);
            totalScore += scoreKeywordForLineV2(item.line, options);

            if (totalScore > bestScore) {
                bestScore = totalScore;
                best = item;
            }
        }

        return best;
    }

    function scoreSeriousLine(line, poem, options, slotIndex) {
        let score = 0;
        const normalized = normalizeLiteV2(line);
        const features = getCachedLineFeaturesV2(line);

        if (!normalized) return -999;

        if (options.collection && poem.collection === options.collection) score += 3;
        if (options.author && poem.author === options.author) score += 4;
        if (options.season && poem.season === options.season) score += 5;

        if (options.shape === "57577") {
            const targets = [5, 7, 5, 7, 7];
            const diff = Math.abs(countKanaLikeV2(line) - targets[slotIndex]);
            score += Math.max(0, 6 - diff * 2);
        }

        if (options.preferNatural) {
            score += Math.min(4, features.terms.length * 0.8);
        }

        if (options.useMakuraRules && slotIndex === 0 && features.makuraTerms.length) {
            score += 4;
        }

        if (slotIndex <= 1 && features.placeTerms.length) {
            score += 1.5;
        }

        if (options.preferKigo && features.kigoTerms.length) {
            score += 2.5;
        }

        score += scoreKeywordForLineV2(line, options);

        if (options.forceRandom) {
            score += Math.random() * 4;
        }

        return score;
    }

    function scoreSeriousLineConnection(previousLine, currentLine, options, slotIndex) {
        const prev = getCachedLineFeaturesV2(previousLine);
        const curr = getCachedLineFeaturesV2(currentLine);

        let score = 0;

        score += scoreMakurakotobaResolutionV2(prev, curr, options);
        score += scoreRelatedBridgeV2(prev, curr);
        score += scoreSeasonConsistencyV2(prev, curr, options);
        score += scoreEndingFitnessV2(currentLine, slotIndex);
        score += scoreBasicFlowV2(previousLine, currentLine);

        return score;
    }

    function scoreSeriousOpeningLine(line, options, slotIndex) {
        if (slotIndex !== 0) return 0;

        const features = getCachedLineFeaturesV2(line);
        let score = 0;

        if (features.makuraTerms.length) score += 3;
        if (features.placeTerms.length) score += 2;
        if (features.kigoTerms.length && options.preferKigo) score += 2;

        return score;
    }

    function scoreSeriousLineRole(line, slotIndex) {
        const normalized = normalizeLiteV2(line);
        let score = 0;

        if (slotIndex <= 1) {
            if (/山|野|里|浦|海|月|花|雪|露|風/.test(normalized)) score += 2;
            if (/かは|やは|いかに|あらまし/.test(normalized)) score -= 5;
        }

        if (slotIndex === 4) {
            if (/けり|かな|らむ|けむ|なり/.test(normalized)) score += 2;
            if (/して|にて|より|など/.test(normalized)) score -= 2;
        }

        return score;
    }

    function scoreKeywordForLineV2(line, options) {
        const keyword = String(options.keyword || "").trim();
        if (!keyword) return 0;

        const normalizedLine = normalizeLiteV2(line);
        const normalizedKeyword = normalizeLiteV2(keyword);
        if (!normalizedLine || !normalizedKeyword) return 0;

        if (normalizedLine.includes(normalizedKeyword)) {
            if (options.keywordMode === "must") return 8;
            if (options.keywordMode === "prefer") return 4;
            return 2;
        }

        const matchedTerms = getCachedLineFeaturesV2(line).terms;
        const relatedHit = matchedTerms.some((term) =>
            (term.__v2cache?.normalizedRelated || []).some((r) => r.includes(normalizedKeyword) || normalizedKeyword.includes(r))
        );

        if (relatedHit) {
            if (options.keywordMode === "theme") return 3;
            return 1.5;
        }

        if (options.keywordMode === "must") return -6;
        return 0;
    }

    function scoreMakurakotobaResolutionV2(prevFeatures, currFeatures, options) {
        if (!options.useMakuraRules) return 0;

        let score = 0;

        for (const term of prevFeatures.makuraTerms) {
            const related = term.__v2cache?.normalizedRelated || [];
            if (!related.length) continue;

            const resolvedInPrev = related.some((r) => prevFeatures.normalizedLine.includes(r));
            const resolvedInCurr = related.some((r) => currFeatures.normalizedLine.includes(r));

            if (resolvedInCurr) {
                score += 16;
            } else if (!resolvedInPrev) {
                score -= 18;
            }
        }

        return score;
    }

    function scoreRelatedBridgeV2(prevFeatures, currFeatures) {
        let score = 0;

        for (const term of prevFeatures.terms) {
            const related = term.__v2cache?.normalizedRelated || [];
            const hits = related.filter((r) => currFeatures.normalizedLine.includes(r)).length;
            score += hits * 3;
        }

        for (const term of currFeatures.terms) {
            const related = term.__v2cache?.normalizedRelated || [];
            const hits = related.filter((r) => prevFeatures.normalizedLine.includes(r)).length;
            score += hits * 1.5;
        }

        return score;
    }

    function scoreSeasonConsistencyV2(prevFeatures, currFeatures, options) {
        const seasonNames = ["春", "夏", "秋", "冬"];
        const prevSet = new Set(prevFeatures.seasonTags.filter((s) => seasonNames.includes(s)));
        const currSet = new Set(currFeatures.seasonTags.filter((s) => seasonNames.includes(s)));

        let score = 0;

        if (options.season) {
            if (currSet.has(options.season) || prevSet.has(options.season)) {
                score += 2.5;
            }
        }

        if (prevSet.size && currSet.size) {
            const overlap = [...prevSet].filter((s) => currSet.has(s)).length;
            if (overlap > 0) score += 3;
            else score -= 5;
        }

        return score;
    }

    function scoreEndingFitnessV2(line, slotIndex) {
        const normalized = normalizeLiteV2(line);
        let score = 0;

        if (slotIndex === 4) {
            if (/けり|かな|らむ|けむ|なり/.test(normalized)) score += 2;
            if (/の|に|を|て|して$/.test(normalized)) score -= 3;
        }

        return score;
    }

    function scoreBasicFlowV2(previousLine, currentLine) {
        const prev = normalizeLiteV2(previousLine);
        const curr = normalizeLiteV2(currentLine);
        let score = 0;

        if (!prev || !curr) return 0;

        const prevTail = getLineTailV2(prev);
        const currHead = getLineHeadV2(curr);
        if (prevTail && currHead && prevTail !== currHead) score += 0.5;

        const overlap = [...new Set(prev.split(""))].filter((ch) => curr.includes(ch)).length;
        score += Math.min(1.5, overlap * 0.25);

        return score;
    }

    function hasUnresolvedMakurakotobaV2(previousLine, currentLine) {
        if (!previousLine) return false;

        const prev = getCachedLineFeaturesV2(previousLine);
        const curr = getCachedLineFeaturesV2(currentLine);

        for (const term of prev.makuraTerms) {
            const related = term.__v2cache?.normalizedRelated || [];
            if (!related.length) continue;

            const resolvedInPrev = related.some((r) => prev.normalizedLine.includes(r));
            const resolvedInCurr = related.some((r) => curr.normalizedLine.includes(r));

            if (!resolvedInPrev && !resolvedInCurr) {
                return true;
            }
        }

        return false;
    }

    function getPoemLinesForV2(poem) {
        if (!poem) return [];

        if (Array.isArray(poem.lines) && poem.lines.length >= 5) {
            return poem.lines.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 5);
        }

        if (typeof poem.text === "string" && poem.text.includes("\n")) {
            const split = poem.text
                .split(/\r?\n/)
                .map((line) => String(line || "").trim())
                .filter(Boolean);

            if (split.length >= 5) return split.slice(0, 5);
        }

        if (Array.isArray(poem.tokens) && poem.tokens.length >= 5) {
            return poem.tokens
                .map((token) => String(token || "").trim())
                .filter(Boolean)
                .slice(0, 5);
        }

        if (typeof poem.kana === "string") {
            const split = poem.kana
                .split(/[\s\u3000]+/)
                .map((line) => String(line || "").trim())
                .filter(Boolean);

            if (split.length >= 5) return split.slice(0, 5);
        }

        return [];
    }

    function buildTermCacheForV2() {
        const terms = Array.isArray(window.state?.termDictionary) ? window.state.termDictionary : [];
        if (!terms.length) {
            V2_TERM_CACHE.terms = [];
            V2_TERM_CACHE.ready = true;
            return;
        }

        V2_TERM_CACHE.terms = terms.map((term) => {
            const forms = [
                term.word,
                term.reading,
                ...(Array.isArray(term.surface_forms) ? term.surface_forms : []),
                ...(Array.isArray(term.aliases) ? term.aliases : []),
                ...(Array.isArray(term.variants) ? term.variants : []),
            ]
                .map((v) => String(v || "").trim())
                .filter(Boolean);

            const normalizedForms = uniqueStrings(
                forms.map((v) => normalizeLiteV2(v)).filter(Boolean)
            );

            const normalizedTags = uniqueStrings(
                (Array.isArray(term.tags) ? term.tags : [])
                    .map((v) => String(v || "").trim())
                    .filter(Boolean)
            );

            const normalizedRelated = uniqueStrings(
                (Array.isArray(term.related) ? term.related : [])
                    .map((v) => normalizeLiteV2(v))
                    .filter(Boolean)
            );

            return {
                ...term,
                __v2cache: {
                    forms,
                    normalizedForms,
                    normalizedTags,
                    normalizedRelated,
                },
            };
        });

        V2_TERM_CACHE.ready = true;
    }

    function getCachedLineFeaturesV2(line) {
        const normalizedLine = normalizeLiteV2(line);

        if (!normalizedLine) {
            return {
                normalizedLine: "",
                terms: [],
                makuraTerms: [],
                placeTerms: [],
                kigoTerms: [],
                seasonTags: [],
            };
        }

        if (V2_LINE_CACHE.has(normalizedLine)) {
            return V2_LINE_CACHE.get(normalizedLine);
        }

        const terms = getMatchedTermsForLineV2(normalizedLine);

        const features = {
            normalizedLine,
            terms,
            makuraTerms: terms.filter(isMakurakotobaV2),
            placeTerms: terms.filter(isPlaceTermV2),
            kigoTerms: terms.filter(isKigoTermV2),
            seasonTags: uniqueStrings(
                terms.flatMap((term) =>
                    (term.__v2cache?.normalizedTags || []).filter((tag) => ["春", "夏", "秋", "冬"].includes(tag))
                )
            ),
        };

        V2_LINE_CACHE.set(normalizedLine, features);
        return features;
    }

    function getMatchedTermsForLineV2(normalizedLine) {
        if (!V2_TERM_CACHE.ready) {
            buildTermCacheForV2();
        }

        if (!normalizedLine) return [];

        const matched = [];

        for (const term of V2_TERM_CACHE.terms) {
            const forms = term.__v2cache?.normalizedForms || [];
            if (!forms.length) continue;

            const hit = forms.some((form) => {
                if (!form) return false;

                if (form.length === 1) {
                    const pos = String(term.partOfSpeech || "");
                    if (pos.includes("助詞") || pos.includes("助動詞") || pos.includes("動詞")) {
                        return false;
                    }
                }

                return normalizedLine.includes(form);
            });

            if (hit) matched.push(term);
        }

        return matched.sort((a, b) => {
            const aLen = Math.max(...((a.__v2cache?.normalizedForms || [a.word || ""]).map((v) => String(v).length)));
            const bLen = Math.max(...((b.__v2cache?.normalizedForms || [b.word || ""]).map((v) => String(v).length)));

            if (bLen !== aLen) return bLen - aLen;
            return String(a.word || "").localeCompare(String(b.word || ""), "ja");
        });
    }

    function isMakurakotobaV2(term) {
        return String(term.partOfSpeech || "").includes("枕詞") ||
            (term.__v2cache?.normalizedTags || []).includes("枕詞");
    }

    function isPlaceTermV2(term) {
        const tags = term.__v2cache?.normalizedTags || [];
        return String(term.partOfSpeech || "").includes("地名") ||
            tags.includes("地名") ||
            tags.includes("歌枕");
    }

    function isKigoTermV2(term) {
        const tags = term.__v2cache?.normalizedTags || [];
        return tags.includes("季語") ||
            tags.includes("春") ||
            tags.includes("夏") ||
            tags.includes("秋") ||
            tags.includes("冬");
    }

    function renderGeneratedPoemV2(poem) {
        if (utayomiV2Elements.result) {
            utayomiV2Elements.result.innerHTML = poem.lines
                .map((line) => `<div>${escapeHtmlSafe(line)}</div>`)
                .join("");
        }

        if (utayomiV2Elements.meta) {
            const chips = [
                "AI歌詠み ver2",
                poem.meta?.season || "季節指定なし",
                poem.meta?.keyword || "語句指定なし",
                poem.meta?.shape || "形式自動",
            ];

            utayomiV2Elements.meta.innerHTML = chips
                .map((text) => `<span class="filter-chip">${escapeHtmlSafe(text)}</span>`)
                .join("");
        }

        if (utayomiV2Elements.source) {
            utayomiV2Elements.source.textContent = poem.sourceMemo || "参照メモはありません。";
        }
    }

    function renderGeneratedPoemV2Failure(message) {
        if (utayomiV2Elements.result) {
            utayomiV2Elements.result.innerHTML =
                `<div class="empty-state">${escapeHtmlSafe(message)}</div>`;
        }

        if (utayomiV2Elements.meta) {
            utayomiV2Elements.meta.innerHTML =
                '<span class="filter-chip">AI歌詠み ver2</span>';
        }

        if (utayomiV2Elements.source) {
            utayomiV2Elements.source.textContent = "";
        }
    }

    function renderGeneratedPoemV2Empty() {
        if (utayomiV2Elements.result) {
            utayomiV2Elements.result.innerHTML =
                '<div class="empty-state">ここに本格生成された一首を表示します。</div>';
        }

        if (utayomiV2Elements.meta) {
            utayomiV2Elements.meta.innerHTML =
                '<span class="filter-chip">まだ生成していません</span>';
        }

        if (utayomiV2Elements.source) {
            utayomiV2Elements.source.textContent = "後で、使用した条件や参照候補を表示できます。";
        }
    }

    async function copyGeneratedPoemV2() {
        const poem = utayomiV2State.currentPoem;
        if (!poem?.lines?.length) return;

        try {
            await navigator.clipboard.writeText(poem.lines.join("\n"));
        } catch (error) {
            console.warn("Ver2のコピーに失敗しました:", error);
        }
    }

    function formatSourceNote(source, slotNumber) {
        const parts = [
            `第${slotNumber}句`,
            source.collection || "",
            source.author || "",
            source.poem_no ? `歌番号 ${source.poem_no}` : "",
        ].filter(Boolean);

        return parts.join(" / ");
    }

    function appendOptionsSafe(selectElement, values, countMap) {
        if (!selectElement) return;

        const existingValues = new Set(
            [...selectElement.options].map((opt) => String(opt.value || ""))
        );

        const fragment = document.createDocumentFragment();

        values.forEach((value) => {
            if (!value || existingValues.has(String(value))) return;

            const option = document.createElement("option");
            option.value = value;
            const count = countMap?.get(value);
            option.textContent = typeof count === "number" ? `${value} (${count})` : value;
            fragment.appendChild(option);
        });

        selectElement.appendChild(fragment);
    }

    function buildCountMap(values) {
        const map = new Map();

        values.forEach((value) => {
            if (!value) return;
            map.set(value, (map.get(value) || 0) + 1);
        });

        return map;
    }

    function shuffleArray(array) {
        const cloned = [...array];

        for (let i = cloned.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
        }

        return cloned;
    }

    function uniqueStrings(values) {
        return [...new Set(values.filter(Boolean))];
    }

    function normalizeLiteV2(text) {
        return String(text || "")
            .normalize("NFKC")
            .replace(/[\s\u3000]+/g, "")
            .toLowerCase();
    }

    function escapeHtmlSafe(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function countKanaLikeV2(text) {
        return String(text || "")
            .replace(/[^\u3040-\u309F\u30A0-\u30FFー]/g, "")
            .length;
    }

    function getLineHeadV2(text) {
        return String(text || "").charAt(0);
    }

    function getLineTailV2(text) {
        const s = String(text || "");
        return s.charAt(s.length - 1);
    }

    document.addEventListener("DOMContentLoaded", initializeUtaYomiV2);
    initializeUtaYomiV2();

    window.initializeUtaYomiV2 = initializeUtaYomiV2;
    window.generateSeriousAutoPoem = generateSeriousAutoPoem;
})();