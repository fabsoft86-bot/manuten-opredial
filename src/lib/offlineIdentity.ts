/**
 * Guarda a última identidade autenticada (usuário, papel e tenant) para o app
 * abrir sem rede. É apenas conveniência de interface: quem protege os dados
 * de verdade é a RLS do Supabase quando há conexão.
 */
export interface CachedIdentity {
  userId: string;
  email?: string;
  fullName: string | null;
  role: string;
  tenant: { id: string; name: string };
}

const STORAGE_KEY = 'fixpro:identity';

export function saveIdentity(identity: CachedIdentity): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // armazenamento indisponível: o app só não abre offline
  }
}

export function loadIdentity(): CachedIdentity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedIdentity>;
    if (!parsed.userId || !parsed.role || !parsed.tenant?.id || !parsed.tenant.name) {
      return null;
    }

    return parsed as CachedIdentity;
  } catch {
    return null;
  }
}

export function clearIdentity(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada a limpar
  }
}
