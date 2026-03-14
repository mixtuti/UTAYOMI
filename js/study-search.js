// 用例検索・検索実行
(function (global) {
  const study = global.WakaStudy;

  study.poemMatchesAnyTerm = function poemMatchesAnyTerm(poem, terms, entries = []) {
    const normalizedTerms = (Array.isArray(terms) ? terms : [])
      .map((term) => study.normalizeText(term))
      .filter(Boolean);

    const entryWords = (Array.isArray(entries) ? entries : [])
      .map((entry) => study.normalizeText(entry?.word || ""))
      .filter(Boolean);

    // 1) manual_terms を優先
    const manualAllowedWords = new Set(
      (Array.isArray(poem.manual_terms) ? poem.manual_terms : [])
        .map((item) => (typeof item === "string" ? item : item?.word))
        .map((v) => study.normalizeText(v))
        .filter(Boolean)
    );

    if (entryWords.some((word) => manualAllowedWords.has(word))) {
      return true;
    }

    // 2) search_tokens
    const tokenSet = new Set(
      (Array.isArray(poem.search_tokens) ? poem.search_tokens : [])
        .map((token) => study.normalizeText(token))
        .filter(Boolean)
    );

    if (normalizedTerms.some((term) => tokenSet.has(term))) {
      return true;
    }

    // 3) app 側キャッシュ
    if (global.WakaApp?.getPoemCache) {
      const cache = global.WakaApp.getPoemCache(poem);

      if (
        Array.isArray(cache?.normalizedSearchTokens) &&
        normalizedTerms.some((term) => cache.normalizedSearchTokens.includes(term))
      ) {
        return true;
      }

      if (
        typeof cache?.normalizedText === "string" &&
        normalizedTerms.some((term) => cache.normalizedText.includes(term))
      ) {
        return true;
      }

      if (
        typeof cache?.normalizedKana === "string" &&
        normalizedTerms.some((term) => cache.normalizedKana.includes(term))
      ) {
        return true;
      }
    }

    // 4) 最後の保険
    const normalizedText = study.normalizeText(poem.text || "");
    const normalizedKana = study.normalizeText(poem.kana || "");

    return normalizedTerms.some((term) =>
      normalizedText.includes(term) || normalizedKana.includes(term)
    );
  };

  study.findExamples = function findExamples(word, entries = []) {
    const poems = study.getPoems();
    if (!poems.length) return [];

    const terms =
      Array.isArray(entries) && entries.length
        ? study.uniqueStrings([
          ...entries.flatMap((entry) => study.getEntryLookupKeys(entry)),
          ...entries.flatMap((entry) => study.getEntrySearchKeys(entry)),
          ...study.getEntriesSearchKeys(entries),
        ])
        : [word];

    if (!terms.length) {
      return [];
    }

    return poems.filter((poem) => study.poemMatchesAnyTerm(poem, terms, entries));
  };

  study.findPoemsByIds = function findPoemsByIds(entries) {
    const poems = study.getPoems();
    if (!poems.length) return [];

    const ids = entries.flatMap((entry) =>
      Array.isArray(entry.poem_ids) ? entry.poem_ids : []
    );

    if (!ids.length) return [];
    return poems.filter((poem) => ids.includes(poem.id));
  };

  study.search = function search(rawWord) {
    const els = study.elements;
    const word = String(rawWord || "").trim();
    if (!word) return;

    const poems = study.getPoems();
    if (!poems.length) {
      els.result.innerHTML =
        "<div class='empty-state'>和歌データの読み込み待ちです。少し待ってからもう一度お試しください。</div>";
      els.examples.innerHTML = "";
      study.updateMoreButton(0);

      if (els.related) {
        els.related.innerHTML =
          "<div class='empty-state'>和歌データ未読み込み</div>";
      }

      if (els.summary) {
        els.summary.textContent = "和歌データ未読み込み";
      }
      return;
    }

    const entries = study.findDictionaryEntries(word);

    if (entries.length) {
      study.renderMeanings(entries);
    } else {
      study.renderNoMeaning(word);
    }

    const searchTerms = entries.length
      ? study.uniqueStrings(entries.flatMap((entry) => study.getEntryLookupKeys(entry)))
      : [word];

    const examples = study.findExamples(word, entries);
    const fixedPoems = study.findPoemsByIds(entries);

    study.renderExamples([...fixedPoems, ...examples], searchTerms);

    if (els.summary) {
      if (entries.length && entries.length > 1) {
        if (examples.length) {
          els.summary.textContent =
            `「${word}」に一致する辞書項目 ${entries.length} 件・用例 ${examples.length} 件`;
        } else {
          els.summary.textContent =
            `「${word}」に一致する辞書項目 ${entries.length} 件`;
        }
      } else if (examples.length) {
        els.summary.textContent = `「${word}」の用例 ${examples.length} 件`;
      } else {
        els.summary.textContent = `「${word}」の用例は見つかりませんでした`;
      }
    }
  };
})(window);
