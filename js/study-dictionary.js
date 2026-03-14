// 辞書ロード・辞書項目検索
(function (global) {
  const study = global.WakaStudy;

  study.loadDictionary = async function loadDictionary() {
    const els = study.elements;

    try {
      let dictionary = [];

      if (global.WakaAPI?.loadTermDictionary) {
        dictionary = await global.WakaAPI.loadTermDictionary();
      } else {
        const res = await fetch("./data/classical_terms.json");
        if (!res.ok) {
          throw new Error("辞書JSONの読み込みに失敗しました");
        }
        dictionary = await res.json();
      }

      study.state.dictionary = Array.isArray(dictionary) ? dictionary : [];
      study.renderSuggestions();
    } catch (err) {
      console.error("辞書JSONの読み込み失敗:", err);
      els.result.innerHTML =
        `<div class="empty-state">辞書データを読み込めませんでした。</div>`;
      if (els.related) {
        els.related.innerHTML =
          `<div class="empty-state">関連語を読み込めませんでした。</div>`;
      }
    }
  };

  study.getEntryDisplayAliases = function getEntryDisplayAliases(entry) {
    return study.uniqueStrings([
      ...(Array.isArray(entry.aliases) ? entry.aliases : []),
      ...(Array.isArray(entry.variants) ? entry.variants : []),
      ...(Array.isArray(entry.surface_forms) ? entry.surface_forms : []),
    ]).filter((item) => item !== entry.word);
  };

  study.getEntrySearchKeys = function getEntrySearchKeys(entry) {
    const keys = new Set();
    const hasSearchForms = Array.isArray(entry.search_forms);

    const sourceValues = hasSearchForms
      ? entry.search_forms
      : [
          entry.word,
          entry.reading,
          ...(Array.isArray(entry.variants) ? entry.variants : []),
          ...(Array.isArray(entry.aliases) ? entry.aliases : []),
          ...(Array.isArray(entry.surface_forms) ? entry.surface_forms : []),
        ];

    sourceValues.filter(Boolean).forEach((v) => {
      const value = String(v).trim();
      if (!value) return;
      keys.add(value);
      keys.add(study.toHiragana(value));
      keys.add(study.toKatakana(value));
    });

    return [...keys].filter(Boolean);
  };

  study.getEntryLookupKeys = function getEntryLookupKeys(entry) {
    const keys = new Set();

    [
      entry.word,
      entry.reading,
      ...(Array.isArray(entry.variants) ? entry.variants : []),
      ...(Array.isArray(entry.aliases) ? entry.aliases : []),
      ...(Array.isArray(entry.surface_forms) ? entry.surface_forms : []),
    ].filter(Boolean).forEach((v) => {
      const value = String(v).trim();
      if (!value) return;
      keys.add(value);
      keys.add(study.toHiragana(value));
      keys.add(study.toKatakana(value));
    });

    return [...keys].filter(Boolean);
  };

  study.getEntryExampleKeys = function getEntryExampleKeys(entry) {
    const keys = new Set();
    if (!Array.isArray(entry.search_forms)) return [];

    entry.search_forms.filter(Boolean).forEach((v) => {
      const value = String(v).trim();
      if (!value) return;
      keys.add(value);
      keys.add(study.toHiragana(value));
      keys.add(study.toKatakana(value));
    });

    return [...keys].filter(Boolean);
  };

  study.getEntriesSearchKeys = function getEntriesSearchKeys(entries) {
    return study.uniqueStrings(
      entries.flatMap((entry) => study.getEntryExampleKeys(entry))
    );
  };

  study.findDictionaryEntries = function findDictionaryEntries(word) {
    const dictionary = study.state.dictionary;
    const normalized = study.normalizeText(word);
    const hira = study.normalizeText(study.toHiragana(word));
    const kata = study.normalizeText(study.toKatakana(word));

    return dictionary.filter((entry) =>
      study.getEntryLookupKeys(entry).some((key) => {
        const normalizedKey = study.normalizeText(key);
        return (
          normalizedKey === normalized ||
          normalizedKey === hira ||
          normalizedKey === kata
        );
      })
    );
  };
})(window);
