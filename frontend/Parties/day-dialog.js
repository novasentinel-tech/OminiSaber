/* Shared accessible day-details surface: modal on desktop, sheet on mobile. */
(() => {
  window.OminiDayDialog = {
    create() {
      const element = document.createElement("dialog");
      element.className = "os-day-dialog";
      element.setAttribute("aria-labelledby", "os-day-title");
      element.setAttribute("aria-describedby", "os-day-count");
      element.innerHTML = '<div class="os-day-handle" aria-hidden="true"></div><header class="os-day-head"><span class="os-day-number" data-day-number aria-hidden="true"></span><div><p>SEUS COMPROMISSOS</p><h2 id="os-day-title"></h2><span id="os-day-count"></span></div><button type="button" class="icon-button" data-close-day aria-label="Fechar detalhes do dia" autofocus><span class="material-symbols-outlined" aria-hidden="true">close</span></button></header><div class="os-day-content"></div><footer>Horários exibidos no seu fuso local.</footer>';
      document.body.append(element);
      let trigger;
      const close = () => element.close();
      element.querySelector("[data-close-day]").addEventListener("click", close);
      let backdropStart = false;
      const outside = e => {
        const r=element.getBoundingClientRect();
        return e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom;
      };
      element.addEventListener("pointerdown", e => { backdropStart=e.target===element && outside(e); });
      element.addEventListener("click", e => { if(backdropStart && e.target===element && outside(e))close();backdropStart=false; });
      element.addEventListener("close", () => {
        document.body.classList.remove("os-day-dialog-open");
        if(trigger?.isConnected)trigger.focus({preventScroll:true});
      });
      return {
        element,
        title:element.querySelector("h2"),
        count:element.querySelector("#os-day-count"),
        number:element.querySelector("[data-day-number]"),
        content:element.querySelector(".os-day-content"),
        open(source) {
          trigger=source || document.activeElement;
          if(!element.open)element.showModal();
          document.body.classList.add("os-day-dialog-open");
        }
      };
    }
  };
})();
