(() => {
  const form = document.getElementById("loginForm");
  const identifierInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("togglePassword");
  const loginError = document.getElementById("loginError");
  const resendButton = document.getElementById("resendConfirmation");
  const submitButton = form?.querySelector('button[type="submit"]');
  const btnLabel = submitButton?.querySelector(".btn-label");
  const rememberInput = document.getElementById("remember-me");
  const savedEmail = localStorage.getItem("ominisaber-login-email");

  if (
    !form ||
    !identifierInput ||
    !passwordInput ||
    !passwordToggle ||
    !loginError ||
    !resendButton ||
    !submitButton ||
    !btnLabel
  )
    return;

  if (savedEmail) {
    identifierInput.value = savedEmail;
    rememberInput.checked = true;
  }

  const showStatus = (message, type = "error") => {
    loginError.textContent = message;
    loginError.dataset.type = type;
    loginError.hidden = false;
    loginError.classList.remove("is-shaking");
    if (type === "error") {
      void loginError.offsetWidth;
      loginError.classList.add("is-shaking");
    }
    loginError.focus();
  };

  const clearStatus = () => {
    loginError.textContent = "";
    loginError.hidden = true;
    loginError.classList.remove("is-shaking");
    loginError.removeAttribute("data-type");
    resendButton.hidden = true;
  };

  const defaultButtonLabel = "Entrar no OminiSaber";

  const setLoading = (isLoading, label = "Autenticando...") => {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle("is-loading", isLoading);
    btnLabel.textContent = isLoading ? label : defaultButtonLabel;
  };

  const setSuccess = () => {
    submitButton.classList.remove("is-loading");
    submitButton.classList.add("is-success");
    btnLabel.textContent = "Tudo certo! Redirecionando...";
  };

  const normalizedError = (error) =>
    `${error?.code || ""} ${error?.message || ""}`.toLowerCase();

  const presentAuthError = (error) => {
    const message = normalizedError(error);
    if (
      error?.status === 429 ||
      message.includes("over_request_rate_limit") ||
      message.includes("over_email_send_rate_limit") ||
      message.includes("too many requests")
    ) {
      return "Muitas tentativas em pouco tempo. Aguarde um minuto antes de tentar novamente.";
    }
    if (
      message.includes("email_not_confirmed") ||
      message.includes("email not confirmed")
    ) {
      resendButton.hidden = !identifierInput.value.includes("@");
      return "Seu e-mail ainda não foi confirmado. Abra a mensagem enviada pelo OminiSaber ou reenvie a confirmação.";
    }
    if (
      message.includes("invalid_credentials") ||
      message.includes("invalid login credentials") ||
      message.includes("matrícula não encontrada")
    ) {
      return "E-mail, matrícula ou senha incorretos.";
    }
    if (message.includes("profile_not_found")) {
      return "A conta foi autenticada, mas o perfil escolar não foi encontrado. Procure a secretaria.";
    }
    if (message.includes("teacher_specialty_not_found")) {
      return "Seu perfil de professor ainda não possui uma especialidade definida.";
    }
    if (message.includes("role_not_supported")) {
      return "Seu nível de acesso não está configurado corretamente.";
    }
    if (
      message.includes("could not find the table") ||
      message.includes("schema cache") ||
      message.includes("does not exist")
    ) {
      return "A estrutura do banco de dados ainda não está disponível. A administração precisa aplicar o schema completo.";
    }
    if (message.includes("failed to fetch") || message.includes("network")) {
      return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
    }
    return error?.message || "Não foi possível entrar. Tente novamente.";
  };

  const redirectAuthenticatedUser = async (userId) => {
    const profile = await window.OminiSaber.getProfile(userId);
    const destination = window.OminiSaber.getProfileDestination(profile);
    setSuccess();
    window.location.assign(destination);
  };

  passwordToggle.addEventListener("click", () => {
    const isShowing = passwordInput.type === "text";
    passwordInput.type = isShowing ? "password" : "text";
    passwordToggle.setAttribute("aria-pressed", String(!isShowing));
    passwordToggle.setAttribute(
      "aria-label",
      isShowing ? "Mostrar senha" : "Ocultar senha",
    );
    passwordToggle.querySelector(".material-symbols-rounded").textContent =
      isShowing ? "visibility" : "visibility_off";
  });

  document
    .querySelector("[data-forgot-password]")
    .addEventListener("click", async (event) => {
      event.preventDefault();
      clearStatus();
      const email = identifierInput.value.trim();
      if (!email.includes("@")) {
        showStatus(
          "Digite seu e-mail no campo acima para receber o link de recuperação.",
        );
        identifierInput.focus();
        return;
      }
      try {
        setLoading(true, "Enviando link...");
        const { error } = await window.OminiSaber.requestPasswordReset(email);
        if (error) throw error;
        showStatus(
          "Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
          "success",
        );
      } catch (error) {
        showStatus(presentAuthError(error));
      } finally {
        setLoading(false);
      }
    });

  resendButton.addEventListener("click", async () => {
    try {
      resendButton.disabled = true;
      const { error } = await window.OminiSaber.resendSignupConfirmation(
        identifierInput.value,
      );
      if (error) throw error;
      showStatus(
        "Novo e-mail de confirmação enviado. Confira também a pasta de spam.",
        "success",
      );
      resendButton.hidden = true;
    } catch (error) {
      showStatus(presentAuthError(error));
    } finally {
      resendButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    submitButton.classList.remove("is-success");
    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;

    if (!identifier || !password) {
      showStatus("Por favor, preencha todos os campos.");
      return;
    }

    if (rememberInput.checked)
      localStorage.setItem("ominisaber-login-email", identifier);
    else localStorage.removeItem("ominisaber-login-email");

    setLoading(true);
    let authenticated = false;
    try {
      if (!window.OminiSaber?.configured)
        throw new Error(
          "Sistema indisponível: conexão com o Supabase não configurada.",
        );
      const { data, error } = await window.OminiSaber.signIn(
        identifier,
        password,
      );
      if (error) throw error;
      if (!data?.session || !data?.user)
        throw new Error("A autenticação não criou uma sessão válida.");
      authenticated = true;
      await redirectAuthenticatedUser(data.user.id);
    } catch (error) {
      if (authenticated) await window.OminiSaber.clearSession().catch(() => {});
      const message = presentAuthError(error);
      showStatus(message);
      window.OminiSaber?.notify?.(message, "error");
    } finally {
      if (!submitButton.classList.contains("is-success")) setLoading(false);
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("confirmacao") === "concluida") {
    showStatus("E-mail confirmado. Agora você já pode entrar.", "success");
    history.replaceState({}, "", window.location.pathname);
  }

  if (!params.has("preview")) {
    window.OminiSaber.getSession()
      .then(
        (session) =>
          session?.user && redirectAuthenticatedUser(session.user.id),
      )
      .catch(async () => {
        await window.OminiSaber.clearSession().catch(() => {});
      });
  }
})();
