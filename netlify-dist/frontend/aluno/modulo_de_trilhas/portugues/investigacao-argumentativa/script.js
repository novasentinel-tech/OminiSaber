(() => {
  let selected = null;
  const assignments = {};
  const passages = [...document.querySelectorAll('.passage[draggable="true"]')];
  const slots = [...document.querySelectorAll("[data-slot]")];

  const selectPassage = (passage) => {
    passages.forEach((item) =>
      item.classList.toggle("selected", item === passage),
    );
    selected = passage;
  };
  const assign = (slot, passage) => {
    if (!passage)
      return window.OminiPortuguese.toast(
        "Primeiro, selecione um trecho do texto.",
      );
    Object.keys(assignments).forEach((key) => {
      if (assignments[key] === passage.id) delete assignments[key];
    });
    assignments[slot.dataset.slot] = passage.id;
    slots.forEach((item) => {
      const assignedId = assignments[item.dataset.slot];
      const assigned = assignedId && document.getElementById(assignedId);
      item.classList.toggle("filled", Boolean(assigned));
      if (assigned)
        item.querySelector(".slot-body").textContent =
          assigned.textContent.slice(0, 112) +
          (assigned.textContent.length > 112 ? "…" : "");
      else item.querySelector(".slot-body").textContent = "Selecione um trecho";
    });
    selected = null;
    passages.forEach((item) => item.classList.remove("selected"));
  };
  passages.forEach((passage) => {
    passage.addEventListener("click", () => selectPassage(passage));
    passage.addEventListener("dragstart", (event) =>
      event.dataTransfer.setData("text/plain", passage.id),
    );
  });
  slots.forEach((slot) => {
    slot
      .querySelector(".slot-body")
      .addEventListener("click", () => assign(slot, selected));
    slot.addEventListener("dragover", (event) => event.preventDefault());
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      assign(
        slot,
        document.getElementById(event.dataTransfer.getData("text/plain")),
      );
    });
  });
  document.querySelector("[data-reset]").addEventListener("click", () => {
    Object.keys(assignments).forEach((key) => delete assignments[key]);
    slots.forEach((slot) => {
      slot.classList.remove("filled");
      slot.querySelector(".slot-body").textContent = "Selecione um trecho";
    });
    document.querySelector("#reasoning").value = "";
    document.querySelector("[data-feedback]").textContent = "";
  });
  document.querySelector("[data-validate]").addEventListener("click", () => {
    const allFilled = slots.every((slot) => assignments[slot.dataset.slot]);
    const allCorrect = slots.every(
      (slot) => assignments[slot.dataset.slot] === slot.dataset.expected,
    );
    const reasoning = document.querySelector("#reasoning").value.trim();
    const feedback = document.querySelector("[data-feedback]");
    if (!allFilled || reasoning.length < 25) {
      feedback.className = "feedback error";
      feedback.textContent =
        "Associe os cinco trechos e explique a relação entre evidência e tese em pelo menos uma frase.";
      return;
    }
    if (!allCorrect) {
      feedback.className = "feedback error";
      feedback.textContent =
        "Algumas funções ainda estão trocadas. Observe o que o autor defende, como justifica e qual trecho reconhece um ponto contrário.";
      return;
    }
    feedback.className = "feedback success";
    feedback.textContent =
      "Investigação concluída: você reconstruiu a arquitetura argumentativa do texto.";
    window.OminiPortuguese.complete(
      "investigacao-argumentativa",
      "Investigação Argumentativa concluída. Sua leitura relacionou tese, argumentos e evidência.",
    );
  });
})();
