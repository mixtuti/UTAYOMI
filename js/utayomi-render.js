// 表示・保存・共有
(function (global) {
  const utayomi = global.WakaUtayomi;

  utayomi.renderGeneratorEmptyState = function renderGeneratorEmptyState() {
    const els = utayomi.elements;

    if (els.generatedPoemMeta) {
      els.generatedPoemMeta.innerHTML =
        '<span class="filter-chip">まだ生成していません</span>';
    }
    if (els.generatedPoemResult) {
      els.generatedPoemResult.className = "generated-poem-display empty-state";
      els.generatedPoemResult.textContent = "ここに自動生成された一首を表示します。";
    }
    if (els.generatedPoemSource) {
      els.generatedPoemSource.textContent =
        "後で、使用した条件や参照候補を表示できます。";
    }
  };

  utayomi.renderAssistEmptyState = function renderAssistEmptyState() {
    const els = utayomi.elements;

    if (els.assistPoemMeta) {
      els.assistPoemMeta.innerHTML =
        '<span class="filter-chip">まだ整えていません</span>';
    }
    if (els.assistPoemResult) {
      els.assistPoemResult.className = "generated-poem-display empty-state";
      els.assistPoemResult.textContent = "ここに共作結果を表示します。";
    }
    if (els.assistPoemSource) {
      els.assistPoemSource.textContent =
        "後で、どの句を固定しどの句を補完したか表示できます。";
    }
  };

  utayomi.renderGeneratedPoem = function renderGeneratedPoem(poem) {
    utayomi.renderMetaChips(utayomi.elements.generatedPoemMeta, [
      `季節: ${poem.meta.season}`,
      `出典: ${poem.meta.collection}`,
      `作者: ${poem.meta.author}`,
      `語句: ${poem.meta.keyword}`,
      `候補数: ${poem.meta.candidateCount}`,
    ]);

    utayomi.renderPoemDisplay(utayomi.elements.generatedPoemResult, poem.lines);

    if (utayomi.elements.generatedPoemSource) {
      utayomi.elements.generatedPoemSource.innerHTML = poem.sourceMemo;
    }
  };

  utayomi.renderAssistPoem = function renderAssistPoem(poem) {
    utayomi.renderMetaChips(utayomi.elements.assistPoemMeta, [
      `季節: ${poem.meta.season}`,
      `出典: ${poem.meta.collection}`,
      `作者: ${poem.meta.author}`,
      `語句: ${poem.meta.keyword}`,
      `固定句数: ${poem.meta.fixedCount}`,
      `固定位置: ${poem.meta.fixedSlots.join("・") || "なし"}`,
    ]);

    utayomi.renderPoemDisplay(utayomi.elements.assistPoemResult, poem.lines);

    if (utayomi.elements.assistPoemSource) {
      utayomi.elements.assistPoemSource.innerHTML = poem.sourceMemo;
    }
  };

  utayomi.renderGeneratorFailure = function renderGeneratorFailure(message) {
    const target = utayomi.elements.generatedPoemResult;
    if (target) {
      target.className = "generated-poem-display empty-state";
      target.textContent = message;
    }
  };

  utayomi.renderAssistFailure = function renderAssistFailure(message) {
    const target = utayomi.elements.assistPoemResult;
    if (target) {
      target.className = "generated-poem-display empty-state";
      target.textContent = message;
    }
  };

  utayomi.renderMetaChips = function renderMetaChips(container, items) {
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
  };

  // 1-3句 / 4-5句 に分けて縦書き表示へ流し込む
  utayomi.renderPoemDisplay = function renderPoemDisplay(container, lines) {
    if (!container || lines.length < 5) return;

    container.className = "generated-poem-display";

    const kami = lines.slice(0, 3).join(" ");
    const shimo = lines.slice(3, 5).join(" ");

    container.innerHTML = `
      <div class="waka-v-container">
        <div class="waka-kami">
          <span>${utayomi.escapeHtml(kami)}</span>
        </div>
        <div class="waka-shimo">
          <span>${utayomi.escapeHtml(shimo)}</span>
        </div>
      </div>
    `;
  };

  utayomi.buildSourceMemo = function buildSourceMemo(sourcePoems, options) {
    const uniqueSources = utayomi.uniquePoems(sourcePoems);
    const sourceItems = uniqueSources
      .slice(0, 8)
      .map((poem) => {
        const parts = [poem.collection, poem.author, poem.ref_no].filter(Boolean);
        return `<li>${utayomi.escapeHtml(parts.join(" / "))}</li>`;
      })
      .join("");

    return `
      <p>条件: ${utayomi.escapeHtml(
        [options.season, options.collection, options.author, options.keyword]
          .filter(Boolean)
          .join(" ｜ ") || "指定なし"
      )}</p>
      <p>候補の扱い: ${utayomi.escapeHtml(options.relaxedLabel || "通常")}</p>
      <ul>${sourceItems || "<li>参照候補なし</li>"}</ul>
    `;
  };

  utayomi.buildAssistSourceMemo = function buildAssistSourceMemo(options, sourcePoems) {
    const fixedLines = options.userLines
      .map((line, index) => (line ? `${index + 1}句: ${line}` : ""))
      .filter(Boolean);

    const sourceItems = utayomi.uniquePoems(sourcePoems)
      .slice(0, 8)
      .map((poem) => {
        const parts = [poem.collection, poem.author, poem.ref_no].filter(Boolean);
        return `<li>${utayomi.escapeHtml(parts.join(" / "))}</li>`;
      })
      .join("");

    return `
      <p>固定した句: ${utayomi.escapeHtml(fixedLines.join(" ｜ ") || "なし")}</p>
      <p>条件: ${utayomi.escapeHtml(
        [options.season, options.collection, options.author, options.keyword]
          .filter(Boolean)
          .join(" ｜ ") || "指定なし"
      )}</p>
      <ul>${sourceItems || "<li>補完候補なし</li>"}</ul>
    `;
  };

  utayomi.copyPoemResult = async function copyPoemResult(mode) {
    const poem =
      mode === "assist"
        ? utayomi.state.currentAssistPoem
        : utayomi.state.currentGeneratedPoem;

    if (!poem || !poem.lines?.length) return;

    try {
      await navigator.clipboard.writeText(poem.lines.join("\n"));
    } catch (error) {
      console.warn("コピーに失敗しました", error);
    }
  };

  utayomi.savePoemCandidate = function savePoemCandidate(mode) {
    const poem =
      mode === "assist"
        ? utayomi.state.currentAssistPoem
        : utayomi.state.currentGeneratedPoem;

    if (!poem || !poem.lines?.length) return;

    const key = "wakaSavedCandidates";
    const saved = utayomi.safeJsonParse(localStorage.getItem(key), []);
    saved.unshift({
      mode,
      lines: poem.lines,
      meta: poem.meta,
      savedAt: new Date().toISOString(),
    });

    localStorage.setItem(key, JSON.stringify(saved.slice(0, 50)));
  };

  utayomi.getCurrentPoemData = function getCurrentPoemData(mode) {
    if (mode === "generator") return utayomi.state.currentGeneratedPoem;
    if (mode === "assist") return utayomi.state.currentAssistPoem;
    return null;
  };

  utayomi.getPoemDisplayElement = function getPoemDisplayElement(mode) {
    return mode === "generator"
      ? utayomi.elements.generatedPoemResult
      : utayomi.elements.assistPoemResult;
  };

  utayomi.buildPoemPlainText = function buildPoemPlainText(poemData) {
    if (!poemData?.lines?.length) return "";
    return poemData.lines.join("\n");
  };

  utayomi.buildShareText = function buildShareText(poemData) {
    if (!poemData?.lines?.length) return "";
    const poemText = poemData.lines.join("\n");
    return `${poemText}\n\n#和歌 #短歌 #和歌コーパス検索`;
  };

  utayomi.downloadPoemImage = async function downloadPoemImage(mode) {
    const poemData = utayomi.getCurrentPoemData(mode);
    const target = utayomi.getPoemDisplayElement(mode);

    if (!poemData?.lines?.length || !target) {
      alert("先に和歌を生成してください。");
      return;
    }

    if (typeof html2canvas === "undefined") {
      alert("画像保存ライブラリの読み込みに失敗しました。");
      return;
    }

    const filename = mode === "generator" ? "generated-waka.png" : "assist-waka.png";

    try {
      target.classList.add("capture-mode");

      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      target.classList.remove("capture-mode");

      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      target.classList.remove("capture-mode");
      console.error(error);
      alert("画像保存に失敗しました。");
    }
  };

  utayomi.sharePoemToX = function sharePoemToX(mode) {
    const poemData = utayomi.getCurrentPoemData(mode);

    if (!poemData?.lines?.length) {
      alert("先に和歌を生成してください。");
      return;
    }

    const text = utayomi.buildShareText(poemData);
    const shareUrl = `${location.origin}${location.pathname}`;

    const url =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(text) +
      "&url=" +
      encodeURIComponent(shareUrl);

    window.open(url, "_blank", "noopener,noreferrer");
  };
})(window);
