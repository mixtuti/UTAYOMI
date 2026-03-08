// 和歌コーパス検索 拡張用
// 既存の app.js の後に読み込む追加JSを想定
// 依存: state, appendOptions, escapeHtml が既存側にある前提

const generationState = {
  currentTab: "generator",
  currentGeneratedPoem: null,
  currentAssistPoem: null,
  minAuthorPoems: 10,
};

const GENERATION_MIN_CANDIDATES = 12;
const GENERATION_SOFT_MIN_CANDIDATES = 5;

const keywordAssociations = {
  雪: ["冬", "白", "霜", "空", "朝", "庭", "降る", "寒"],
  春: ["霞", "花", "野", "梅", "桜", "若菜", "鶯"],
  秋: ["露", "風", "雁", "紅葉", "夜", "虫"],
  夢: ["夜", "寝", "袖", "恋", "明け", "暁"],
  波: ["海", "浜", "風", "寄る", "白波", "浦", "舟", "立ち返る", "渚"],
  袖: ["涙", "濡る", "乾く", "恋", "別れ", "秋風", "夜", "片敷く"],
  山: ["雲", "峰", "谷", "ほととぎす", "鹿", "紅葉", "霧", "越ゆ", "路"],
  雨: ["降る", "濡る", "時雨", "五月雨", "袖", "空", "雲", "音"],
  川: ["瀬", "流る", "淀む", "淵", "白波", "早き", "水"],

  // 夏：春や秋とは違う「鋭さ」や「湿り気」
  夏: ["ほととぎす", "卯の花", "菖蒲", "五月雨", "蝉", "涼し", "茂る", "夏衣"],
  ほととぎす: ["忍び音", "待つ", "夜ふかく", "山", "鳴く", "雲ゐ", "暁"],
  
  // 冬：静寂と白の世界
  冬: ["枯る", "氷", "千鳥", "網代", "炭竃", "冴ゆる", "時雨", "小夜更けて"],
  時雨: ["袖", "濡る", "紅葉", "音", "冬", "定まらぬ", "神奈備"],

  // 恋：和歌のメインテーマ。心理描写と連動
  恋: ["逢ふ", "忍ぶ", "涙", "袖", "面影", "思ひ寝", "夕暮れ", "絶ゆ", "忘る"],
  涙: ["袖", "露", "濡る", "乾く", "川", "淵", "沈む", "玉"],
  
  // 場所（歌枕的要素）：風景を固定する
  海: ["波", "浜", "浦", "舟", "海人", "藻塩", "焼く", "寄る", "沖"],
  川: ["瀬", "流れ", "淀む", "岩波", "白波", "清き", "淵"],
  里: ["古里", "山里", "荒れたる", "住む", "訪ふ", "垣根", "柴の戸"],

  // 植物：より具体的な色彩
  松: ["千代", "待つ", "磯", "風の音", "常盤", "翠"],
  紅葉: ["色", "染む", "散る", "錦", "竜田", "秋風", "鹿の音"],
  萩: ["露", "置く", "乱る", "野辺", "秋風", "しをる"],

  // 現象・感覚
  風: ["吹く", "音", "誘ふ", "秋", "松", "袖", "身にしむ"],
  霞: ["立ちいづる", "春", "山", "たなびく", "隔つ", "のどか"],
  露: ["置く", "消ゆ", "はかなし", "草", "袖", "涙", "命"],

  月: ["夜", "影", "光", "有明", "秋", "空", "雲", "山の端", "露", "小夜", "更ける"],
  月夜: ["さやか", "影", "照らす", "隈なき", "澄みわたる"],
  
  // 時間帯や状態（これらを「月」のテーマに混ぜる）
  夜: ["更ける", "寝", "夢", "暁", "枕", "独り", "明かり"],
  
  // 空の様子
  空: ["雲", "星", "晴る", "天の河", "わたる", "たなびく"],
};

const generationElements = {
  generatorTabButton: document.getElementById("generatorTabButton"),
  assistTabButton: document.getElementById("assistTabButton"),
  generatorModePanel: document.getElementById("generatorModePanel"),
  assistModePanel: document.getElementById("assistModePanel"),

  generatorForm: document.getElementById("generatorForm"),
  generatorModeSelect: document.getElementById("generatorModeSelect"),
  generatorSeasonFilter: document.getElementById("generatorSeasonFilter"),
  generatorCollectionFilter: document.getElementById("generatorCollectionFilter"),
  generatorAuthorFilter: document.getElementById("generatorAuthorFilter"),
  generatorKeywordInput: document.getElementById("generatorKeywordInput"),
  generatorKeywordModeSelect: document.getElementById("generatorKeywordModeSelect"),
  generatorStyleSelect: document.getElementById("generatorStyleSelect"),
  generatorShapeSelect: document.getElementById("generatorShapeSelect"),
  generatorUseSeasonOnlyToggle: document.getElementById("generatorUseSeasonOnlyToggle"),
  generatorUseAuthorThresholdToggle: document.getElementById("generatorUseAuthorThresholdToggle"),
  generatorPreferKigoToggle: document.getElementById("generatorPreferKigoToggle"),
  generateAutoPoemButton: document.getElementById("generateAutoPoemButton"),
  generateRandomPoemButton: document.getElementById("generateRandomPoemButton"),
  generatedPoemMeta: document.getElementById("generatedPoemMeta"),
  generatedPoemResult: document.getElementById("generatedPoemResult"),
  generatedPoemSource: document.getElementById("generatedPoemSource"),
  copyGeneratedPoemButton: document.getElementById("copyGeneratedPoemButton"),
  saveGeneratedPoemButton: document.getElementById("saveGeneratedPoemButton"),

  assistForm: document.getElementById("assistForm"),
  assistSeasonFilter: document.getElementById("assistSeasonFilter"),
  assistCollectionFilter: document.getElementById("assistCollectionFilter"),
  assistAuthorFilter: document.getElementById("assistAuthorFilter"),
  assistKeywordInput: document.getElementById("assistKeywordInput"),
  assistFillModeSelect: document.getElementById("assistFillModeSelect"),
  assistLine1: document.getElementById("assistLine1"),
  assistLine2: document.getElementById("assistLine2"),
  assistLine3: document.getElementById("assistLine3"),
  assistLine4: document.getElementById("assistLine4"),
  assistLine5: document.getElementById("assistLine5"),
  assistGenerateButton: document.getElementById("assistGenerateButton"),
  assistResetButton: document.getElementById("assistResetButton"),
  assistPresetFirstLineButton: document.getElementById("assistPresetFirstLineButton"),
  assistPresetLastLineButton: document.getElementById("assistPresetLastLineButton"),
  assistPresetRandomSlotsButton: document.getElementById("assistPresetRandomSlotsButton"),
  assistPoemMeta: document.getElementById("assistPoemMeta"),
  assistPoemResult: document.getElementById("assistPoemResult"),
  assistPoemSource: document.getElementById("assistPoemSource"),
  copyAssistPoemButton: document.getElementById("copyAssistPoemButton"),
  saveAssistPoemButton: document.getElementById("saveAssistPoemButton"),
};

function initializeGenerationModes() {
  if (!state || !Array.isArray(state.poems) || !state.poems.length) {
    setTimeout(initializeGenerationModes, 200);
    return;
  }

  populateGenerationFilters();
  bindGenerationEvents();
  setModeTab("generator");
  renderGeneratorEmptyState();
  renderAssistEmptyState();
}

function populateGenerationFilters() {
  const collections = [...new Set(state.poems.map((poem) => poem.collection).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));

  appendOptionsSafe(generationElements.generatorCollectionFilter, collections);
  appendOptionsSafe(generationElements.assistCollectionFilter, collections);

  const allAuthors = [...new Set(state.poems.map((poem) => poem.author).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));

  const majorAuthors = getMajorAuthors(generationState.minAuthorPoems);
  appendOptionsSafe(generationElements.generatorAuthorFilter, majorAuthors);
  appendOptionsSafe(generationElements.assistAuthorFilter, allAuthors);
}

function appendOptionsSafe(selectElement, values) {
  if (!selectElement) return;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function getMajorAuthors(minPoems = 10) {
  const counts = new Map();

  state.poems.forEach((poem) => {
    const author = String(poem.author || "").trim();
    if (!author) return;
    counts.set(author, (counts.get(author) || 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count >= minPoems)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "ja");
    })
    .map(([author]) => author);
}

function bindGenerationEvents() {
  generationElements.generatorTabButton?.addEventListener("click", () => setModeTab("generator"));
  generationElements.assistTabButton?.addEventListener("click", () => setModeTab("assist"));

  generationElements.generateAutoPoemButton?.addEventListener("click", handleGenerateAutoPoem);
  generationElements.generateRandomPoemButton?.addEventListener("click", handleGenerateRandomPoem);
  generationElements.copyGeneratedPoemButton?.addEventListener("click", () => copyPoemResult("generator"));
  generationElements.saveGeneratedPoemButton?.addEventListener("click", () => savePoemCandidate("generator"));

  generationElements.assistGenerateButton?.addEventListener("click", handleAssistGenerate);
  generationElements.assistResetButton?.addEventListener("click", resetAssistInputs);
  generationElements.assistPresetFirstLineButton?.addEventListener("click", presetAssistFirstLineOnly);
  generationElements.assistPresetLastLineButton?.addEventListener("click", presetAssistLastLineOnly);
  generationElements.assistPresetRandomSlotsButton?.addEventListener("click", presetAssistRandomSlots);
  generationElements.copyAssistPoemButton?.addEventListener("click", () => copyPoemResult("assist"));
  generationElements.saveAssistPoemButton?.addEventListener("click", () => savePoemCandidate("assist"));

  generationElements.generatorUseAuthorThresholdToggle?.addEventListener("change", refreshGeneratorAuthorsByThreshold);
}

function setModeTab(mode) {
  generationState.currentTab = mode;

  const isGenerator = mode === "generator";

  if (generationElements.generatorTabButton) {
    generationElements.generatorTabButton.className = isGenerator ? "button" : "button secondary";
    generationElements.generatorTabButton.setAttribute("aria-pressed", String(isGenerator));
  }

  if (generationElements.assistTabButton) {
    generationElements.assistTabButton.className = isGenerator ? "button secondary" : "button";
    generationElements.assistTabButton.setAttribute("aria-pressed", String(!isGenerator));
  }

  if (generationElements.generatorModePanel) {
    generationElements.generatorModePanel.hidden = !isGenerator;
  }

  if (generationElements.assistModePanel) {
    generationElements.assistModePanel.hidden = isGenerator;
  }
}

function refreshGeneratorAuthorsByThreshold() {
  if (!generationElements.generatorAuthorFilter) return;

  const currentValue = generationElements.generatorAuthorFilter.value;
  const useThreshold = !!generationElements.generatorUseAuthorThresholdToggle?.checked;
  const authors = useThreshold
    ? getMajorAuthors(generationState.minAuthorPoems)
    : [...new Set(state.poems.map((poem) => poem.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));

  generationElements.generatorAuthorFilter.innerHTML = '<option value="">指定なし</option>';
  appendOptionsSafe(generationElements.generatorAuthorFilter, authors);

  if (authors.includes(currentValue)) {
    generationElements.generatorAuthorFilter.value = currentValue;
  }
}

function handleGenerateAutoPoem() {
  const options = getGeneratorOptions();
  const poem = generateAutoPoem(options);

  if (!poem) {
    renderGeneratorFailure("条件に合う候補が少ないため、一首を組み立てられませんでした。条件を少し緩めてみてください。");
    return;
  }

  generationState.currentGeneratedPoem = poem;
  renderGeneratedPoem(poem);
}

function handleGenerateRandomPoem() {
  const poem = generateAutoPoem({
    mode: "random",
    season: "",
    collection: "",
    author: "",
    keyword: "",
    keywordMode: "prefer",
    style: "balanced",
    shape: "auto",
    useSeasonOnly: false,
    useThresholdAuthor: false,
    preferKigo: false,
    forceRandom: true,
  });

  if (!poem) {
    renderGeneratorFailure("ランダム生成に失敗しました。元データの句構造を確認してください。");
    return;
  }

  generationState.currentGeneratedPoem = poem;
  renderGeneratedPoem(poem);
}

function getGeneratorOptions() {
  return {
    mode: generationElements.generatorModeSelect?.value || "guided",
    season: generationElements.generatorSeasonFilter?.value || "",
    collection: generationElements.generatorCollectionFilter?.value || "",
    author: generationElements.generatorAuthorFilter?.value || "",
    keyword: String(generationElements.generatorKeywordInput?.value || "").trim(),
    keywordMode: generationElements.generatorKeywordModeSelect?.value || "prefer",
    style: generationElements.generatorStyleSelect?.value || "balanced",
    shape: generationElements.generatorShapeSelect?.value || "auto",
    useSeasonOnly: !!generationElements.generatorUseSeasonOnlyToggle?.checked,
    useThresholdAuthor: !!generationElements.generatorUseAuthorThresholdToggle?.checked,
    preferKigo: !!generationElements.generatorPreferKigoToggle?.checked,
    forceRandom: false,
  };
}

function getAssistOptions() {
  return {
    season: generationElements.assistSeasonFilter?.value || "",
    collection: generationElements.assistCollectionFilter?.value || "",
    author: generationElements.assistAuthorFilter?.value || "",
    keyword: String(generationElements.assistKeywordInput?.value || "").trim(),
    fillMode: generationElements.assistFillModeSelect?.value || "natural",
    userLines: getAssistInputLines(),
  };
}

function getAssistInputLines() {
  return [
    generationElements.assistLine1?.value || "",
    generationElements.assistLine2?.value || "",
    generationElements.assistLine3?.value || "",
    generationElements.assistLine4?.value || "",
    generationElements.assistLine5?.value || "",
  ].map((line) => String(line || "").trim());
}

function generateAutoPoem(options) {
  let bestPoem = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 12; attempt++) {
    const poem = generateAutoPoemOnce(options);
    if (!poem) continue;

    let score = 0;
    score += scoreWholePoemKeywordBalance(poem.lines, options.keyword, options.keywordMode);

    // 作者指定がある場合、本人句が1つでも入っていれば大きく加点
    if (options.author) {
      const hasAuthorLine = poem.pickedSources.some((src) => src?.author === options.author);
      score += hasAuthorLine ? 40 : -120;
    }

    // 語尾のバリエーション
    const tails = poem.lines.map((line) => getLineTail(line, 2));
    score += new Set(tails).size * 1.5;

    if (score > bestScore) {
      bestPoem = poem;
      bestScore = score;
    }
  }

  if (!bestPoem) return null;

  return {
    lines: bestPoem.lines,
    meta: bestPoem.meta,
    sourceMemo: bestPoem.sourceMemo,
  };
}

function generateAutoPoemOnce(options) {
  const candidateInfo = resolveGenerationCandidates(options);
  const candidates = candidateInfo.candidates;
  if (!candidates.length) return null;

  const adjustedOptions = {
    ...options,
    relaxedLevel: candidateInfo.relaxedLevel,
  };

  const linePools = buildLinePools(candidates, adjustedOptions);
  const lines = [];
  const pickedSources = [];
  const usedLineKeys = new Set();

  // 作者本人の句を最低1つ入れたい場合、そのスロットを先に1つ確保する
  let forcedAuthorSlot = -1;
  if (candidateInfo.mustKeepAuthor && options.author) {
    const authorPools = linePools.map((pool) =>
      pool.filter((item) => item.source?.author === options.author)
    );

    const availableSlots = authorPools
      .map((pool, index) => ({ index, count: pool.length }))
      .filter((entry) => entry.count > 0);

    if (availableSlots.length) {
      // 候補があるスロットからランダムで1つ確保
      const picked = availableSlots[Math.floor(Math.random() * availableSlots.length)];
      forcedAuthorSlot = picked.index;
    }
  }

  for (let i = 0; i < 5; i++) {
    let lineCandidate = null;

    if (i === forcedAuthorSlot && options.author) {
      const authorOnlyPool = linePools[i].filter((item) => item.source?.author === options.author);
      lineCandidate = pickBestLineForSlot(
        i,
        authorOnlyPool,
        adjustedOptions,
        lines,
        usedLineKeys,
        pickedSources
      );
    } else {
      lineCandidate = pickBestLineForSlot(
        i,
        linePools[i],
        adjustedOptions,
        lines,
        usedLineKeys,
        pickedSources
      );
    }

    if (!lineCandidate) return null;

    lines.push(lineCandidate.line);
    pickedSources.push(lineCandidate.source);
    usedLineKeys.add(`${lineCandidate.source?.id || "x"}:${lineCandidate.line}`);
  }

  // 念のため、作者指定なのに1句も入らなかったら補正
  if (candidateInfo.mustKeepAuthor && options.author) {
    const hasAuthorLine = pickedSources.some((src) => src?.author === options.author);

    if (!hasAuthorLine) {
      const authorOnlyPools = linePools.map((pool) =>
        pool.filter((item) => item.source?.author === options.author)
      );

      let replaced = false;

      for (let i = 0; i < authorOnlyPools.length; i++) {
        const replacement = pickBestLineForSlot(
          i,
          authorOnlyPools[i],
          adjustedOptions,
          lines.filter((_, idx) => idx !== i),
          new Set(),
          pickedSources
        );

        if (replacement) {
          lines[i] = replacement.line;
          pickedSources[i] = replacement.source;
          replaced = true;
          break;
        }
      }

      if (!replaced) {
        return null;
      }
    }
  }

  let finalLines = [...lines];

  if (options.keyword && options.keywordMode === "must") {
    finalLines = enforceMustKeyword(finalLines, linePools, options.keyword);
    if (!finalLines) return null;
  }

  return {
    lines: finalLines,
    pickedSources,
    meta: {
      season: options.season || "指定なし",
      collection: options.collection || "指定なし",
      author: options.author || "指定なし",
      keyword: options.keyword || "なし",
      keywordMode: options.keywordMode,
      style: options.style,
      shape: options.shape,
      candidateCount: candidates.length,
      relaxedLevel: candidateInfo.relaxedLevel,
    },
    sourceMemo: buildSourceMemo(pickedSources, {
      ...options,
      relaxedLabel: candidateInfo.label,
    }),
  };
}

function handleAssistGenerate() {
  const options = getAssistOptions();
  const poem = generateAssistPoem(options);

  if (!poem) {
    renderAssistFailure("入力された句や条件に合う補完候補が見つかりませんでした。空欄を増やすか条件を緩めてみてください。");
    return;
  }

  generationState.currentAssistPoem = poem;
  renderAssistPoem(poem);
}

function generateAssistPoem(options) {
  const fixedCount = options.userLines.filter(Boolean).length;
  if (fixedCount < 1 || fixedCount > 4) {
    return null;
  }

  const candidateInfo = resolveGenerationCandidates(options);
  const sourcePoems = candidateInfo.candidates;
  if (!sourcePoems.length) return null;

  const adjustedOptions = {
    ...options,
    relaxedLevel: candidateInfo.relaxedLevel,
  };

  const linePools = buildLinePools(sourcePoems, adjustedOptions);
  const resultLines = [...options.userLines];
  const usedLineKeys = new Set(resultLines.filter(Boolean));
  const pickedSources = [null, null, null, null, null];

  // ユーザー入力済みの句が、指定作者本人のものならそれを優先扱いにする材料
  const userLockedSlots = options.userLines.map((line) => !!line);

  // 作者指定があり、かつ候補側で本人句を保持したい場合
  const forcedAuthorSlot = pickForcedAssistAuthorSlot(
    linePools,
    options,
    options.userLines,
    candidateInfo.mustKeepAuthor
  );

  for (let i = 0; i < 5; i++) {
    if (resultLines[i]) continue;

    let lineCandidate = null;

    // 1か所だけ作者本人の句を優先確保
    if (i === forcedAuthorSlot && options.author) {
      const authorOnlyPool = linePools[i].filter(
        (item) => item.source?.author === options.author
      );

      lineCandidate = pickAssistLineForSlot(
        i,
        authorOnlyPool,
        adjustedOptions,
        resultLines,
        usedLineKeys,
        pickedSources
      );
    } else {
      lineCandidate = pickAssistLineForSlot(
        i,
        linePools[i],
        adjustedOptions,
        resultLines,
        usedLineKeys,
        pickedSources
      );
    }

    if (!lineCandidate) return null;

    resultLines[i] = lineCandidate.line;
    usedLineKeys.add(lineCandidate.line);
    pickedSources[i] = lineCandidate.source;
  }

  // 作者指定なのに1句も本人が入っていない場合、ユーザー未固定の句だけ差し替え補正
  if (candidateInfo.mustKeepAuthor && options.author) {
    const hasAuthorLine = assistHasAuthorLine(resultLines, pickedSources, options);

    if (!hasAuthorLine) {
      const replaced = enforceAssistAuthorLine(
        resultLines,
        pickedSources,
        linePools,
        adjustedOptions,
        userLockedSlots
      );

      if (!replaced) return null;
    }
  }

  // must keyword の最終補正
  if (options.keyword && options.keywordMode === "must") {
    const fixedKeywordCount = countKeywordInLines(resultLines, options.keyword);

    if (fixedKeywordCount === 0) {
      const replaced = enforceMustKeyword(
        resultLines,
        linePools,
        options.keyword,
        options.userLines
      );

      if (!replaced) return null;
      resultLines.splice(0, 5, ...replaced);
    }
  }

  return {
    lines: resultLines,
    pickedSources,
    meta: {
      season: options.season || "指定なし",
      collection: options.collection || "指定なし",
      author: options.author || "指定なし",
      keyword: options.keyword || "なし",
      fillMode: options.fillMode,
      fixedCount,
      fixedSlots: resultLines
        .map((line, index) => (options.userLines[index] ? index + 1 : null))
        .filter(Boolean),
      candidateCount: sourcePoems.length,
      relaxedLevel: candidateInfo.relaxedLevel,
    },
    sourceMemo: buildAssistSourceMemo(
      {
        ...options,
        relaxedLabel: candidateInfo.label,
      },
      pickedSources.filter(Boolean)
    ),
  };
}

function getPoemsByConditions(options = {}) {
  let results = [...state.poems];

  if (options.collection) {
    results = results.filter((poem) => poem.collection === options.collection);
  }

  if (options.author) {
    results = results.filter((poem) => poem.author === options.author);
  }

  if (options.season) {
    results = results.filter((poem) => poem.season === options.season);
  } else if (options.useSeasonOnly) {
    results = results.filter((poem) => poem.season);
  }

  return results.filter((poem) => getPoemLinesFromData(poem).length >= 5);
}

function poemContainsKeyword(poem, keyword) {
  const safeKeyword = normalizeLite(keyword);
  if (!safeKeyword) return false;

  const text = normalizeLite(poem.text || "");
  const kana = normalizeLite(poem.kana || "");
  const tokens = getPoemLinesFromData(poem).map((line) => normalizeLite(line)).join("");

  return text.includes(safeKeyword) || kana.includes(safeKeyword) || tokens.includes(safeKeyword);
}

function buildLinePools(poems, options = {}) {
  const pools = [[], [], [], [], []];

  poems.forEach((poem) => {
    const lines = getPoemLinesFromData(poem);
    if (lines.length < 5) return;

    lines.slice(0, 5).forEach((line, index) => {
      pools[index].push({
        line,
        source: poem,
        score: scoreLine(line, poem, options, index),
      });
    });
  });

  return pools.map((pool) => pool.sort((a, b) => b.score - a.score));
}

function scoreLine(line, poem, options, index) {
  let score = Math.random() * 5;

  if (options.season && poem.season === options.season) score += 8;
  if (options.collection && poem.collection === options.collection) score += 5;
  if (options.author && poem.author === options.author) score += 7;

  if (options.keyword) {
    const normLine = normalizeLite(line);
    const normKw = normalizeLite(options.keyword);

    if (options.keywordMode === "theme") {
      score += scoreKeywordMood(line, options.keyword, options.keywordMode);
    } else if (normLine.includes(normKw)) {
      // must / prefer は軽く加点するだけ
      score += (options.keywordMode === "must" ? 4 : 2);
    }
  }

  if (options.preferKigo && typeof detectKigoWords === "function") {
    const kigoWords = detectKigoWords(poem);
    if (kigoWords && kigoWords.length) score += 2;
  }

  if (options.style === "classical") {
    if (/[けりぬつらむけむかなこそぞ]/.test(line)) score += 2;
  }

  if (options.style === "simple") {
    score += Math.max(0, 10 - String(line).length * 0.3);
  }

  if (options.style === "experimental") {
    score += index === 2 ? 3 : 1;
  }

  if (options.shape === "57577") {
    const target = [5, 7, 5, 7, 7][index];
    const diff = Math.abs(countKanaLike(line) - target);
    score += Math.max(0, 6 - diff * 2);
  }

  if (options.forceRandom) {
    score = Math.random() * 100;
  }

  return score;
}

function pickBestLineForSlot(slotIndex, pool, options, currentLines, usedLineKeys, pickedSources = []) {
  if (!Array.isArray(pool) || !pool.length) return null;

  const candidates = shuffleArray(pool).slice(0, Math.min(80, pool.length));
  const previous = currentLines[currentLines.length - 1] || "";

  let best = null;
  let bestScore = -Infinity;

  for (const item of candidates) {
    const lineKey = `${item.source?.id || "x"}:${item.line}`;
    if (usedLineKeys.has(lineKey)) continue;

    // keyword本体の出現上限を守る
    if (options.keyword) {
      const currentKeywordCount = countKeywordOccurrences(currentLines, options.keyword);
      const maxKeywordCount = getKeywordMaxCount(options.keywordMode);

      if (
        normalizeLite(item.line).includes(normalizeLite(options.keyword)) &&
        currentKeywordCount >= maxKeywordCount
      ) {
        continue;
      }
    }

    let tempScore = item.score;

    tempScore += scoreLineConnection(previous, item.line, options, slotIndex);
    tempScore += scoreLineVariety(currentLines, item.line);
    tempScore += scoreThemeKeywordPenalty(item.line, currentLines, options.keyword, options.keywordMode);
    tempScore += scoreKeywordMood(item.line, options.keyword, options.keywordMode);

    // 同じ作者・出典ばかりになりすぎないよう軽く分散
    const sameAuthorCount = pickedSources.filter((src) => src?.author && src.author === item.source?.author).length;
    const sameCollectionCount = pickedSources.filter((src) => src?.collection && src.collection === item.source?.collection).length;

    tempScore -= sameAuthorCount * 1.2;
    tempScore -= sameCollectionCount * 0.8;

    // keyword漢字の再共有で加点しない
    const allUsedKanji = [...new Set(currentLines.join("").match(/[\u4E00-\u9FFF]/g) || [])];
    const keywordChars = options.keyword ? (options.keyword.match(/[\u4E00-\u9FFF]/g) || []) : [];

    for (const k of allUsedKanji) {
      if (keywordChars.includes(k)) continue;
      if (item.line.includes(k)) tempScore += 1.2;
    }

    if (tempScore > bestScore) {
      best = item;
      bestScore = tempScore;
    }
  }

  return best;
}

function pickAssistLineForSlot(slotIndex, pool, options, currentLines, usedLineKeys, pickedSources = []) {
  if (!Array.isArray(pool) || !pool.length) return null;

  const prev = currentLines[slotIndex - 1] || "";
  const next = currentLines[slotIndex + 1] || "";
  const sampled = shuffleArray(pool).slice(0, Math.min(80, pool.length));

  let best = null;
  let bestScore = -Infinity;

  for (const item of sampled) {
    if (usedLineKeys.has(item.line)) continue;

    // keyword 本体の出現上限を守る
    if (options.keyword) {
      const currentKeywordCount = countKeywordOccurrences(
        currentLines.filter(Boolean),
        options.keyword
      );
      const maxKeywordCount = getKeywordMaxCount(options.keywordMode || "prefer");

      if (
        normalizeLite(item.line).includes(normalizeLite(options.keyword)) &&
        currentKeywordCount >= maxKeywordCount
      ) {
        continue;
      }
    }

    let score = item.score;
    score += scoreLineConnection(prev, item.line, options, slotIndex);
    score += scoreNeighborAffinity(item.line, next, options);
    score += scoreLineVariety(currentLines.filter(Boolean), item.line);
    score += scoreKeywordUsage(
      item.line,
      currentLines.filter(Boolean),
      options.keyword,
      options.keywordMode || "prefer"
    );
    score += scoreKeywordMood(
      item.line,
      options.keyword,
      options.keywordMode || "prefer"
    );
    score += scoreThemeKeywordPenalty(
      item.line,
      currentLines.filter(Boolean),
      options.keyword,
      options.keywordMode || "prefer"
    );

    // 共作モードでも作者・出典の偏りを軽く制御
    const sameAuthorCount = pickedSources.filter(
      (src) => src?.author && src.author === item.source?.author
    ).length;
    const sameCollectionCount = pickedSources.filter(
      (src) => src?.collection && src.collection === item.source?.collection
    ).length;

    score -= sameAuthorCount * 1.0;
    score -= sameCollectionCount * 0.6;

    if (options.fillMode === "tight") {
      const target = [5, 7, 5, 7, 7][slotIndex];
      score += Math.max(0, 8 - Math.abs(countKanaLike(item.line) - target) * 2);
    }

    if (options.fillMode === "classical" && /けり|かな|らむ|けむ|つつ|ぬ/.test(item.line)) {
      score += 2;
    }

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return best;
}

function scoreLineConnection(previousLine, currentLine, options, slotIndex) {
  if (!previousLine) return 0;

  const prevLast = getLineTail(previousLine);
  const currentHead = getLineHead(currentLine);

  let score = 0;
  if (prevLast && currentHead && prevLast !== currentHead) score += 1;

  const prevChars = new Set(splitChars(previousLine));
  const currentChars = new Set(splitChars(currentLine));
  const overlap = [...prevChars].filter((char) => currentChars.has(char)).length;
  score += Math.min(3, overlap * 0.5);

  if (options.shape === "57577") {
    const target = [5, 7, 5, 7, 7][slotIndex];
    score += Math.max(0, 4 - Math.abs(countKanaLike(currentLine) - target));
  }

  return score;
}

function scoreNeighborAffinity(line, neighborLine) {
  if (!neighborLine) return 0;

  const lineChars = new Set(splitChars(line));
  const neighborChars = new Set(splitChars(neighborLine));
  const overlap = [...lineChars].filter((char) => neighborChars.has(char)).length;
  return Math.min(4, overlap * 0.7);
}

function scoreLineVariety(existingLines, candidateLine) {
  const existingJoined = existingLines.join("");
  if (!existingJoined) return 0;

  let penalty = 0;
  if (existingLines.includes(candidateLine)) penalty -= 10;

  const tail = getLineTail(candidateLine, 2);
  const repeatedTailCount = existingLines.filter((line) => getLineTail(line, 2) === tail).length;
  penalty -= repeatedTailCount * 1.5;

  return penalty;
}

function forceInsertKeyword(lines, linePools, keyword) {
  const safeKeyword = normalizeLite(keyword);
  if (!safeKeyword) return null;

  for (let i = 0; i < linePools.length; i++) {
    const candidate = linePools[i].find((item) => normalizeLite(item.line).includes(safeKeyword));
    if (!candidate) continue;

    const cloned = [...lines];
    cloned[i] = candidate.line;
    return { lines: cloned };
  }

  return null;
}

function getPoemLinesFromData(poem) {
  if (Array.isArray(poem.tokens) && poem.tokens.length >= 5) {
    return poem.tokens.slice(0, 5).map((line) => String(line || "").trim()).filter(Boolean);
  }

  if (typeof poem.kana === "string" && poem.kana.trim().includes(" ")) {
    const kanaLines = poem.kana.trim().split(/\s+/).filter(Boolean);
    if (kanaLines.length >= 5) {
      return kanaLines.slice(0, 5);
    }
  }

  return [];
}

function renderGeneratorEmptyState() {
  if (generationElements.generatedPoemMeta) {
    generationElements.generatedPoemMeta.innerHTML = '<span class="filter-chip">まだ生成していません</span>';
  }
  if (generationElements.generatedPoemResult) {
    generationElements.generatedPoemResult.className = "generated-poem-display empty-state";
    generationElements.generatedPoemResult.textContent = "ここに自動生成された一首を表示します。";
  }
  if (generationElements.generatedPoemSource) {
    generationElements.generatedPoemSource.textContent = "後で、使用した条件や参照候補を表示できます。";
  }
}

function renderAssistEmptyState() {
  if (generationElements.assistPoemMeta) {
    generationElements.assistPoemMeta.innerHTML = '<span class="filter-chip">まだ整えていません</span>';
  }
  if (generationElements.assistPoemResult) {
    generationElements.assistPoemResult.className = "generated-poem-display empty-state";
    generationElements.assistPoemResult.textContent = "ここに共作結果を表示します。";
  }
  if (generationElements.assistPoemSource) {
    generationElements.assistPoemSource.textContent = "後で、どの句を固定しどの句を補完したか表示できます。";
  }
}

function renderGeneratedPoem(poem) {
  renderMetaChips(generationElements.generatedPoemMeta, [
    `季節: ${poem.meta.season}`,
    `出典: ${poem.meta.collection}`,
    `作者: ${poem.meta.author}`,
    `語句: ${poem.meta.keyword}`,
    `候補数: ${poem.meta.candidateCount}`,
  ]);

  renderPoemDisplay(generationElements.generatedPoemResult, poem.lines);

  if (generationElements.generatedPoemSource) {
    generationElements.generatedPoemSource.innerHTML = poem.sourceMemo;
  }
}

function renderAssistPoem(poem) {
  renderMetaChips(generationElements.assistPoemMeta, [
    `季節: ${poem.meta.season}`,
    `出典: ${poem.meta.collection}`,
    `作者: ${poem.meta.author}`,
    `語句: ${poem.meta.keyword}`,
    `固定句数: ${poem.meta.fixedCount}`,
    `固定位置: ${poem.meta.fixedSlots.join("・") || "なし"}`,
  ]);

  renderPoemDisplay(generationElements.assistPoemResult, poem.lines);

  if (generationElements.assistPoemSource) {
    generationElements.assistPoemSource.innerHTML = poem.sourceMemo;
  }
}

function renderGeneratorFailure(message) {
  if (generationElements.generatedPoemResult) {
    generationElements.generatedPoemResult.className = "generated-poem-display empty-state";
    generationElements.generatedPoemResult.textContent = message;
  }
}

function renderAssistFailure(message) {
  if (generationElements.assistPoemResult) {
    generationElements.assistPoemResult.className = "generated-poem-display empty-state";
    generationElements.assistPoemResult.textContent = message;
  }
}

function renderMetaChips(container, items) {
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  items.filter(Boolean).forEach((item) => {
    const span = document.createElement("span");
    span.className = "filter-chip";
    span.textContent = item;
    fragment.appendChild(span);
  });

  container.appendChild(fragment);
}

function renderPoemDisplay(container, lines) {
  if (!container || lines.length < 5) return;

  container.className = "generated-poem-display";
  
  // 1-3句を上の句、4-5句を下の句として結合
  const kami = lines.slice(0, 3).join(" ");
  const shimo = lines.slice(3, 5).join(" ");

  container.innerHTML = `
    <div class="waka-v-container">
      <div class="waka-kami">
        <span>${escapeHtml(kami)}</span>
      </div>
      <div class="waka-shimo">
        <span>${escapeHtml(shimo)}</span>
      </div>
    </div>
  `;
}

function buildSourceMemo(sourcePoems, options) {
  const uniqueSources = uniquePoems(sourcePoems);
  const sourceItems = uniqueSources.slice(0, 8).map((poem) => {
    const parts = [poem.collection, poem.author, poem.ref_no].filter(Boolean);
    return `<li>${escapeHtml(parts.join(" / "))}</li>`;
  }).join("");

  return `
    <p>条件: ${escapeHtml([options.season, options.collection, options.author, options.keyword].filter(Boolean).join(" ｜ ") || "指定なし")}</p>
    <p>候補の扱い: ${escapeHtml(options.relaxedLabel || "通常")}</p>
    <ul>${sourceItems || "<li>参照候補なし</li>"}</ul>
  `;
}

function buildAssistSourceMemo(options, sourcePoems) {
  const fixedLines = options.userLines
    .map((line, index) => line ? `${index + 1}句: ${line}` : "")
    .filter(Boolean);

  const sourceItems = uniquePoems(sourcePoems).slice(0, 8).map((poem) => {
    const parts = [poem.collection, poem.author, poem.ref_no].filter(Boolean);
    return `<li>${escapeHtml(parts.join(" / "))}</li>`;
  }).join("");

  return `
    <p>固定した句: ${escapeHtml(fixedLines.join(" ｜ ") || "なし")}</p>
    <p>条件: ${escapeHtml([options.season, options.collection, options.author, options.keyword].filter(Boolean).join(" ｜ ") || "指定なし")}</p>
    <ul>${sourceItems || "<li>補完候補なし</li>"}</ul>
  `;
}

function uniquePoems(poems) {
  const seen = new Set();
  return poems.filter((poem) => {
    const key = poem?.id || `${poem?.collection || ""}:${poem?.ref_no || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resetAssistInputs() {
  [
    generationElements.assistLine1,
    generationElements.assistLine2,
    generationElements.assistLine3,
    generationElements.assistLine4,
    generationElements.assistLine5,
  ].forEach((input) => {
    if (input) input.value = "";
  });

  if (generationElements.assistKeywordInput) generationElements.assistKeywordInput.value = "";
  if (generationElements.assistSeasonFilter) generationElements.assistSeasonFilter.value = "";
  if (generationElements.assistCollectionFilter) generationElements.assistCollectionFilter.value = "";
  if (generationElements.assistAuthorFilter) generationElements.assistAuthorFilter.value = "";
  if (generationElements.assistFillModeSelect) generationElements.assistFillModeSelect.value = "natural";

  renderAssistEmptyState();
}

function presetAssistFirstLineOnly() {
  resetAssistInputs();
  generationElements.assistLine1.value = "春の野に";
}

function presetAssistLastLineOnly() {
  resetAssistInputs();
  generationElements.assistLine5.value = "名こそ惜しけれ";
}

function presetAssistRandomSlots() {
  resetAssistInputs();

  const count = Math.floor(Math.random() * 4) + 1;
  const slotIndexes = shuffleArray([0, 1, 2, 3, 4]).slice(0, count).sort((a, b) => a - b);
  const randomPoem = state.poems.filter((poem) => getPoemLinesFromData(poem).length >= 5)[Math.floor(Math.random() * state.poems.length)];
  const lines = randomPoem ? getPoemLinesFromData(randomPoem) : [];

  slotIndexes.forEach((slotIndex) => {
    const input = generationElements[`assistLine${slotIndex + 1}`];
    if (input) input.value = lines[slotIndex] || "";
  });
}

async function copyPoemResult(mode) {
  const poem = mode === "assist"
    ? generationState.currentAssistPoem
    : generationState.currentGeneratedPoem;

  if (!poem || !poem.lines?.length) return;

  const text = poem.lines.join("\n");

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.warn("コピーに失敗しました", error);
  }
}

function savePoemCandidate(mode) {
  const poem = mode === "assist"
    ? generationState.currentAssistPoem
    : generationState.currentGeneratedPoem;

  if (!poem || !poem.lines?.length) return;

  const key = "wakaSavedCandidates";
  const saved = safeJsonParse(localStorage.getItem(key), []);
  saved.unshift({
    mode,
    lines: poem.lines,
    meta: poem.meta,
    savedAt: new Date().toISOString(),
  });

  localStorage.setItem(key, JSON.stringify(saved.slice(0, 50)));
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function countKanaLike(text) {
  return String(text || "")
    .replace(/[\s　]/g, "")
    .replace(/[、。・]/g, "")
    .length;
}

function getLineHead(text, size = 2) {
  return String(text || "").trim().slice(0, size);
}

function getLineTail(text, size = 2) {
  const value = String(text || "").trim();
  return value.slice(Math.max(0, value.length - size));
}

function splitChars(text) {
  return [...String(text || "").replace(/[\s　]/g, "")];
}

function normalizeLite(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .toLowerCase();
}

function shuffleArray(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function resolveGenerationCandidates(options = {}) {
  const strict = getPoemsByConditions(options);

  // 条件そのままで十分ある
  if (strict.length >= GENERATION_MIN_CANDIDATES || options.forceRandom) {
    return {
      candidates: strict,
      coreCandidates: strict,
      relaxedLevel: 0,
      label: "条件をそのまま使用",
      mustKeepAuthor: !!options.author && strict.some((poem) => poem.author === options.author),
    };
  }

  // 作者指定があり、本人候補が1首でもあるなら「核」として保持
  if (options.author && strict.length > 0) {
    const relatives = getPoemsByConditions({
      ...options,
      author: ""
    });

    const merged = uniquePoemList([...strict, ...relatives]);

    return {
      candidates: merged,
      coreCandidates: strict,
      relaxedLevel: 1,
      label: `${options.author}の句を核に、条件に合う句を補完`,
      mustKeepAuthor: true,
    };
  }

  // 作者条件だけ外す
  const noAuthor = getPoemsByConditions({ ...options, author: "" });
  if (noAuthor.length >= GENERATION_SOFT_MIN_CANDIDATES) {
    return {
      candidates: noAuthor,
      coreCandidates: [],
      relaxedLevel: 2,
      label: "作者条件を緩和",
      mustKeepAuthor: false,
    };
  }

  // 作者・出典を外す
  const noColl = getPoemsByConditions({ ...options, author: "", collection: "" });
  if (noColl.length >= GENERATION_SOFT_MIN_CANDIDATES) {
    return {
      candidates: noColl,
      coreCandidates: [],
      relaxedLevel: 3,
      label: "作者・出典条件を緩和",
      mustKeepAuthor: false,
    };
  }

  // 最後は全体
  return {
    candidates: state.poems.filter((p) => getPoemLinesFromData(p).length >= 5),
    coreCandidates: [],
    relaxedLevel: 4,
    label: "全体からランダム",
    mustKeepAuthor: false,
  };
}

function countKeywordInLines(lines, keyword) {
  const safeKeyword = normalizeLite(keyword);
  if (!safeKeyword) return 0;

  return lines.reduce((count, line) => {
    return count + (normalizeLite(line).includes(safeKeyword) ? 1 : 0);
  }, 0);
}

function enforceMustKeyword(lines, linePools, keyword, lockedLines = []) {
  if (countKeywordInLines(lines, keyword) >= 1) {
    return lines;
  }

  const safeKeyword = normalizeLite(keyword);
  if (!safeKeyword) return lines;

  for (let i = 0; i < linePools.length; i++) {
    if (lockedLines[i]) continue;

    const candidate = linePools[i].find((item) =>
      normalizeLite(item.line).includes(safeKeyword)
    );

    if (!candidate) continue;

    const cloned = [...lines];
    cloned[i] = candidate.line;
    return cloned;
  }

  return null;
}

function scoreKeywordUsage(candidateLine, currentLines, keyword, keywordMode) {
  if (!keyword || keywordMode === "theme") return 0;

  const safeKeyword = normalizeLite(keyword);
  const includesKeyword = normalizeLite(candidateLine).includes(safeKeyword);
  const currentCount = countKeywordInLines(currentLines, keyword);

  if (!includesKeyword) {
    if (keywordMode === "must" && currentCount === 0) {
      return 0;
    }
    return 0;
  }

  if (currentCount === 0) {
    return keywordMode === "must" ? 10 : 5;
  }

  if (currentCount === 1) {
    return -6;
  }

  return -14;
}

function scoreKeywordMood(candidateLine, keyword, keywordMode) {
  if (!keyword || keywordMode !== "theme") return 0;

  const assoc = keywordAssociations[keyword] || [];
  const normalizedLine = normalizeLite(candidateLine);

  let score = 0;

  for (const word of assoc) {
    if (normalizedLine.includes(normalizeLite(word))) {
      score += 3;
    }
  }

  // themeでは本体語はむしろ出ない方が自然
  if (normalizedLine.includes(normalizeLite(keyword))) {
    score -= 8;
  }

  return score;
}

function buildLinePools(poems, options) {
  const pools = [[], [], [], [], []];
  poems.forEach((poem) => {
    const lines = getPoemLinesFromData(poem);
    if (lines.length < 5) return;
    lines.slice(0, 5).forEach((line, i) => {
      pools[i].push({ line, source: poem, score: scoreLine(line, poem, options, i) });
    });
  });
  // スコア順にソート
  return pools.map(pool => pool.sort((a, b) => b.score - a.score));
}

function countKeywordOccurrences(lines, keyword) {
  const safeKeyword = normalizeLite(keyword);
  if (!safeKeyword) return 0;

  return lines.reduce((total, line) => {
    return total + (normalizeLite(line).includes(safeKeyword) ? 1 : 0);
  }, 0);
}

function getKeywordMaxCount(keywordMode) {
  if (keywordMode === "must") return 1;
  if (keywordMode === "prefer") return 1;
  if (keywordMode === "theme") return 0;
  return 1;
}

function scoreThemeKeywordPenalty(candidateLine, currentLines, keyword, keywordMode) {
  if (!keyword) return 0;

  const safeKeyword = normalizeLite(keyword);
  const includesKeyword = normalizeLite(candidateLine).includes(safeKeyword);
  const currentCount = countKeywordOccurrences(currentLines, keyword);

  if (keywordMode === "must") {
    if (!includesKeyword) return 0;
    if (currentCount === 0) return 6;
    return -40;
  }

  if (keywordMode === "prefer") {
    if (!includesKeyword) return 0;
    if (currentCount === 0) return 2;
    return -35;
  }

  if (keywordMode === "theme") {
    if (!includesKeyword) return 0;
    return -50;
  }

  return 0;
}

function scoreWholePoemKeywordBalance(lines, keyword, keywordMode) {
  if (!keyword) return 0;

  const count = countKeywordOccurrences(lines, keyword);

  if (keywordMode === "must") {
    if (count === 1) return 30;
    if (count === 0) return -80;
    if (count === 2) return -60;
    return -120;
  }

  if (keywordMode === "prefer") {
    if (count === 0) return 8;
    if (count === 1) return 16;
    if (count === 2) return -45;
    return -100;
  }

  if (keywordMode === "theme") {
    if (count === 0) return 20;
    if (count === 1) return -20;
    return -100;
  }

  return 0;
}

function uniquePoemList(list) {
  const seen = new Set();

  return list.filter((poem) => {
    const key = poem?.id || `${poem?.collection || ""}:${poem?.ref_no || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickForcedAssistAuthorSlot(linePools, options, userLines, mustKeepAuthor) {
  if (!mustKeepAuthor || !options.author) return -1;

  const availableSlots = [];

  for (let i = 0; i < 5; i++) {
    if (userLines[i]) continue;

    const authorPool = linePools[i].filter(
      (item) => item.source?.author === options.author
    );

    if (authorPool.length > 0) {
      availableSlots.push(i);
    }
  }

  if (!availableSlots.length) return -1;

  return availableSlots[Math.floor(Math.random() * availableSlots.length)];
}

function assistHasAuthorLine(lines, pickedSources, options) {
  if (!options.author) return true;

  return pickedSources.some((src) => src?.author === options.author);
}

function enforceAssistAuthorLine(lines, pickedSources, linePools, options, userLockedSlots = []) {
  if (!options.author) return false;

  // すでに作者句が入っていれば何もしない
  if (pickedSources.some((src) => src?.author === options.author)) {
    return true;
  }

  for (let i = 0; i < 5; i++) {
    if (userLockedSlots[i]) continue;

    const authorOnlyPool = linePools[i].filter(
      (item) => item.source?.author === options.author
    );

    if (!authorOnlyPool.length) continue;

    const replacement = authorOnlyPool[0];
    lines[i] = replacement.line;
    pickedSources[i] = replacement.source;
    return true;
  }

  return false;
}

initializeGenerationModes();
