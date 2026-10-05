import { supabaseClient } from "./supabaseClient.js";

const VALID_ROLES = new Set(["admin", "technician", "client"]);

export async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, role, organizationId) {
  if (!VALID_ROLES.has(role)) {
    throw new TypeError("Perfil inválido. Use admin, technician ou client.");
  }
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    throw new TypeError("organizationId é obrigatório para o cadastro.");
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    // Os metadados de cadastro são informados pelo usuário e não concedem acesso por si só.
    options: { data: { role, organization_id: organizationId.trim() } }
  });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error?.name === "AuthSessionMissingError") return null;
    if (error) throw error;
    return data.user;
  } catch (error) {
    if (error?.name === "AuthSessionMissingError") return null;
    throw error;
  }
}
