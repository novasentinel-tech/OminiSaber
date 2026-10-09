(() => {
  const voices = {
    escola: {
      title: "Conversa na escola",
      context: "Diálogo entre colegas durante o intervalo.",
      transcript:
        'Você <span class="clue">viu</span> o aviso da feira? A gente precisa levar o trabalho <span class="clue teal">amanhã</span>, né?',
      locutor: ["Colega de turma", "Diretora", "Radialista"],
      interlocutor: ["Outro estudante", "Ouvintes", "Família"],
      marks: [
        "Vocabulário cotidiano e pergunta de confirmação",
        "Termos técnicos e impessoalidade",
        "Chamamento ao público",
      ],
    },
    radio: {
      title: "Rádio comunitária",
      context: "Aviso transmitido por uma rádio de bairro.",
      transcript:
        '<span class="clue">Atenção, moradores</span>: neste sábado teremos vacinação no posto central. <span class="clue teal">Compartilhe o aviso</span> com sua vizinhança.',
      locutor: ["Apresentador da rádio", "Estudante", "Mãe"],
      interlocutor: ["Comunidade local", "Professor", "Filho"],
      marks: [
        "Vocativo coletivo e pedido público",
        "Tratamento afetivo",
        "Gíria entre colegas",
      ],
    },
    familia: {
      title: "Mensagem da família",
      context: "Mensagem de uma mãe para o filho depois da aula.",
      transcript:
        'Oi, <span class="clue">meu filho</span>! Tudo bem <span class="clue">por aí</span>? Aqui <span class="clue teal">tá</span> tudo certo.<br><br>Não esquece de almoçar direitinho, <span class="clue">tá?</span> E me manda mensagem quando chegar da escola, <span class="clue teal">por favor</span>.<br><br>Um beijo grande! Mamãe.',
      locutor: ["Mãe", "Professor", "Radialista"],
      interlocutor: ["Filho", "Turma", "Comunidade"],
      marks: [
        "Tratamento afetivo e proximidade",
        "Linguagem técnica",
        "Vocativo coletivo",
      ],
    },
    formal: {
      title: "Apresentação formal",
      context: "Abertura de um seminário diante da turma.",
      transcript:
        '<span class="clue">Bom dia a todas e todos</span>. Nesta apresentação, <span class="clue teal">analisaremos</span> como a linguagem varia de acordo com o contexto.',
      locutor: ["Apresentador do seminário", "Mãe", "Colega no intervalo"],
      interlocutor: ["Público da apresentação", "Filho", "Ouvintes da rádio"],
      marks: [
        "Saudação ampla e verbo formal",
        "Diminutivos afetivos",
        "Gírias locais",
      ],
    },
  };
  let active = "familia";
  let speech = null;

  const fillSelect = (selector, values) => {
    const select = document.querySelector(selector);
    select.innerHTML =
      '<option value="">Selecione</option>' +
      values.map((value) => `<option>${value}</option>`).join("");
  };
  const render = () => {
    const voice = voices[active];
    document.querySelector("[data-voice-title]").textContent = voice.title;
    document.querySelector("[data-voice-context]").textContent = voice.context;
    document.querySelector("[data-transcript]").innerHTML = voice.transcript;
    fillSelect("#locutor", voice.locutor);
    fillSelect("#interlocutor", voice.interlocutor);
    fillSelect("#marca", voice.marks);
    document
      .querySelectorAll("[data-voice]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.voice === active),
        ),
      );
    const feedback = document.querySelector("[data-feedback]");
    feedback.className = "feedback";
    feedback.textContent = "";
  };

  document.querySelectorAll("[data-voice]").forEach((button) =>
    button.addEventListener("click", () => {
      active = button.dataset.voice;
      window.speechSynthesis?.cancel();
      render();
    }),
  );
  document.querySelector("[data-listen]").addEventListener("click", () => {
    if (!("speechSynthesis" in window))
      return window.OminiPortuguese.toast(
        "A leitura em voz alta não está disponível neste navegador.",
      );
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      document.querySelector("[data-audio-label]").textContent = "Ouvir trecho";
      return;
    }
    const container = document.querySelector("[data-transcript]");
    speech = new SpeechSynthesisUtterance(container.textContent);
    speech.lang = "pt-BR";
    speech.rate = 0.92;
    speech.onend = () => {
      document.querySelector("[data-audio-label]").textContent = "Ouvir trecho";
    };
    document.querySelector("[data-audio-label]").textContent = "Parar leitura";
    window.speechSynthesis.speak(speech);
  });
  document
    .querySelector("[data-clear-analysis]")
    .addEventListener("click", () => {
      document.querySelectorAll(".evidence-form select").forEach((select) => {
        select.value = "";
      });
    });
  document
    .querySelector("[data-confirm-analysis]")
    .addEventListener("click", () => {
      const voice = voices[active];
      const selections = ["#locutor", "#interlocutor", "#marca"].map(
        (selector) => document.querySelector(selector).value,
      );
      const correct =
        selections[0] === voice.locutor[0] &&
        selections[1] === voice.interlocutor[0] &&
        selections[2] === voice.marks[0];
      const feedback = document.querySelector("[data-feedback]");
      feedback.className = `feedback ${correct ? "success" : "error"}`;
      feedback.textContent = correct
        ? "Boa leitura! Você relacionou as marcas ao contexto de comunicação."
        : "Observe os vocativos, o grau de formalidade e a relação entre as pessoas. Depois tente novamente.";
      if (correct)
        window.OminiPortuguese.complete(
          "mapa-da-lingua",
          "Mapa da Língua concluído. Você reconheceu locutor, interlocutor e contexto.",
        );
    });
  render();
})();
