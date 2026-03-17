// 共通ユーティリティ
(function (global) {
  const statsPage = global.WakaStats;

  statsPage.normalize = function normalize(text) {
    return String(text || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  };

  statsPage.escapeHtml = function escapeHtml(v) {
    return String(v || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  statsPage.truncateText = function truncateText(text, maxLength) {
    const value = String(text || "").trim();
    if (!value) return "";
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength) + "…";
  };

  statsPage.increment = function increment(map, key, val = 1) {
    map.set(key, (map.get(key) || 0) + val);
  };

  statsPage.incrementNested = function incrementNested(map, key, sub, val = 1) {
    if (!map.has(key)) map.set(key, new Map());
    const inner = map.get(key);
    inner.set(sub, (inner.get(sub) || 0) + val);
  };

  statsPage.unique = function unique(arr) {
    return [...new Set(arr.filter(Boolean))];
  };

  statsPage.sortMapEntries = function sortMapEntries(map) {
    return [...map.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.word || "").localeCompare(String(b.word || ""), "ja");
      });
  };

  statsPage.findRank = function findRank(items, word) {
    const index = items.findIndex((item) => item.word === word);
    return index >= 0 ? index + 1 : null;
  };

  statsPage.cloneRankItems = function cloneRankItems(items) {
    return items.map((item) => ({
      word: item.word,
      count: item.count
    }));
  };

  statsPage.shouldRefreshRankSnapshot = function shouldRefreshRankSnapshot() {
    const state = statsPage.state;
    const CONFIG = statsPage.CONFIG;

    return (
      state.isFinished ||
      (
        state.processedCount > 0 &&
        state.processedCount % CONFIG.RANK_SNAPSHOT_INTERVAL === 0
      )
    );
  };

  statsPage.getRankDiffByAdjacentSwap = function getRankDiffByAdjacentSwap(previousItems, currentItems, word, currentRank, hasSnapshot) {
    if (!hasSnapshot || !previousItems.length) {
      return { text: "", className: "is-stay" };
    }

    const prevRank = statsPage.findRank(previousItems, word);

    if (prevRank == null) {
      return { text: "NEW", className: "is-new" };
    }

    if (prevRank === currentRank) {
      return { text: "→→", className: "is-stay" };
    }

    if (prevRank === currentRank + 1) {
      const prevOccupantAtCurrentRank = previousItems[currentRank - 1]?.word;
      if (prevOccupantAtCurrentRank) {
        const nowRankOfPrevOccupant = statsPage.findRank(currentItems, prevOccupantAtCurrentRank);
        if (nowRankOfPrevOccupant === prevRank) {
          return { text: "↑1", className: "is-up" };
        }
      }
    }

    if (prevRank === currentRank - 1) {
      const prevOccupantAtCurrentRank = previousItems[currentRank - 1]?.word;
      if (prevOccupantAtCurrentRank) {
        const nowRankOfPrevOccupant = statsPage.findRank(currentItems, prevOccupantAtCurrentRank);
        if (nowRankOfPrevOccupant === prevRank) {
          return { text: "↓1", className: "is-down" };
        }
      }
    }

    return { text: "→→", className: "is-stay" };
  };

  statsPage.splitKanaBlocks = function splitKanaBlocks(kana) {
    return String(kana || "")
      .trim()
      .split(/\s+/)
      .map((v) => String(v || "").trim())
      .filter(Boolean);
  };

  statsPage.getPhraseBlocks = function getPhraseBlocks(poem) {
    if (Array.isArray(poem.tokens) && poem.tokens.length > 0) {
      return poem.tokens;
    }
    return statsPage.splitKanaBlocks(poem.kana);
  };

  statsPage.isIndependentToken = function isIndependentToken(token) {
    const word = String(token || "").trim();
    if (!word) return false;
    if (word.length <= 1) return false;
    if (statsPage.NON_INDEPENDENT_TOKENS.has(word)) return false;
    return true;
  };

  // 統計タグ別の一致ルール
  // 誤爆しやすいカテゴリは reading の扱いを厳しくする
  statsPage.getEntryMatchPolicy = function getEntryMatchPolicy(tag) {
    switch (tag) {
      case "動物":
        return {
          allowReading: false,
          readingMinLength: 99,
          readingRequiresTokenExact: true,
        };
      case "植物":
      case "地名":
        return {
          allowReading: true,
          readingMinLength: 3,
          readingRequiresTokenExact: true,
        };
      case "枕詞":
        return {
          allowReading: true,
          readingMinLength: 3,
          readingRequiresTokenExact: true,
        };
      default:
        return {
          allowReading: true,
          readingMinLength: 3,
          readingRequiresTokenExact: true,
        };
    }
  };

  // タグ別に辞書語を準備し、一致方法を分けて保持する
  // textForms: 本文・かな連結への部分一致に使う
  // readingForms: token 完全一致にだけ使う
  statsPage.prepareEntries = function prepareEntries(dictionary, tag) {
    const policy = statsPage.getEntryMatchPolicy(tag);

    return dictionary
      .filter((entry) => Array.isArray(entry.tags) && entry.tags.includes(tag))
      .map((entry) => {
        const textForms = statsPage.unique([
          entry.word,
          ...(entry.aliases || []),
          ...(entry.surface_forms || [])
        ].map(statsPage.normalize)).filter((form) => form.length >= 2);

        const readingForms = policy.allowReading
          ? statsPage.unique([entry.reading].map(statsPage.normalize))
              .filter((form) => form && form.length >= policy.readingMinLength)
          : [];

        return {
          word: entry.word,
          textForms,
          readingForms,
          matchPolicy: policy,
        };
      });
  };

  // 1つの辞書語が、その歌に現れたとみなせるか
  // - textForms は joined text への部分一致
  // - readingForms は token 完全一致だけ
  statsPage.entryMatchesPoem = function entryMatchesPoem(entry, joined, normalizedTokens) {
    const matchedByText = Array.isArray(entry.textForms)
      && entry.textForms.some((form) => joined.includes(form));

    const matchedByReading = Array.isArray(entry.readingForms)
      && entry.readingForms.some((form) => normalizedTokens.includes(form));

    return matchedByText || matchedByReading;
  };

  statsPage.buildDictionaryStats = function buildDictionaryStats(dictionary) {
    const stats = statsPage.stats;
    const tagMap = new Map();
    const conjugationMap = new Map();

    dictionary.forEach((entry) => {
      const tags = Array.isArray(entry.tags) ? entry.tags : [];
      tags.forEach((tag) => statsPage.increment(tagMap, tag));

      if (entry.conjugation) {
        const part = entry.partOfSpeech || "未分類";
        statsPage.increment(conjugationMap, part);
      }
    });

    stats.tagDistribution = tagMap;
    stats.conjugationCounts = conjugationMap;
  };
})(window);
