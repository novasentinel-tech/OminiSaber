(() => {
  if (window.OminiSelect?.version) return;

  const states = new WeakMap();
  let active = null;

  const iconFor = (text = "") => {
    const value = text.toLocaleLowerCase("pt-BR");
    if (/turma|série|ano/.test(value)) return "groups";
    if (/matéria|disciplina|componente|portugu|matem|física|química/.test(value)) return "menu_book";
    if (/trimestre|período|data|versão/.test(value)) return "calendar_month";
    if (/nível|dificuldade|desempenho/.test(value)) return "signal_cellular_alt";
    if (/etapa|bloco|atividade|percurso/.test(value)) return "route";
    if (/sim|não|condição|resposta/.test(value)) return "checklist";
    return "radio_button_checked";
  };

  const labelFor = (select) => {
    const label = select.labels?.[0] || select.closest("label");
    if (label) {
      const copy = label.cloneNode(true);
      copy.querySelectorAll("select,input,textarea,button,.os-select").forEach((control) => control.remove());
      const text = copy.textContent.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return select.getAttribute("aria-label") || "Selecionar opção";
  };

  const selectedOption = (select) => select.options[select.selectedIndex] || select.options[0];

  const close = (restoreFocus = false) => {
    if (!active) return;
    const { wrapper, trigger, popover, backdrop } = active;
    wrapper.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    popover.remove();
    backdrop?.remove();
    document.body.classList.remove("os-select-open");
    active = null;
    if (restoreFocus) trigger.focus();
  };

  const place = (trigger, popover) => {
    if (matchMedia("(max-width: 680px)").matches) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 10;
    const width = Math.min(Math.max(rect.width, 230), innerWidth - margin * 2);
    popover.style.width = `${width}px`;
    popover.style.left = `${Math.min(Math.max(margin, rect.left), innerWidth - width - margin)}px`;
    const roomBelow = innerHeight - rect.bottom - margin;
    const desired = Math.min(360, popover.scrollHeight || 360);
    popover.style.top = roomBelow >= Math.min(desired, 220)
      ? `${rect.bottom + 7}px`
      : `${Math.max(margin, rect.top - desired - 7)}px`;
  };

  const sync = (select) => {
    const state = states.get(select);
    if (!state) return;
    const option = selectedOption(select);
    state.value.textContent = option?.textContent?.trim() || "Selecione";
    state.caption.textContent = option?.dataset.description || select.dataset.description || state.label;
    state.trigger.disabled = select.disabled;
    state.trigger.setAttribute("aria-disabled", String(select.disabled));
  };

  const choose = (select, option) => {
    if (option.disabled) return;
    const changed = select.value !== option.value;
    select.value = option.value;
    sync(select);
    close(true);
    if (changed) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  const open = (select) => {
    const state = states.get(select);
    if (!state || select.disabled) return;
    if (active?.select === select) { close(true); return; }
    close(false);
    sync(select);

    const popover = document.createElement("div");
    popover.className = "os-select-popover";
    popover.id = `${state.id}-listbox`;
    popover.setAttribute("role", "listbox");
    popover.setAttribute("aria-label", state.label);
    const selected = selectedOption(select);
    let optionIndex = 0;

    [...select.children].forEach((child) => {
      if (child instanceof HTMLOptGroupElement) {
        const group = document.createElement("div");
        group.className = "os-select-group";
        group.textContent = child.label;
        popover.append(group);
        [...child.children].forEach((option) => popover.append(buildOption(option)));
      } else if (child instanceof HTMLOptionElement) {
        popover.append(buildOption(child));
      }
    });

    function buildOption(option) {
      const button = document.createElement("button");
      const currentIndex = optionIndex++;
      button.type = "button";
      button.className = "os-select-option";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option === selected));
      button.dataset.optionIndex = String(currentIndex);
      button.disabled = option.disabled;
      const description = option.dataset.description || "";
      button.innerHTML = `<span class="material-symbols-outlined os-select-option-icon" aria-hidden="true">${option.dataset.icon || iconFor(option.textContent)}</span><span class="os-select-option-copy"><strong></strong>${description ? "<small></small>" : ""}</span><span class="material-symbols-outlined os-select-check" aria-hidden="true">check</span>`;
      button.querySelector("strong").textContent = option.textContent.trim();
      if (description) button.querySelector("small").textContent = description;
      button.addEventListener("click", () => choose(select, option));
      return button;
    }

    if (!popover.querySelector(".os-select-option")) {
      popover.innerHTML = '<div class="os-select-empty">Nenhuma opção disponível.</div>';
    }

    const topLayerHost = state.trigger.closest("dialog[open]") || document.body;
    let backdrop = null;
    if (matchMedia("(max-width: 680px)").matches) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "os-select-mobile-backdrop";
      backdrop.setAttribute("aria-label", "Fechar opções");
      backdrop.addEventListener("click", () => close(true));
      topLayerHost.append(backdrop);
    }
    topLayerHost.append(popover);
    popover.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
    popover.addEventListener("touchmove", (event) => event.stopPropagation(), { passive: true });
    state.wrapper.classList.add("is-open");
    state.trigger.setAttribute("aria-expanded", "true");
    state.trigger.setAttribute("aria-controls", popover.id);
    document.body.classList.add("os-select-open");
    active = { ...state, select, popover, backdrop };
    place(state.trigger, popover);
    const selectedButton = popover.querySelector('[aria-selected="true"]');
    selectedButton?.scrollIntoView({ block: "nearest" });
  };

  const enhance = (select) => {
    if (!(select instanceof HTMLSelectElement) || states.has(select) || select.multiple || select.size > 1 || select.dataset.nativeSelect !== undefined) return;
    const accessibleLabel = labelFor(select);
    const wrapper = document.createElement("span");
    wrapper.className = "os-select";
    const id = `os-select-${Math.random().toString(36).slice(2, 9)}`;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "os-select-trigger";
    trigger.id = `${id}-button`;
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", accessibleLabel);
    trigger.innerHTML = '<span class="os-select-copy"><span class="os-select-value"></span><span class="os-select-caption"></span></span><span class="material-symbols-outlined os-select-chevron" aria-hidden="true">expand_more</span>';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger);
    select.classList.add("os-select-native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    const state = { id, select, wrapper, trigger, label: accessibleLabel, value: trigger.querySelector(".os-select-value"), caption: trigger.querySelector(".os-select-caption") };
    states.set(select, state);
    sync(select);
    trigger.addEventListener("click", () => open(select));
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); open(select); }
    });
    select.addEventListener("change", () => sync(select));
    new MutationObserver(() => { sync(select); if (active?.select === select) { close(false); open(select); } }).observe(select, { childList: true, subtree: true, attributes: true });
  };

  const scan = (root = document) => {
    root.querySelectorAll?.("select").forEach(enhance);
    if (root instanceof HTMLSelectElement) enhance(root);
  };

  document.addEventListener("pointerdown", (event) => {
    if (active && !active.popover.contains(event.target) && !active.trigger.contains(event.target)) close(false);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!active) return;
    const buttons = [...active.popover.querySelectorAll(".os-select-option:not(:disabled)")];
    const current = Math.max(0, buttons.indexOf(document.activeElement));
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "ArrowDown") { event.preventDefault(); buttons[(current + 1) % buttons.length]?.focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); buttons[(current - 1 + buttons.length) % buttons.length]?.focus(); }
    else if (event.key === "Home") { event.preventDefault(); buttons[0]?.focus(); }
    else if (event.key === "End") { event.preventDefault(); buttons.at(-1)?.focus(); }
  });
  document.addEventListener("close", (event) => {
    if (active && event.target instanceof HTMLDialogElement && event.target.contains(active.popover)) close(false);
  }, true);
  addEventListener("resize", () => active && place(active.trigger, active.popover));
  addEventListener("scroll", () => active && place(active.trigger, active.popover), true);

  scan();
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => node instanceof Element && scan(node)))).observe(document.body, { childList: true, subtree: true });
  window.OminiSelect = { version: "1.0.0", enhance, scan, close, sync };
})();
