import { getCurrentUser, login, logout } from "./auth.js";
import "./api-client.js";

const loginForm = document.getElementById("supabaseLoginForm");
const sessionPanel = document.getElementById("supabaseSession");
const userEmail = document.getElementById("supabaseUserEmail");
const loginMessage = document.getElementById("authMessage");
const sessionMessage = document.getElementById("authSessionMessage");

function showSession(user) {
  loginForm.hidden = Boolean(user);
  sessionPanel.hidden = !user;
  userEmail.textContent = user ? `Conectado como ${user.email}` : "";
}

async function syncOrganizationTickets() {
  try {
    const result = await window.occurrenceApi.sync();
    window.setConnectionStatus?.(result.connected);
    window.refreshDashboard?.();
    if (!document.getElementById("gestaoView").classList.contains("hidden")) window.renderHistory?.();
    return result;
  } catch (error) {
    window.setConnectionStatus?.(false);
    throw error;
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  loginMessage.textContent = "Conectando...";
  loginMessage.setAttribute("role", "status");

  try {
    const result = await login(
      document.getElementById("supabaseEmail").value.trim(),
      document.getElementById("supabasePassword").value
    );
    const user = result.user || await getCurrentUser();
    if (!user) throw new Error("Login realizado, mas a sessão não retornou um usuário.");
    showSession(user);
    sessionMessage.textContent = "Conta autenticada. Sincronizando chamados...";
    await syncOrganizationTickets();
    sessionMessage.textContent = "Chamados sincronizados com o Supabase.";
  } catch (error) {
    console.error("Falha ao entrar ou sincronizar a organização:", error);
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      showSession(user);
      sessionMessage.textContent = `Conta autenticada, mas a sincronização falhou: ${error.message || "erro inesperado"}`;
    } else {
      showSession(null);
      loginMessage.textContent = error.message || "Não foi possível conectar. Verifique suas credenciais e tente novamente.";
      loginMessage.setAttribute("role", "alert");
    }
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById("supabaseLogoutButton").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  sessionMessage.textContent = "Saindo...";
  try {
    await logout();
    showSession(null);
    sessionMessage.textContent = "";
    loginMessage.textContent = "Sessão encerrada. Entre novamente para sincronizar chamados.";
    loginMessage.setAttribute("role", "status");
    await syncOrganizationTickets();
  } catch (error) {
    console.error("Falha ao sair:", error);
    sessionMessage.textContent = error.message || "Não foi possível encerrar a sessão.";
  } finally {
    button.disabled = false;
  }
});

getCurrentUser()
  .then(user => {
    showSession(user);
    if (user) return syncOrganizationTickets();
    return undefined;
  })
  .catch(error => {
    console.error("Falha ao verificar a sessão Supabase:", error);
    sessionMessage.textContent = `Não foi possível verificar a sessão: ${error.message}`;
    sessionMessage.setAttribute("role", "alert");
  });
