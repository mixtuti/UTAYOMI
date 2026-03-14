// タブ切り替え・イベント登録
(function (global) {
  const utayomi = global.WakaUtayomi;

  utayomi.setModeTab = function setModeTab(mode) {
    const els = utayomi.elements;
    utayomi.state.currentTab = mode;

    const isGenerator = mode === "generator";
    const isGeneratorV2 = mode === "generator-v2";
    const isAssist = mode === "assist";

    if (els.generatorTabButton) {
      els.generatorTabButton.className = isGenerator ? "button" : "button secondary";
      els.generatorTabButton.setAttribute("aria-pressed", String(isGenerator));
    }

    if (els.generatorV2TabButton) {
      els.generatorV2TabButton.className = isGeneratorV2 ? "button" : "button secondary";
      els.generatorV2TabButton.setAttribute("aria-pressed", String(isGeneratorV2));
    }

    if (els.assistTabButton) {
      els.assistTabButton.className = isAssist ? "button" : "button secondary";
      els.assistTabButton.setAttribute("aria-pressed", String(isAssist));
    }

    if (els.generatorModePanel) els.generatorModePanel.hidden = !isGenerator;
    if (els.generatorV2ModePanel) els.generatorV2ModePanel.hidden = !isGeneratorV2;
    if (els.assistModePanel) els.assistModePanel.hidden = !isAssist;
  };

  // 生成画面で使うイベントをまとめて接続する
  utayomi.bindEvents = function bindGenerationEvents() {
    const els = utayomi.elements;

    els.generatorTabButton?.addEventListener("click", () => utayomi.setModeTab("generator"));
    els.assistTabButton?.addEventListener("click", () => utayomi.setModeTab("assist"));
    els.generatorV2TabButton?.addEventListener("click", () => utayomi.setModeTab("generator-v2"));

    els.generateAutoPoemButton?.addEventListener("click", utayomi.handleGenerateAutoPoem);
    els.generateRandomPoemButton?.addEventListener("click", utayomi.handleGenerateRandomPoem);
    els.copyGeneratedPoemButton?.addEventListener("click", () => utayomi.copyPoemResult("generator"));
    els.saveGeneratedPoemButton?.addEventListener("click", () => utayomi.savePoemCandidate("generator"));

    els.assistGenerateButton?.addEventListener("click", utayomi.handleAssistGenerate);
    els.assistResetButton?.addEventListener("click", utayomi.resetAssistInputs);
    els.assistPresetFirstLineButton?.addEventListener("click", utayomi.presetAssistFirstLineOnly);
    els.assistPresetLastLineButton?.addEventListener("click", utayomi.presetAssistLastLineOnly);
    els.assistPresetRandomSlotsButton?.addEventListener("click", utayomi.presetAssistRandomSlots);
    els.copyAssistPoemButton?.addEventListener("click", () => utayomi.copyPoemResult("assist"));
    els.saveAssistPoemButton?.addEventListener("click", () => utayomi.savePoemCandidate("assist"));

    els.generatorUseAuthorThresholdToggle?.addEventListener(
      "change",
      utayomi.refreshGeneratorAuthorsByThreshold
    );

    els.downloadGeneratedPoemImageButton?.addEventListener("click", () =>
      utayomi.downloadPoemImage("generator")
    );
    els.shareGeneratedPoemButton?.addEventListener("click", () =>
      utayomi.sharePoemToX("generator")
    );

    els.downloadAssistPoemImageButton?.addEventListener("click", () =>
      utayomi.downloadPoemImage("assist")
    );
    els.shareAssistPoemButton?.addEventListener("click", () =>
      utayomi.sharePoemToX("assist")
    );
  };
})(window);
