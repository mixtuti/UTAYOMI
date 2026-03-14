// 詳細モーダル・UI操作・イベント
(function (global) {
  const app = global.WakaApp;

  app.openPoemDetail = function openPoemDetail(poem) {
    const elements = app.elements;
    if (!elements.poemDetailModal) return;

    elements.poemDetailModal.classList.remove("hidden");

    const title = poem.title || poem.collection || poem.source || "和歌詳細";
    if (elements.detailTitle) {
      elements.detailTitle.textContent = title;
    }

    if (elements.detailMetaLine) {
      const metaParts = [
        poem.collection || poem.source || "",
        poem.book || "",
        poem.poem_no ? `歌番号 ${poem.poem_no}` : (poem.number ? `歌番号 ${poem.number}` : ""),
        poem.author || ""
      ].filter(Boolean);

      elements.detailMetaLine.textContent = metaParts.join(" ｜ ");
    }

    if (elements.detailPoemText) {
      elements.detailPoemText.textContent = poem.text || "";
    }

    if (elements.detailKana) {
      if (poem.kana) {
        elements.detailKana.textContent = poem.kana;
        elements.detailKana.classList.remove("hidden");
      } else {
        elements.detailKana.textContent = "";
        elements.detailKana.classList.add("hidden");
      }
    }

    app.renderDetailTags(poem);
    app.renderDetailWords(poem);
    app.renderDetailMetaInfo(poem);
  };

  app.renderDetailTags = function renderDetailTags(poem) {
    const elements = app.elements;
    if (!elements.detailTagSection || !elements.detailTags) return;

    elements.detailTags.innerHTML = "";
    const tags = app.normalizeTagList(poem.tag);

    if (!tags.length) {
      elements.detailTagSection.classList.add("hidden");
      return;
    }

    elements.detailTagSection.classList.remove("hidden");

    tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "detail-tag";
      span.textContent = tag;
      elements.detailTags.appendChild(span);
    });
  };

  app.renderDetailWords = function renderDetailWords(poem) {
    const elements = app.elements;
    if (!elements.detailWordsSection || !elements.detailWords) return;

    elements.detailWords.innerHTML = "";

    const matchedTerms = app.getMatchedTermsForPoem(poem);

    if (!matchedTerms.length) {
      elements.detailWordsSection.classList.add("hidden");
      return;
    }

    elements.detailWordsSection.classList.remove("hidden");

    matchedTerms.forEach((term) => {
      const wrap = document.createElement("div");
      wrap.className = "word-meaning-item";

      const word = document.createElement("div");
      word.className = "word-meaning-word";
      word.textContent = term.word || "";

      const meta = document.createElement("div");
      meta.className = "detail-meta-line";
      meta.textContent = [term.reading || "", term.partOfSpeech || ""]
        .filter(Boolean)
        .join(" ｜ ");

      const meaning = document.createElement("div");
      meaning.className = "word-meaning-text";
      meaning.textContent = Array.isArray(term.meaning)
        ? term.meaning.join(" / ")
        : (term.meaning || "意味未登録");

      wrap.appendChild(word);
      if (meta.textContent) wrap.appendChild(meta);
      wrap.appendChild(meaning);

      if (Array.isArray(term.tags) && term.tags.length) {
        const tagBox = document.createElement("div");
        tagBox.className = "detail-tags";
        tagBox.style.marginTop = "8px";

        term.tags.forEach((tag) => {
          const span = document.createElement("span");
          span.className = "detail-tag";
          span.textContent = tag;
          tagBox.appendChild(span);
        });

        wrap.appendChild(tagBox);
      }

      if (term.note) {
        const note = document.createElement("div");
        note.className = "word-meaning-text";
        note.style.marginTop = "8px";
        note.textContent = `注: ${term.note}`;
        wrap.appendChild(note);
      }

      elements.detailWords.appendChild(wrap);
    });
  };

  app.renderDetailMetaInfo = function renderDetailMetaInfo(poem) {
    const elements = app.elements;
    if (!elements.detailMetaInfoSection || !elements.detailMetaInfo) return;

    elements.detailMetaInfo.innerHTML = "";
    const metaInfo = app.normalizeMetaInfo(poem.meta_info);

    const entries = Object.entries(metaInfo).filter(([key, value]) => {
      return String(key).trim() && String(value).trim();
    });

    if (!entries.length) {
      elements.detailMetaInfoSection.classList.add("hidden");
      return;
    }

    elements.detailMetaInfoSection.classList.remove("hidden");

    entries.forEach(([key, value]) => {
      const item = document.createElement("div");
      item.className = "meta-info-item";

      const keyEl = document.createElement("div");
      keyEl.className = "meta-info-key";
      keyEl.textContent = key;

      const valueEl = document.createElement("div");
      valueEl.className = "meta-info-value";
      valueEl.textContent = value;

      item.appendChild(keyEl);
      item.appendChild(valueEl);
      elements.detailMetaInfo.appendChild(item);
    });
  };

  app.normalizeTagList = function normalizeTagList(tagValue) {
    if (!tagValue) return [];

    if (Array.isArray(tagValue)) {
      return [...new Set(tagValue.map(v => String(v).trim()).filter(Boolean))];
    }

    if (typeof tagValue === "string") {
      return [...new Set(
        tagValue.split(/[,\n、]/).map(v => v.trim()).filter(Boolean)
      )];
    }

    return [];
  };

  app.normalizeMetaInfo = function normalizeMetaInfo(metaValue) {
    if (!metaValue) return {};
    if (typeof metaValue === "object" && !Array.isArray(metaValue)) {
      return metaValue;
    }
    return {};
  };

  app.closePoemDetail = function closePoemDetail() {
    const elements = app.elements;
    if (!elements.poemDetailModal) return;
    elements.poemDetailModal.classList.add("hidden");
  };

  app.handleTagButtonClick = function handleTagButtonClick(event) {
    const elements = app.elements;
    const button = event.currentTarget;
    const keyword = button.dataset.keyword;
    const theme = button.dataset.theme;
    const season = button.dataset.season;
    const author = button.dataset.author;
    const kigo = button.dataset.kigo;
    const syncNgram = button.dataset.syncNgram === "true";

    if (keyword) elements.searchInput.value = keyword;
    if (theme && elements.themeFilter) elements.themeFilter.value = theme;
    if (season && elements.seasonFilter) elements.seasonFilter.value = season;
    if (author && elements.authorFilter) elements.authorFilter.value = author;
    if (kigo && elements.kigoFilter) elements.kigoFilter.value = kigo;
    if (syncNgram && elements.ngramInput) {
      elements.ngramInput.value = keyword || kigo || "";
    }

    app.handleSearch();
  };

  app.handleHighlightToggle = function handleHighlightToggle() {
    app.renderCurrentPage();
  };

  app.applyVerticalMode = function applyVerticalMode() {
    const elements = app.elements;
    const isVertical = !!elements.verticalModeToggle?.checked;

    elements.searchResults.classList.toggle("vertical-mode", isVertical);
    elements.randomPoem.classList.toggle("vertical-mode", isVertical);
  };

  app.handleVerticalModeToggle = function handleVerticalModeToggle() {
    app.applyVerticalMode();
  };

  app.bindEvents = function bindEvents() {
    const elements = app.elements;

    elements.shufflePoemButton?.addEventListener("click", app.renderRandomPoem);
    elements.searchForm?.addEventListener("submit", app.handleSearch);
    elements.clearSearchButton?.addEventListener("click", app.handleClearSearch);
    elements.ngramForm?.addEventListener("submit", app.handleNgramSearch);
    elements.highlightToggle?.addEventListener("change", app.handleHighlightToggle);
    elements.verticalModeToggle?.addEventListener("change", app.handleVerticalModeToggle);

    elements.tagButtons?.forEach((button) => {
      button.addEventListener("click", app.handleTagButtonClick);
    });

    elements.closeDetail?.addEventListener("click", app.closePoemDetail);

    elements.poemDetailModal?.addEventListener("click", (event) => {
      if (event.target === elements.poemDetailModal) {
        app.closePoemDetail();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        app.closePoemDetail();
      }
    });
  };
})(window);
