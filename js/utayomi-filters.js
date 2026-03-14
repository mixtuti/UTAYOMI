// 生成画面のフィルター初期化
(function (global) {
  const utayomi = global.WakaUtayomi;

  // generator / assist 用の select を、app 側の poems から構築する
  utayomi.populateGenerationFilters = function populateGenerationFilters() {
    const state = utayomi.getAppState();
    const els = utayomi.elements;

    const collections = [
      ...new Set(state.poems.map((poem) => poem.collection).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "ja"));

    const collectionCounts = utayomi.buildCountMap(state.poems.map((p) => p.collection));

    utayomi.appendOptionsSafe(els.generatorCollectionFilter, collections, collectionCounts);
    utayomi.appendOptionsSafe(els.assistCollectionFilter, collections, collectionCounts);

    const allAuthors = [
      ...new Set(state.poems.map((poem) => poem.author).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "ja"));

    const majorAuthors = utayomi.getMajorAuthors(utayomi.state.minAuthorPoems);
    const authorCounts = utayomi.buildCountMap(state.poems.map((p) => p.author));

    utayomi.appendOptionsSafe(els.generatorAuthorFilter, majorAuthors, authorCounts);
    utayomi.appendOptionsSafe(els.assistAuthorFilter, allAuthors, authorCounts);
  };

  // 主要作者しきい値 ON/OFF に合わせて generator 側の作者候補を作り直す
  utayomi.refreshGeneratorAuthorsByThreshold = function refreshGeneratorAuthorsByThreshold() {
    const state = utayomi.getAppState();
    const els = utayomi.elements;
    if (!els.generatorAuthorFilter) return;

    const currentValue = els.generatorAuthorFilter.value;
    const useThreshold = !!els.generatorUseAuthorThresholdToggle?.checked;

    const authors = useThreshold
      ? utayomi.getMajorAuthors(utayomi.state.minAuthorPoems)
      : [...new Set(state.poems.map((poem) => poem.author).filter(Boolean))].sort(
          (a, b) => a.localeCompare(b, "ja")
        );

    els.generatorAuthorFilter.innerHTML = '<option value="">指定なし</option>';
    utayomi.appendOptionsSafe(els.generatorAuthorFilter, authors);

    if (authors.includes(currentValue)) {
      els.generatorAuthorFilter.value = currentValue;
    }
  };
})(window);
