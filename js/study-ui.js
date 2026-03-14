// イベント登録
(function (global) {
  const study = global.WakaStudy;

  study.bindEvents = function bindEvents() {
    const els = study.elements;

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      study.search(els.input.value);
    });

    if (els.moreButton) {
      els.moreButton.hidden = true;
      els.moreButton.disabled = true;

      els.moreButton.addEventListener("click", () => {
        if (!study.state.lastExamples.length) return;
        study.renderExamples(study.state.lastExamples, study.state.lastTerms);
      });
    }
  };
})(window);
