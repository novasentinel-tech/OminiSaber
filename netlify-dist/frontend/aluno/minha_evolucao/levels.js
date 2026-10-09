(() => {
  const levels = [
    {
      number: 1,
      name: "Curiosa",
      threshold: 0,
      icon: "flag",
      description: "Você começou a transformar curiosidade em conhecimento.",
      requirement: "Inicie sua jornada no OminiSaber.",
    },
    {
      number: 2,
      name: "Leitora",
      threshold: 500,
      icon: "menu_book",
      description: "Você amplia repertórios por meio da leitura e do estudo.",
      requirement: "Acumule 500 XP.",
    },
    {
      number: 3,
      name: "Exploradora",
      threshold: 1000,
      icon: "travel_explore",
      description: "Você percorre diferentes trilhas e conecta novos assuntos.",
      requirement: "Acumule 1.000 XP.",
    },
    {
      number: 4,
      name: "Investigadora",
      threshold: 1500,
      icon: "explore",
      description: "Você pesquisa, compara evidências e aprofunda perguntas.",
      requirement: "Acumule 1.500 XP.",
    },
    {
      number: 5,
      name: "Especialista",
      threshold: 2000,
      icon: "psychology",
      description: "Você demonstra domínio consistente em diferentes desafios.",
      requirement: "Acumule 2.000 XP.",
    },
    {
      number: 6,
      name: "Mestre",
      threshold: 2500,
      icon: "workspace_premium",
      description: "Você concluiu a jornada e inspira novas descobertas.",
      requirement: "Acumule 2.500 XP.",
    },
  ];

  const progressFor = (xpValue) => {
    const xp = Math.max(0, Number(xpValue) || 0);
    const current =
      [...levels].reverse().find((level) => xp >= level.threshold) || levels[0];
    const next =
      levels.find((level) => level.number === current.number + 1) || null;
    const earnedInLevel = xp - current.threshold;
    const range = next ? next.threshold - current.threshold : 0;
    const percentage = next
      ? Math.min(100, Math.round((earnedInLevel / range) * 100))
      : 100;
    return {
      xp,
      current,
      next,
      percentage,
      remaining: next ? Math.max(0, next.threshold - xp) : 0,
    };
  };

  window.OminiSaberLevels = Object.freeze({
    levels: Object.freeze(levels),
    progressFor,
  });
})();
