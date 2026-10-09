(() => {
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category;
      document
        .querySelectorAll(".category-nav button")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      document
        .querySelectorAll("[data-discipline]")
        .forEach((card) =>
          card.classList.toggle(
            "is-filtered",
            category !== "todos" && card.dataset.category !== category,
          ),
        );
    });
  });
  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.OminiSaber?.configured) return;
    const profile = await window.OminiSaber.getProfile().catch(() => null);
    const avatar = document.querySelector(".avatar");
    if (avatar && profile?.nome)
      avatar.textContent = profile.nome
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
  });
})();
