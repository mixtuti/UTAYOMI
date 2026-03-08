const state = {
  poems: [],
  kigoDictionary: [],
  currentResults: [],
  currentPage: 1,
  resultsPerPage: 20,
  currentHighlightTerms: [],
};

const SKIP_NEXT_WORDS = new Set([
  "の", "に", "を", "は", "が", "と", "も", "へ", "や", "か",
  "ね", "よ", "ぞ", "なむ", "やは", "こそ",
  "て", "で", "し", "ば", "ど", "ども",
  "たり", "けり", "ぬ", "つ", "き", "けむ", "らむ", "なり"
]);

const TOKEN_SPLIT_PATTERNS = [
  "べらなり",
  "たまひて",
  "たまへば",
  "たまひ",
  "しらしめし",
  "しらしめす",
  "おもほしめせ",
  "おもほしけめ",
  "かむながら",
  "あらたへの",
  "たかてらす",
  "ももしきの",
  "うつせみの",
  "あをによし",
  "そらみつ",
  "やすみしし",
  "たまたすき",
  "かすみたつ",
  "しろたへの",
  "あきづしま",
  "あまざかる",
  "わたつみの",
  "ひむがしの",
  "ささなみの",
  "いはばしる",
  "しきたへの",
  "あしひきの",
  "ぬばたまの",
  "みよしのの",
  "やまとなる",
  "あをまつ",
  "あまの",
  "やまの",
  "かぜ",
  "つき",
  "よ",
  "ゆふ",
  "はる",
  "あき",
  "ふゆ",
  "なつ",
  "かぎろひ",
  "もみち",
  "あられ",
  "しも",
  "かすみ",
  "はりはら",
  "まつばら",
  "たび",
  "いも",
  "やま",
  "かは",
  "うら",
  "の",
  "に",
  "を",
  "は",
  "が",
  "と",
  "も",
  "へ",
  "や",
  "か",
  "ぞ",
  "なむ",
  "こそ",
  "て",
  "で",
  "し",
  "ぬ",
  "つ",
  "ば",
  "ど",
  "ね",
  "けり",
  "ける",
  "なり",
  "らむ",
  "けむ"
].sort((a, b) => b.length - a.length);

const elements = {
  randomPoem: document.getElementById("randomPoem"),
  shufflePoemButton: document.getElementById("shufflePoemButton"),

  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  collectionFilter: document.getElementById("collectionFilter"),
  themeFilter: document.getElementById("themeFilter"),
  seasonFilter: document.getElementById("seasonFilter"),
  authorFilter: document.getElementById("authorFilter"),
  kigoFilter: document.getElementById("kigoFilter"),
  kanaSearchToggle: document.getElementById("kanaSearchToggle"),
  clearSearchButton: document.getElementById("clearSearchButton"),

  searchResults: document.getElementById("searchResults"),
  searchSummary: document.getElementById("searchSummary"),
  activeFilters: document.getElementById("activeFilters"),
  pagination: document.getElementById("pagination"),

  ngramForm: document.getElementById("ngramForm"),
  ngramInput: document.getElementById("ngramInput"),
  ngramResults: document.getElementById("ngramResults"),

  highlightToggle: document.getElementById("highlightToggle"),
  verticalModeToggle: document.getElementById("verticalModeToggle"),

  poemCardTemplate: document.getElementById("poemCardTemplate"),
  tagButtons: document.querySelectorAll(".tag-button"),
};

async function loadData() {
  try {
    const poemFiles = [
      "./data/poems.json",
      "./data/poems1.json",
      "./data/poems2.json",
      "./data/poems3.json",
      "./data/poems4.json",
      "./data/poems5.json",
      "./data/poems6.json"
    ];

    const poemRequests = poemFiles.map(async (file) => {
      try {
        const res = await fetch(file);
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    });

    const [poemArrays, kigoResponse] = await Promise.all([
      Promise.all(poemRequests),
      fetch("./data/kigo.json")
    ]);

    if (!kigoResponse.ok) {
      throw new Error("季語データの読み込みに失敗しました");
    }

    state.poems = poemArrays.flat();
    state.kigoDictionary = await kigoResponse.json();

    initializePoemCaches();

    populateCollectionFilter();
    populateThemeFilterFromData();
    populateSeasonFilter();
    populateAuthorFilter();
    populateKigoFilter();

    renderRandomPoem();
    applyVerticalMode();
    renderInitialResults();
  } catch (error) {
    const message = escapeHtml(error.message || "不明なエラー");

    elements.randomPoem.innerHTML =
      `<div class="empty-state">読み込みエラー: ${message}</div>`;

    elements.searchResults.innerHTML =
      '<div class="empty-state">データを読み込めませんでした。</div>';

    elements.ngramResults.innerHTML =
      '<div class="empty-state">データを読み込めませんでした。</div>';

    if (elements.pagination) {
      elements.pagination.innerHTML = "";
    }
  }
}

/* -------------------------
   初期化 / キャッシュ
------------------------- */

function initializePoemCaches() {
  state.poems.forEach((poem) => {
    const rawTokens = Array.isArray(poem.tokens)
      ? poem.tokens.map((t) => String(t).trim()).filter(Boolean)
      : [];

    const searchTokens = Array.isArray(poem.search_tokens) && poem.search_tokens.length
      ? poem.search_tokens.map((t) => String(t).trim()).filter(Boolean)
      : expandTokens(rawTokens);

    poem.__cache = {
      normalizedText: normalizeText(poem.text || ""),
      normalizedKana: normalizeText(poem.kana || ""),
      normalizedAuthor: normalizeText(poem.author || ""),
      normalizedTheme: normalizeText(poem.theme || ""),
      normalizedSeason: normalizeText(poem.season || ""),
      normalizedKeywords: Array.isArray(poem.keywords)
        ? poem.keywords.map((w) => normalizeText(w)).filter(Boolean)
        : [],
      rawTokens,
      normalizedRawTokens: rawTokens.map((t) => normalizeText(t)).filter(Boolean),
      searchTokens,
      normalizedSearchTokens: searchTokens.map((t) => normalizeText(t)).filter(Boolean),
      joinedSearchTokens: searchTokens.map((t) => normalizeText(t)).join(""),
      kigoEntries: null,
      kigoWords: null,
      kigoSeasons: null,
    };
  });
}

function getPoemCache(poem) {
  if (!poem.__cache) {
    initializePoemCaches();
  }
  return poem.__cache;
}

function getSearchTokens(poem) {
  return getPoemCache(poem).searchTokens;
}

function getNormalizedSearchTokens(poem) {
  return getPoemCache(poem).normalizedSearchTokens;
}

function expandTokens(tokens) {
  return tokens.flatMap((token) => splitTokenForSearch(token));
}

function splitTokenForSearch(token) {
  const original = String(token || "").trim();
  if (!original) return [];

  let working = normalizeText(original);
  if (!working) return [];

  TOKEN_SPLIT_PATTERNS.forEach((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    if (!normalizedPattern) return;

    const regex = new RegExp(escapeRegExp(normalizedPattern), "g");
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
}

/* -------------------------
   初期化系
------------------------- */

function populateCollectionFilter() {
  const collections = [
    ...new Set(state.poems.map((poem) => poem.collection).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  const countMap = buildCountMap(state.poems.map((poem) => poem.collection));
  appendOptions(elements.collectionFilter, collections, countMap);
}

function populateThemeFilterFromData() {
  if (!elements.themeFilter) return;

  const currentValue = elements.themeFilter.value;
  elements.themeFilter.innerHTML = '<option value="">すべて</option>';

  const themes = [
    ...new Set(state.poems.map((poem) => poem.theme).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  const countMap = buildCountMap(state.poems.map((poem) => poem.theme));
  appendOptions(elements.themeFilter, themes, countMap);

  if (themes.includes(currentValue)) {
    elements.themeFilter.value = currentValue;
  }
}

function populateSeasonFilter() {
  if (!elements.seasonFilter) return;

  const currentValue = elements.seasonFilter.value;
  elements.seasonFilter.innerHTML = '<option value="">すべて</option>';

  const seasonOrder = ["春", "夏", "秋", "冬"];
  const seasonsInData = [
    ...new Set(state.poems.map((poem) => poem.season).filter(Boolean)),
  ];

  const seasons = [
    ...seasonOrder.filter((s) => seasonsInData.includes(s)),
    ...seasonsInData
      .filter((s) => !seasonOrder.includes(s))
      .sort((a, b) => a.localeCompare(b, "ja")),
  ];

  const countMap = buildCountMap(state.poems.map((poem) => poem.season));
  appendOptions(elements.seasonFilter, seasons, countMap);

  if (seasons.includes(currentValue)) {
    elements.seasonFilter.value = currentValue;
  }
}

function populateAuthorFilter() {
  const authors = [
    ...new Set(state.poems.map((poem) => poem.author).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  const countMap = buildCountMap(state.poems.map((poem) => poem.author));
  appendOptions(elements.authorFilter, authors, countMap);
}

function populateKigoFilter() {
  const kigoList = [
    ...new Set(state.kigoDictionary.map((entry) => entry.word).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  const countMap = new Map();

  state.poems.forEach((poem) => {
    detectKigoWords(poem).forEach((word) => {
      countMap.set(word, (countMap.get(word) || 0) + 1);
    });
  });

  appendOptions(elements.kigoFilter, kigoList, countMap);
}

function buildCountMap(items) {
  const map = new Map();

  items.forEach((value) => {
    if (!value) return;
    map.set(value, (map.get(value) || 0) + 1);
  });

  return map;
}

function appendOptions(selectElement, values, countMap = null) {
  if (!selectElement) return;

  const fragment = document.createDocumentFragment();

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;

    const count = countMap?.get(value) ?? null;
    option.textContent = count !== null ? `${value} (${count})` : value;

    fragment.appendChild(option);
  });

  selectElement.appendChild(fragment);
}
/* -------------------------
   季語自動判定
------------------------- */

function detectKigoEntries(poem) {
  const cache = getPoemCache(poem);
  if (cache.kigoEntries) return cache.kigoEntries;

  const tokenSet = new Set(cache.normalizedSearchTokens);

  const sortedDictionary = [...state.kigoDictionary].sort(
    (a, b) => String(b.word || "").length - String(a.word || "").length
  );

  const matched = sortedDictionary.filter((entry) => {
    const word = normalizeText(entry.word || "");
    if (!word) return false;

    const matchedByToken = tokenSet.size > 0 && tokenSet.has(word);
    const matchedByText = !matchedByToken && cache.normalizedText.includes(word);

    return matchedByToken || matchedByText;
  });

  cache.kigoEntries = uniqueBy(matched, (entry) => `${entry.word}__${entry.season || ""}`);
  return cache.kigoEntries;
}

function detectKigoWords(poem) {
  const cache = getPoemCache(poem);
  if (!cache.kigoWords) {
    cache.kigoWords = [...new Set(detectKigoEntries(poem).map((entry) => entry.word).filter(Boolean))];
  }
  return cache.kigoWords;
}

function detectKigoSeasons(poem) {
  const cache = getPoemCache(poem);
  if (!cache.kigoSeasons) {
    cache.kigoSeasons = [...new Set(detectKigoEntries(poem).map((entry) => entry.season).filter(Boolean))];
  }
  return cache.kigoSeasons;
}

/* -------------------------
   表示系
------------------------- */

function renderRandomPoem() {
  if (!state.poems.length) return;

  const poem = state.poems[Math.floor(Math.random() * state.poems.length)];
  elements.randomPoem.innerHTML = "";
  elements.randomPoem.appendChild(createPoemCard(poem));
  applyVerticalMode();
}

function renderInitialResults() {
  const firstPoems = state.poems.slice(0, 6);
  state.currentPage = 1;
  state.currentResults = firstPoems;
  state.currentHighlightTerms = [];
  renderSearchResults(firstPoems, "サンプルとして先頭6首を表示しています。");
}

function createPoemCard(poem, options = {}) {
  const { highlightTerms = [], useHighlight = false } = options;

  const fragment = elements.poemCardTemplate.content.cloneNode(true);

  const article = fragment.querySelector(".poem-card");
  const meta = fragment.querySelector(".poem-meta");
  const text = fragment.querySelector(".poem-text");
  const kana = fragment.querySelector(".poem-kana");
  const tags = fragment.querySelector(".poem-tags");

  const metaParts = [
    poem.collection,
    poem.book,
    poem.poem_no ? `歌番号 ${poem.poem_no}` : "",
    poem.author,
  ].filter(Boolean);

  meta.textContent = metaParts.join(" ｜ ");

  text.innerHTML =
    useHighlight && highlightTerms.length
      ? highlightMultipleTerms(poem.text || "", highlightTerms)
      : escapeHtml(poem.text || "");

  if (poem.kana) {
    const kanaHighlightTerms = buildKanaHighlightTerms(highlightTerms);

    kana.innerHTML =
      useHighlight && kanaHighlightTerms.length
        ? highlightMultipleTerms(poem.kana || "", kanaHighlightTerms)
        : escapeHtml(poem.kana || "");
  } else {
    kana.remove();
  }

  renderPoemTags(tags, poem);

  article.dataset.id = poem.id || "";
  return article;
}

function renderPoemTags(container, poem) {
  if (!container) return;

  const tagItems = [];

  if (poem.theme) tagItems.push(poem.theme);
  if (poem.season) tagItems.push(poem.season);
  if (poem.author) tagItems.push(poem.author);

  const detectedSeasons = poem.season ? [] : detectKigoSeasons(poem);
  const detectedKigo = detectKigoWords(poem);

  detectedSeasons.forEach((season) => tagItems.push(season));
  detectedKigo.slice(0, 5).forEach((kigo) => tagItems.push(kigo));

  if (!tagItems.length) {
    container.innerHTML = "";
    return;
  }

  const uniqueTags = [...new Set(tagItems)];
  const fragment = document.createDocumentFragment();

  uniqueTags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "badge";
    span.textContent = tag;
    fragment.appendChild(span);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

function renderSearchResults(results, summaryText, highlightTerms = []) {
  state.currentResults = results;
  state.currentHighlightTerms = highlightTerms;
  elements.searchSummary.textContent = summaryText;
  renderActiveFilters();
  renderCurrentPage();
}

function renderCurrentPage() {
  const results = state.currentResults || [];
  const perPage = state.resultsPerPage || 20;
  const totalPages = Math.max(1, Math.ceil(results.length / perPage));

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
  }

  if (!results.length) {
    elements.searchResults.innerHTML =
      '<div class="empty-state">該当する歌が見つかりませんでした。</div>';
    if (elements.pagination) elements.pagination.innerHTML = "";
    applyVerticalMode();
    return;
  }

  const start = (state.currentPage - 1) * perPage;
  const end = start + perPage;
  const pageItems = results.slice(start, end);
  const useHighlight = !!elements.highlightToggle?.checked;

  elements.searchResults.innerHTML = "";
  const fragment = document.createDocumentFragment();

  pageItems.forEach((poem) => {
    fragment.appendChild(
      createPoemCard(poem, {
        highlightTerms: state.currentHighlightTerms,
        useHighlight,
      })
    );
  });

  elements.searchResults.appendChild(fragment);
  renderPagination();
  applyVerticalMode();
}

function renderPagination() {
  if (!elements.pagination) return;

  const results = state.currentResults || [];
  const perPage = state.resultsPerPage || 20;
  const totalPages = Math.ceil(results.length / perPage);

  elements.pagination.innerHTML = "";

  if (totalPages <= 1) return;

  const fragment = document.createDocumentFragment();

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "button secondary";
  prevButton.textContent = "前へ";
  prevButton.disabled = state.currentPage <= 1;
  prevButton.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      renderCurrentPage();
      scrollResultsIntoView();
    }
  });
  fragment.appendChild(prevButton);

  const maxVisible = 7;
  const pageNumbers = buildVisiblePageNumbers(state.currentPage, totalPages, maxVisible);

  pageNumbers.forEach((pageNum) => {
    if (pageNum === "...") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.textContent = "...";
      fragment.appendChild(ellipsis);
      return;
    }

    const pageButton = document.createElement("button");
    pageButton.type = "button";
    pageButton.className = pageNum === state.currentPage ? "button" : "button secondary";
    pageButton.textContent = String(pageNum);
    pageButton.disabled = pageNum === state.currentPage;
    pageButton.addEventListener("click", () => {
      state.currentPage = pageNum;
      renderCurrentPage();
      scrollResultsIntoView();
    });
    fragment.appendChild(pageButton);
  });

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "button secondary";
  nextButton.textContent = "次へ";
  nextButton.disabled = state.currentPage >= totalPages;
  nextButton.addEventListener("click", () => {
    if (state.currentPage < totalPages) {
      state.currentPage += 1;
      renderCurrentPage();
      scrollResultsIntoView();
    }
  });
  fragment.appendChild(nextButton);

  const pageInfo = document.createElement("span");
  pageInfo.className = "pagination-info";
  const start = (state.currentPage - 1) * perPage + 1;
  const end = Math.min(state.currentPage * perPage, results.length);
  pageInfo.textContent = `${start}-${end} / ${results.length}件`;
  fragment.appendChild(pageInfo);

  elements.pagination.appendChild(fragment);
}

function buildVisiblePageNumbers(currentPage, totalPages, maxVisible = 7) {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [1];
  const innerVisible = maxVisible - 2;
  let start = Math.max(2, currentPage - Math.floor(innerVisible / 2));
  let end = Math.min(totalPages - 1, start + innerVisible - 1);

  if (end >= totalPages - 1) {
    end = totalPages - 1;
    start = end - innerVisible + 1;
  }

  if (start > 2) {
    pages.push("...");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    pages.push("...");
  }

  pages.push(totalPages);
  return pages;
}

function scrollResultsIntoView() {
  elements.searchResults?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderActiveFilters() {
  if (!elements.activeFilters) return;

  const chips = [];

  const query = elements.searchInput.value.trim();
  const collection = elements.collectionFilter.value || "";
  const theme = elements.themeFilter?.value || "";
  const season = elements.seasonFilter?.value || "";
  const author = elements.authorFilter?.value || "";
  const kigo = elements.kigoFilter?.value || "";
  const includeKana = elements.kanaSearchToggle?.checked;

  if (query) chips.push(`語句: ${query}`);
  if (collection) chips.push(`出典: ${collection}`);
  if (theme) chips.push(`部立: ${theme}`);
  if (season) chips.push(`季節: ${season}`);
  if (author) chips.push(`詠み人: ${author}`);
  if (kigo) chips.push(`季語: ${kigo}`);
  if (includeKana) chips.push("かな検索あり");

  if (!chips.length) {
    elements.activeFilters.innerHTML = "";
    return;
  }

  const fragment = document.createDocumentFragment();

  chips.forEach((chipText) => {
    const span = document.createElement("span");
    span.className = "filter-chip";
    span.textContent = chipText;
    fragment.appendChild(span);
  });

  elements.activeFilters.innerHTML = "";
  elements.activeFilters.appendChild(fragment);
}

/* -------------------------
   検索
------------------------- */

function handleSearch(event) {
  if (event) event.preventDefault();

  const rawQuery = elements.searchInput.value.trim();
  const queryTerms = parseMultipleTerms(rawQuery);

  const selectedCollection = elements.collectionFilter.value;
  const selectedTheme = elements.themeFilter?.value || "";
  const selectedSeason = elements.seasonFilter?.value || "";
  const selectedAuthor = elements.authorFilter?.value || "";
  const selectedKigo = elements.kigoFilter?.value || "";
  const includeKana = elements.kanaSearchToggle.checked;

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
    results = results.filter((poem) =>
      detectKigoWords(poem).includes(selectedKigo)
    );
  }

  if (queryTerms.length) {
    results = results.filter((poem) =>
      matchesAllTerms(poem, queryTerms, includeKana)
    );
  }

  const summaryParts = [`検索結果 ${results.length} 件`];
  if (selectedCollection) summaryParts.push(`出典: ${selectedCollection}`);
  if (selectedTheme) summaryParts.push(`部立: ${selectedTheme}`);
  if (selectedSeason) summaryParts.push(`季節: ${selectedSeason}`);
  if (selectedAuthor) summaryParts.push(`詠み人: ${selectedAuthor}`);
  if (selectedKigo) summaryParts.push(`季語: ${selectedKigo}`);
  if (queryTerms.length) summaryParts.push(`語句: 「${queryTerms.join(" / ")}」`);

  state.currentPage = 1;
  renderSearchResults(results, summaryParts.join(" ｜ "), queryTerms);
}

function matchesAllTerms(poem, queryTerms, includeKana) {
  return queryTerms.every((term) => poemMatchesTerm(poem, term, includeKana));
}

function poemMatchesTerm(poem, term, includeKana) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return true;

  const cache = getPoemCache(poem);

  const inText = cache.normalizedText.includes(normalizedTerm);

  const inKana =
    includeKana && cache.normalizedKana.includes(normalizedTerm);

  const inTheme = cache.normalizedTheme.includes(normalizedTerm);
  const inSeasonField = cache.normalizedSeason.includes(normalizedTerm);

  const inKigo = detectKigoWords(poem).some((word) =>
    normalizeText(word).includes(normalizedTerm)
  );

  const inSeason = detectKigoSeasons(poem).some((season) =>
    normalizeText(season).includes(normalizedTerm)
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
}

function handleClearSearch() {
  elements.searchInput.value = "";
  elements.collectionFilter.value = "";
  if (elements.themeFilter) elements.themeFilter.value = "";
  if (elements.seasonFilter) elements.seasonFilter.value = "";
  if (elements.authorFilter) elements.authorFilter.value = "";
  if (elements.kigoFilter) elements.kigoFilter.value = "";
  elements.kanaSearchToggle.checked = false;

  state.currentPage = 1;
  renderInitialResults();
}

/* -------------------------
   後続語検索
------------------------- */

function handleNgramSearch(event) {
  event.preventDefault();

  const rawKey = elements.ngramInput.value.trim();

  if (!rawKey) {
    elements.ngramResults.innerHTML =
      '<div class="empty-state">語を入力してください。</div>';
    return;
  }

  elements.searchInput.value = rawKey;
  elements.kanaSearchToggle.checked = true;
  handleSearch();

  const rows = searchNextWordsForPhrase(rawKey);

  if (!rows.length) {
    elements.ngramResults.innerHTML = `<div class="empty-state">「${escapeHtml(
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
}

function searchNextWordsForPhrase(rawKey) {
  const normalizedKey = normalizePhraseKey(rawKey);
  const resultMap = {};

  if (!normalizedKey) return [];

  state.poems.forEach((poem) => {
    const tokens = getSearchTokens(poem);
    if (!tokens.length) return;

    const matches = findPhraseMatchesInTokens(tokens, normalizedKey);

    matches.forEach(({ end }) => {
      const nextWord = findNextContentWord(tokens, end + 1);
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
}

function findPhraseMatchesInTokens(tokens, normalizedKey) {
  const matches = [];

  for (let start = 0; start < tokens.length; start++) {
    let phrase = "";

    for (let end = start; end < tokens.length; end++) {
      phrase += String(tokens[end] || "").trim();
      const normalizedPhrase = normalizePhraseKey(phrase);

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
}

function findNextContentWord(tokens, startIndex) {
  for (let i = startIndex; i < tokens.length; i++) {
    const token = String(tokens[i] || "").trim();
    if (token && !SKIP_NEXT_WORDS.has(normalizeText(token))) {
      return token;
    }
  }
  return null;
}

/* -------------------------
   UI操作
------------------------- */

function handleTagButtonClick(event) {
  const button = event.currentTarget;
  const keyword = button.dataset.keyword;
  const theme = button.dataset.theme;
  const season = button.dataset.season;
  const author = button.dataset.author;
  const kigo = button.dataset.kigo;
  const syncNgram = button.dataset.syncNgram === "true";

  if (keyword) {
    elements.searchInput.value = keyword;
  }

  if (theme && elements.themeFilter) {
    elements.themeFilter.value = theme;
  }

  if (season && elements.seasonFilter) {
    elements.seasonFilter.value = season;
  }

  if (author && elements.authorFilter) {
    elements.authorFilter.value = author;
  }

  if (kigo && elements.kigoFilter) {
    elements.kigoFilter.value = kigo;
  }

  if (syncNgram && elements.ngramInput) {
    elements.ngramInput.value = keyword || kigo || "";
  }

  handleSearch();
}

function handleHighlightToggle() {
  renderCurrentPage();
}

function applyVerticalMode() {
  const isVertical = !!elements.verticalModeToggle?.checked;

  elements.searchResults.classList.toggle("vertical-mode", isVertical);
  elements.randomPoem.classList.toggle("vertical-mode", isVertical);
}

function handleVerticalModeToggle() {
  applyVerticalMode();
}

/* -------------------------
   文字処理
------------------------- */

function parseMultipleTerms(query) {
  return String(query)
    .split(/[\s\u3000,、]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizePhraseKey(text) {
  return String(text)
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "");
}

function normalizeText(text) {
  return String(text)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function katakanaToHiragana(text) {
  return String(text).replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function buildKanaHighlightTerms(terms) {
  const result = new Set();

  terms.forEach((term) => {
    const raw = String(term || "").trim();
    if (!raw) return;

    result.add(raw);

    const hira = katakanaToHiragana(raw);
    if (hira) result.add(hira);
  });

  return [...result];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueBy(array, getKey) {
  const seen = new Set();
  return array.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* -------------------------
   ハイライト
------------------------- */

function highlightMultipleTerms(text, terms) {
  let html = escapeHtml(text);

  const sortedTerms = [...new Set(terms.map(String).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );

  sortedTerms.forEach((term) => {
    const escapedTerm = escapeHtml(term);
    const pattern = new RegExp(`(${escapeRegExp(escapedTerm)})`, "gi");
    html = html.replace(pattern, "<mark>$1</mark>");
  });

  return html;
}

/* -------------------------
   イベント
------------------------- */

elements.shufflePoemButton?.addEventListener("click", renderRandomPoem);
elements.searchForm?.addEventListener("submit", handleSearch);
elements.clearSearchButton?.addEventListener("click", handleClearSearch);
elements.ngramForm?.addEventListener("submit", handleNgramSearch);
elements.highlightToggle?.addEventListener("change", handleHighlightToggle);
elements.verticalModeToggle?.addEventListener("change", handleVerticalModeToggle);

elements.tagButtons?.forEach((button) => {
  button.addEventListener("click", handleTagButtonClick);
});

loadData();