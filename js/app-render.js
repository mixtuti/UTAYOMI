// 一覧表示・カード・ページング
(function (global) {
  const app = global.WakaApp;

  app.renderRandomPoem = function renderRandomPoem() {
    const state = app.state;
    const elements = app.elements;
    if (!state.poems.length) return;

    const poem = state.poems[Math.floor(Math.random() * state.poems.length)];
    elements.randomPoem.innerHTML = "";
    elements.randomPoem.appendChild(app.createPoemCard(poem));
    app.applyVerticalMode();
  };

  app.renderInitialResults = function renderInitialResults() {
    const state = app.state;
    const firstPoems = state.poems.slice(0, 6);
    state.currentPage = 1;
    state.currentResults = firstPoems;
    state.currentHighlightTerms = [];
    app.renderSearchResults(firstPoems, "サンプルとして先頭6首を表示しています。");
  };

  app.createPoemCard = function createPoemCard(poem, options = {}) {
    const elements = app.elements;
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
        ? app.highlightMultipleTerms(poem.text || "", highlightTerms)
        : app.escapeHtml(poem.text || "");

    if (poem.kana) {
      const kanaHighlightTerms = app.buildKanaHighlightTerms(highlightTerms);

      kana.innerHTML =
        useHighlight && kanaHighlightTerms.length
          ? app.highlightMultipleTerms(poem.kana || "", kanaHighlightTerms)
          : app.escapeHtml(poem.kana || "");
    } else {
      kana.remove();
    }

    app.renderPoemTags(tags, poem);

    article.dataset.id = poem.id || "";
    article.tabIndex = 0;
    article.style.cursor = "pointer";

    article.addEventListener("click", () => app.openPoemDetail(poem));
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        app.openPoemDetail(poem);
      }
    });

    return article;
  };

  app.renderPoemTags = function renderPoemTags(container, poem) {
    if (!container) return;

    const tagItems = [];

    if (poem.theme) tagItems.push(poem.theme);
    if (poem.season) tagItems.push(poem.season);
    if (poem.author) tagItems.push(poem.author);

    const detectedSeasons = poem.season ? [] : app.detectKigoSeasons(poem);
    const detectedKigo = app.detectKigoWords(poem);

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
  };

  app.renderSearchResults = function renderSearchResults(results, summaryText, highlightTerms = []) {
    const state = app.state;
    const elements = app.elements;

    state.currentResults = results;
    state.currentHighlightTerms = highlightTerms;
    elements.searchSummary.textContent = summaryText;
    app.renderActiveFilters();
    app.renderCurrentPage();
  };

  app.renderCurrentPage = function renderCurrentPage() {
    const state = app.state;
    const elements = app.elements;

    const results = state.currentResults || [];
    const perPage = state.resultsPerPage || 20;
    const totalPages = Math.max(1, Math.ceil(results.length / perPage));

    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    if (!results.length) {
      elements.searchResults.innerHTML =
        '<div class="empty-state">該当する歌が見つかりませんでした。</div>';
      if (elements.pagination) elements.pagination.innerHTML = "";
      app.applyVerticalMode();
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
        app.createPoemCard(poem, {
          highlightTerms: state.currentHighlightTerms,
          useHighlight,
        })
      );
    });

    elements.searchResults.appendChild(fragment);
    app.renderPagination();
    app.applyVerticalMode();
  };

  app.renderPagination = function renderPagination() {
    const state = app.state;
    const elements = app.elements;
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
        app.renderCurrentPage();
        app.scrollResultsIntoView();
      }
    });
    fragment.appendChild(prevButton);

    const pageNumbers = app.buildVisiblePageNumbers(state.currentPage, totalPages, 7);

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
        app.renderCurrentPage();
        app.scrollResultsIntoView();
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
        app.renderCurrentPage();
        app.scrollResultsIntoView();
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
  };

  app.buildVisiblePageNumbers = function buildVisiblePageNumbers(currentPage, totalPages, maxVisible = 7) {
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

    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);

    return pages;
  };

  app.scrollResultsIntoView = function scrollResultsIntoView() {
    app.elements.searchResults?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  app.renderActiveFilters = function renderActiveFilters() {
    const elements = app.elements;
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
  };
})(window);
