// フィルターUI初期化
(function (global) {
  const app = global.WakaApp;

  app.populateCollectionFilter = function populateCollectionFilter() {
    const state = app.state;
    const elements = app.elements;

    const collections = [
      ...new Set(state.poems.map((poem) => poem.collection).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "ja"));

    const countMap = app.buildCountMap(state.poems.map((poem) => poem.collection));
    app.appendOptions(elements.collectionFilter, collections, countMap);
  };

  app.populateThemeFilterFromData = function populateThemeFilterFromData() {
    const state = app.state;
    const elements = app.elements;
    if (!elements.themeFilter) return;

    const currentValue = elements.themeFilter.value;
    elements.themeFilter.innerHTML = '<option value="">すべて</option>';

    const themes = [
      ...new Set(state.poems.map((poem) => poem.theme).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "ja"));

    const countMap = app.buildCountMap(state.poems.map((poem) => poem.theme));
    app.appendOptions(elements.themeFilter, themes, countMap);

    if (themes.includes(currentValue)) {
      elements.themeFilter.value = currentValue;
    }
  };

  app.populateSeasonFilter = function populateSeasonFilter() {
    const state = app.state;
    const elements = app.elements;
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

    const countMap = app.buildCountMap(state.poems.map((poem) => poem.season));
    app.appendOptions(elements.seasonFilter, seasons, countMap);

    if (seasons.includes(currentValue)) {
      elements.seasonFilter.value = currentValue;
    }
  };

  app.populateAuthorFilter = function populateAuthorFilter() {
    const state = app.state;
    const elements = app.elements;

    const authors = [
      ...new Set(state.poems.map((poem) => poem.author).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "ja"));

    const countMap = app.buildCountMap(state.poems.map((poem) => poem.author));
    app.appendOptions(elements.authorFilter, authors, countMap);
  };

  app.populateKigoFilter = function populateKigoFilter() {
    const state = app.state;
    const elements = app.elements;

    const kigoList = [
      ...new Set(state.kigoDictionary.map((entry) => entry.word).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "ja"));

    const countMap = new Map();

    state.poems.forEach((poem) => {
      app.detectKigoWords(poem).forEach((word) => {
        countMap.set(word, (countMap.get(word) || 0) + 1);
      });
    });

    app.appendOptions(elements.kigoFilter, kigoList, countMap);
  };

  app.buildCountMap = function buildCountMap(items) {
    const map = new Map();

    items.forEach((value) => {
      if (!value) return;
      map.set(value, (map.get(value) || 0) + 1);
    });

    return map;
  };

  app.appendOptions = function appendOptions(selectElement, values, countMap = null) {
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
  };
})(window);
