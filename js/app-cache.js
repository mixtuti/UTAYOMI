// 検索用キャッシュ・季語判定
(function (global) {
  const app = global.WakaApp;

  // 誤検出しやすい短い動詞・補助的な語
  // ここに入れた語は、通常一致では採用せず manual_terms があるときだけ出す
  app.constants = app.constants || {};
  app.constants.MANUAL_ONLY_SENSITIVE_TERMS = new Set([
    "死ぬ",
    "する",
    "なる",
    "いる",
    "居る",
    "あり",
    "有り",
    "行く",
    "来",
    "見る"
  ].map((v) => app.normalizeText(v)));

  app.initializePoemCaches = function initializePoemCaches() {
    const state = app.state;

    state.poems.forEach((poem) => {
      const rawTokens = Array.isArray(poem.tokens)
        ? poem.tokens.map((t) => String(t).trim()).filter(Boolean)
        : [];

      const searchTokens = Array.isArray(poem.search_tokens) && poem.search_tokens.length
        ? poem.search_tokens.map((t) => String(t).trim()).filter(Boolean)
        : app.expandTokens(rawTokens);

      poem.__cache = {
        normalizedText: app.normalizeText(poem.text || ""),
        normalizedKana: app.normalizeText(poem.kana || ""),
        normalizedAuthor: app.normalizeText(poem.author || ""),
        normalizedTheme: app.normalizeText(poem.theme || ""),
        normalizedSeason: app.normalizeText(poem.season || ""),
        normalizedKeywords: Array.isArray(poem.keywords)
          ? poem.keywords.map((w) => app.normalizeText(w)).filter(Boolean)
          : [],
        rawTokens,
        normalizedRawTokens: rawTokens.map((t) => app.normalizeText(t)).filter(Boolean),
        searchTokens,
        normalizedSearchTokens: searchTokens.map((t) => app.normalizeText(t)).filter(Boolean),
        joinedSearchTokens: searchTokens.map((t) => app.normalizeText(t)).join(""),
        kigoEntries: null,
        kigoWords: null,
        kigoSeasons: null,
      };
    });
  };

  // 助詞・助動詞かどうかを判定
  app.isFunctionWordTerm = function isFunctionWordTerm(term) {
    const pos = String(term?.partOfSpeech || "");
    return pos.includes("助詞") || pos.includes("助動詞");
  };

  // 危険語リストに入っている、manual_terms 必須の語かどうか
  app.isSensitiveManualOnlyTerm = function isSensitiveManualOnlyTerm(term) {
    const word = app.normalizeText(term?.word || "");
    if (!word) return false;
    return app.constants.MANUAL_ONLY_SENSITIVE_TERMS.has(word);
  };

  // manual_terms による明示許可が必要な語かどうか
  // - 1文字語
  // - 助詞
  // - 助動詞
  // - 危険語リストに入った短い動詞など
  app.isStrictManualOnlyTerm = function isStrictManualOnlyTerm(term) {
    const word = app.normalizeText(term?.word || "");
    if (word.length <= 1) return true;
    if (app.isFunctionWordTerm(term)) return true;
    if (app.isSensitiveManualOnlyTerm(term)) return true;
    return false;
  };

  // この歌データが、その語釈を明示的に許可しているかを判定
  // poem.manual_terms に term.word またはそのフォームが入っていれば許可
  app.isTermAllowedByPoemManualTerms = function isTermAllowedByPoemManualTerms(poem, term) {
    const manualTerms = Array.isArray(poem.manual_terms) ? poem.manual_terms : [];
    if (!manualTerms.length) return false;

    const allowed = new Set(
      manualTerms
        .map((item) => (typeof item === "string" ? item : item?.word))
        .map((v) => app.normalizeText(v))
        .filter(Boolean)
    );

    const word = app.normalizeText(term?.word || "");
    const forms = term.__cache?.normalizedForms || [];

    if (word && allowed.has(word)) return true;
    return forms.some((form) => allowed.has(form));
  };

  // この歌データが、その語釈を明示的に除外しているかを判定
  // poem.manual_exclude_terms に term.word またはそのフォームが入っていれば除外
  app.isTermExcludedByPoemManualTerms = function isTermExcludedByPoemManualTerms(poem, term) {
    const manualExcluded = Array.isArray(poem.manual_exclude_terms)
      ? poem.manual_exclude_terms
      : [];

    if (!manualExcluded.length) return false;

    const blocked = new Set(
      manualExcluded
        .map((item) => (typeof item === "string" ? item : item?.word))
        .map((v) => app.normalizeText(v))
        .filter(Boolean)
    );

    const word = app.normalizeText(term?.word || "");
    const forms = term.__cache?.normalizedForms || [];

    if (word && blocked.has(word)) return true;
    return forms.some((form) => blocked.has(form));
  };

  app.initializeTermCaches = function initializeTermCaches() {
    const state = app.state;

    state.termDictionary = (Array.isArray(state.termDictionary) ? state.termDictionary : []).map((term) => {
      const rawEntries = [
        { value: term.word, source: "word" },
        { value: term.reading, source: "reading" },
        ...(Array.isArray(term.surface_forms) ? term.surface_forms.map((v) => ({ value: v, source: "surface_forms" })) : []),
        ...(Array.isArray(term.aliases) ? term.aliases.map((v) => ({ value: v, source: "aliases" })) : []),
        ...(Array.isArray(term.variants) ? term.variants.map((v) => ({ value: v, source: "variants" })) : [])
      ]
        .map((item) => ({
          raw: String(item.value || "").trim(),
          source: item.source
        }))
        .filter((item) => item.raw);

      const forms = rawEntries.map((item) => item.raw);

      const normalizedEntries = rawEntries
        .map((item) => ({
          form: app.normalizeText(item.raw),
          source: item.source
        }))
        .filter((item) => item.form);

      const seen = new Set();
      const normalizedEntriesUnique = normalizedEntries.filter((item) => {
        const key = `${item.source}:${item.form}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const normalizedForms = [...new Set(
        normalizedEntriesUnique.map((item) => item.form)
      )];

      const isFunctionWord = app.isFunctionWordTerm(term);
      const isSensitiveManualOnly = app.isSensitiveManualOnlyTerm(term);

      // 実際の一致判定に使うフォーム
      // - 助詞・助動詞はそのまま残す（ただし採用は manual_terms 必須）
      // - 危険語リスト語は厳密一致を作らない（manual_terms でのみ通す）
      // - 内容語は1文字一致を禁止
      // - 動詞は reading / aliases だけの一致を避けて誤爆を減らす
      const strictMatchForms = normalizedEntriesUnique
        .filter((item) => {
          if (!item.form) return false;
          if (isSensitiveManualOnly) return false;
          if (isFunctionWord) return true;

          const pos = String(term?.partOfSpeech || "");
          const isVerb = pos.includes("動詞");
          if (isVerb && (item.source === "reading" || item.source === "aliases")) {
            return false;
          }

          return item.form.length >= 2;
        })
        .map((item) => item.form);

      return {
        ...term,
        __cache: {
          forms,
          normalizedForms,
          strictMatchForms
        }
      };
    });
  };

  app.getPoemCache = function getPoemCache(poem) {
    if (!poem.__cache) {
      app.initializePoemCaches();
    }
    return poem.__cache;
  };

  app.getSearchTokens = function getSearchTokens(poem) {
    return app.getPoemCache(poem).searchTokens;
  };

  app.getNormalizedSearchTokens = function getNormalizedSearchTokens(poem) {
    return app.getPoemCache(poem).normalizedSearchTokens;
  };

  app.expandTokens = function expandTokens(tokens) {
    return tokens.flatMap((token) => app.splitTokenForSearch(token));
  };

  app.splitTokenForSearch = function splitTokenForSearch(token) {
    const original = String(token || "").trim();
    if (!original) return [];

    let working = app.normalizeText(original);
    if (!working) return [];

    app.constants.TOKEN_SPLIT_PATTERNS.forEach((pattern) => {
      const normalizedPattern = app.normalizeText(pattern);
      if (!normalizedPattern) return;

      const regex = new RegExp(app.escapeRegExp(normalizedPattern), "g");
      working = working.replace(regex, `|${normalizedPattern}|`);
    });

    const parts = working
      .replace(/\|+/g, "|")
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.length ? parts : [original];
  };

  app.detectKigoEntries = function detectKigoEntries(poem) {
    const cache = app.getPoemCache(poem);
    if (cache.kigoEntries) return cache.kigoEntries;

    const tokenSet = new Set(cache.normalizedSearchTokens);
    const state = app.state;

    const sortedDictionary = [...state.kigoDictionary].sort(
      (a, b) => String(b.word || "").length - String(a.word || "").length
    );

    const matched = sortedDictionary.filter((entry) => {
      const word = app.normalizeText(entry.word || "");
      if (!word) return false;

      const matchedByToken = tokenSet.size > 0 && tokenSet.has(word);
      const matchedByText = !matchedByToken && cache.normalizedText.includes(word);

      return matchedByToken || matchedByText;
    });

    cache.kigoEntries = app.uniqueBy(
      matched,
      (entry) => `${entry.word}__${entry.season || ""}`
    );

    return cache.kigoEntries;
  };

  app.detectKigoWords = function detectKigoWords(poem) {
    const cache = app.getPoemCache(poem);
    if (!cache.kigoWords) {
      cache.kigoWords = [...new Set(app.detectKigoEntries(poem).map((entry) => entry.word).filter(Boolean))];
    }
    return cache.kigoWords;
  };

  app.detectKigoSeasons = function detectKigoSeasons(poem) {
    const cache = app.getPoemCache(poem);
    if (!cache.kigoSeasons) {
      cache.kigoSeasons = [...new Set(app.detectKigoEntries(poem).map((entry) => entry.season).filter(Boolean))];
    }
    return cache.kigoSeasons;
  };

  app.getMatchedTermsForPoem = function getMatchedTermsForPoem(poem) {
    const state = app.state;
    const cache = app.getPoemCache(poem);

    const exactTokenSet = new Set([
      ...cache.normalizedSearchTokens,
      ...cache.normalizedRawTokens
    ].filter(Boolean));

    const matched = [];

    state.termDictionary.forEach((term) => {
      const strictForms = term.__cache?.strictMatchForms || [];

      // 明示除外は最優先
      if (app.isTermExcludedByPoemManualTerms(poem, term)) {
        return;
      }

      const foundByStrict = strictForms.some((form) => exactTokenSet.has(form));
      const allowedByManual = app.isTermAllowedByPoemManualTerms(poem, term);

      // 明示許可があるものはそのまま通す
      if (allowedByManual) {
        matched.push(term);
        return;
      }

      // 通常一致しないものは不採用
      if (!foundByStrict) {
        return;
      }

      // 助詞・助動詞・短語・危険語リスト語は manual_terms がない限り不採用
      if (app.isStrictManualOnlyTerm(term)) {
        return;
      }

      matched.push(term);
    });

    const tokens = cache.normalizedSearchTokens;

    matched.sort((a, b) => {
      const aForms = (a.__cache?.strictMatchForms && a.__cache.strictMatchForms.length)
        ? a.__cache.strictMatchForms
        : (a.__cache?.normalizedForms || []);

      const bForms = (b.__cache?.strictMatchForms && b.__cache.strictMatchForms.length)
        ? b.__cache.strictMatchForms
        : (b.__cache?.normalizedForms || []);

      const aIndex = tokens.findIndex((t) => aForms.includes(t));
      const bIndex = tokens.findIndex((t) => bForms.includes(t));

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });

    return matched;
  };
})(window);
