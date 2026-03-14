// 通常検索・後続語検索
(function (global) {
  const app = global.WakaApp;

  app.handleSearch = function handleSearch(event) {
    const state = app.state;
    const elements = app.elements;

    if (event) event.preventDefault();

    const rawQuery = elements.searchInput.value.trim();
    const queryTerms = app.parseMultipleTerms(rawQuery);

    const selectedCollection = elements.collectionFilter.value;
    const selectedTheme = elements.themeFilter?.value || "";
    const selectedSeason = elements.seasonFilter?.value || "";
    const selectedAuthor = elements.authorFilter?.value || "";
    const selectedKigo = elements.kigoFilter?.value || "";
    const includeKana = !!elements.kanaSearchToggle.checked;

    let results = [...state.poems];

    if (selectedCollection) {
      results = results.filter((poem) => poem.collection === selectedCollection);
    }
    if (selectedTheme) {
      results = results.filter((poem) => poem.theme === selectedTheme);
    }
    if (selectedSeason) {
      results = results.filter((poem) => poem.season === selectedSeason);
    }
    if (selectedAuthor) {
      results = results.filter((poem) => poem.author === selectedAuthor);
    }
    if (selectedKigo) {
      results = results.filter((poem) => app.detectKigoWords(poem).includes(selectedKigo));
    }
    if (queryTerms.length) {
      results = results.filter((poem) => app.matchesAllTerms(poem, queryTerms, includeKana));
    }

    const summaryParts = [`検索結果 ${results.length} 件`];
    if (selectedCollection) summaryParts.push(`出典: ${selectedCollection}`);
    if (selectedTheme) summaryParts.push(`部立: ${selectedTheme}`);
    if (selectedSeason) summaryParts.push(`季節: ${selectedSeason}`);
    if (selectedAuthor) summaryParts.push(`詠み人: ${selectedAuthor}`);
    if (selectedKigo) summaryParts.push(`季語: ${selectedKigo}`);
    if (queryTerms.length) summaryParts.push(`語句: 「${queryTerms.join(" / ")}」`);

    state.currentPage = 1;
    app.renderSearchResults(results, summaryParts.join(" ｜ "), queryTerms);
  };

  app.matchesAllTerms = function matchesAllTerms(poem, queryTerms, includeKana) {
    return queryTerms.every((term) => app.poemMatchesTerm(poem, term, includeKana));
  };

  app.poemMatchesTerm = function poemMatchesTerm(poem, term, includeKana) {
    const normalizedTerm = app.normalizeText(term);
    if (!normalizedTerm) return true;

    const cache = app.getPoemCache(poem);

    const inText = cache.normalizedText.includes(normalizedTerm);
    const inKana = includeKana && cache.normalizedKana.includes(normalizedTerm);
    const inTheme = cache.normalizedTheme.includes(normalizedTerm);
    const inSeasonField = cache.normalizedSeason.includes(normalizedTerm);

    const inKigo = app.detectKigoWords(poem).some((word) =>
      app.normalizeText(word).includes(normalizedTerm)
    );

    const inSeason = app.detectKigoSeasons(poem).some((season) =>
      app.normalizeText(season).includes(normalizedTerm)
    );

    const inAuthor = cache.normalizedAuthor.includes(normalizedTerm);

    const inKeywords = cache.normalizedKeywords.some((word) =>
      word.includes(normalizedTerm)
    );

    const inRawTokens = cache.normalizedRawTokens.some((word) =>
      word.includes(normalizedTerm)
    );

    const inSearchTokens =
      cache.normalizedSearchTokens.some((word) => word.includes(normalizedTerm)) ||
      cache.joinedSearchTokens.includes(normalizedTerm);

    return (
      inText ||
      inKana ||
      inTheme ||
      inSeasonField ||
      inKigo ||
      inSeason ||
      inAuthor ||
      inKeywords ||
      inRawTokens ||
      inSearchTokens
    );
  };

  app.handleClearSearch = function handleClearSearch() {
    const state = app.state;
    const elements = app.elements;

    elements.searchInput.value = "";
    elements.collectionFilter.value = "";
    if (elements.themeFilter) elements.themeFilter.value = "";
    if (elements.seasonFilter) elements.seasonFilter.value = "";
    if (elements.authorFilter) elements.authorFilter.value = "";
    if (elements.kigoFilter) elements.kigoFilter.value = "";
    elements.kanaSearchToggle.checked = false;

    state.currentPage = 1;
    app.renderInitialResults();
  };

  app.handleNgramSearch = function handleNgramSearch(event) {
    const elements = app.elements;
    event.preventDefault();

    const rawKey = elements.ngramInput.value.trim();

    if (!rawKey) {
      elements.ngramResults.innerHTML =
        '<div class="empty-state">語を入力してください。</div>';
      return;
    }

    elements.searchInput.value = rawKey;
    elements.kanaSearchToggle.checked = true;
    app.handleSearch();

    const rows = app.searchNextWordsForPhrase(rawKey);

    if (!rows.length) {
      elements.ngramResults.innerHTML = `<div class="empty-state">「${app.escapeHtml(
        rawKey
      )}」に続く語は見つかりませんでした。</div>`;
      return;
    }

    const list = document.createElement("ol");
    list.className = "ngram-list";

    rows.forEach((row) => {
      const item = document.createElement("li");
      item.className = "ngram-item";

      const left = document.createElement("div");

      const word = document.createElement("span");
      word.textContent = row.word;
      left.appendChild(word);

      if (Array.isArray(row.examples) && row.examples.length) {
        const examples = document.createElement("div");
        examples.className = "muted";
        examples.style.fontSize = "0.9rem";
        examples.style.marginTop = "4px";
        examples.textContent = row.examples
          .map((ex) => [ex.collection, ex.author].filter(Boolean).join(" / "))
          .filter(Boolean)
          .join(" ｜ ");
        left.appendChild(examples);
      }

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = String(row.count);

      item.appendChild(left);
      item.appendChild(badge);
      list.appendChild(item);
    });

    elements.ngramResults.innerHTML = "";

    const heading = document.createElement("p");
    heading.className = "muted";
    heading.textContent = `「${rawKey}」の後に来やすい語（助詞などを除く）`;

    elements.ngramResults.appendChild(heading);
    elements.ngramResults.appendChild(list);
  };

  app.searchNextWordsForPhrase = function searchNextWordsForPhrase(rawKey) {
    const state = app.state;
    const normalizedKey = app.normalizePhraseKey(rawKey);
    const resultMap = {};

    if (!normalizedKey) return [];

    state.poems.forEach((poem) => {
      const tokens = app.getSearchTokens(poem);
      if (!tokens.length) return;

      const matches = app.findPhraseMatchesInTokens(tokens, normalizedKey);

      matches.forEach(({ end }) => {
        const nextWord = app.findNextContentWord(tokens, end + 1);
        if (!nextWord) return;

        if (!resultMap[nextWord]) {
          resultMap[nextWord] = {
            word: nextWord,
            count: 0,
            examples: [],
          };
        }

        resultMap[nextWord].count += 1;

        if (resultMap[nextWord].examples.length < 3) {
          resultMap[nextWord].examples.push({
            id: poem.id,
            collection: poem.collection || "",
            author: poem.author || "",
            text: poem.text || "",
          });
        }
      });
    });

    return Object.values(resultMap).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.word.localeCompare(b.word, "ja");
    });
  };

  app.findPhraseMatchesInTokens = function findPhraseMatchesInTokens(tokens, normalizedKey) {
    const matches = [];

    for (let start = 0; start < tokens.length; start++) {
      let phrase = "";

      for (let end = start; end < tokens.length; end++) {
        phrase += String(tokens[end] || "").trim();
        const normalizedPhrase = app.normalizePhraseKey(phrase);

        if (normalizedPhrase === normalizedKey) {
          matches.push({ start, end });
          break;
        }

        if (normalizedPhrase.length >= normalizedKey.length) {
          break;
        }
      }
    }

    return matches;
  };

  app.findNextContentWord = function findNextContentWord(tokens, startIndex) {
    for (let i = startIndex; i < tokens.length; i++) {
      const token = String(tokens[i] || "").trim();
      if (token && !app.constants.SKIP_NEXT_WORDS.has(app.normalizeText(token))) {
        return token;
      }
    }
    return null;
  };
})(window);
