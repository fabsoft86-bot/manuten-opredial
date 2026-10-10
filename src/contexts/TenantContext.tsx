'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { supabase } from '../lib/supabase/client';

  export type TenantRole = 'admin' | 'manager' | 'technician' | 'viewer';

  export interface TenantUser {
    id: string;
    email?: string;
    full_name?: string | null;
    role?: TenantRole;
  }

  export interface TenantOption {
    id: string;
    name: string;
  }

  export interface TenantContextValue {
    tenant_id: string | null;
    user: TenantUser | null;
    tenants: TenantOption[];
    currentTenant: TenantOption | null;
    setCurrentTenant: (tenantId: string) => void;
    refreshTenants: () => Promise<void>;
    tenantError: string | null;
  }

  const TenantContext = createContext<TenantContextValue | undefined>(undefined);

  export interface TenantProviderProps {
    children: ReactNode;
  }

  async function fetchTenantInfo(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, full_name, role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }
    if (!profile) {
      throw new Error('Seu usuário autenticou, mas ainda não possui um perfil associado a um tenant.');
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', profile.tenant_id)
      .maybeSingle();

    if (tenantError) {
      throw tenantError;
    }
    if (!tenant) {
      throw new Error('O perfil do usuário aponta para um tenant inexistente ou sem acesso.');
    }

    return { profile, tenant };
  }

  export function TenantProvider({ children }: TenantProviderProps): ReactElement {
    const authUserIdRef = useRef<string | null>(null);
    const [tenantState, setTenantState] = useState<string | null>(null);
    const [tenantList, setTenantList] = useState<TenantOption[]>([]);
    const [currentTenant, setCurrentTenantState] = useState<TenantOption | null>(null);
    const [sessionUser, setSessionUser] = useState<TenantUser | null>(null);
    const [tenantError, setTenantError] = useState<string | null>(null);

    useEffect(() => {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const authUser = session?.user;
        const nextUserId = authUser?.id ?? null;
        const userChanged = authUserIdRef.current !== nextUserId;
        authUserIdRef.current = nextUserId;

        setSessionUser((currentUser) =>
          authUser
            ? {
                id: authUser.id,
                email: authUser.email ?? undefined,
                full_name:
                  currentUser?.id === authUser.id
                    ? currentUser.full_name
                    : authUser.user_metadata?.full_name ?? null,
                role: currentUser?.id === authUser.id ? currentUser.role : undefined,
              }
            : null,
        );

        if (userChanged) {
          setTenantList([]);
          setCurrentTenantState(null);
          setTenantState(null);
          setTenantError(null);
        }
      });

      return () => data.subscription.unsubscribe();
    }, []);

    useEffect(() => {
      const userId = sessionUser?.id;
      let active = true;

      if (userId) {
        void fetchTenantInfo(userId)
          .then(({ profile, tenant }) => {
            if (!active) {
              return;
            }

            setTenantList([tenant]);
            setCurrentTenantState(tenant);
            setTenantState(tenant.id);
            setTenantError(null);
            setSessionUser((currentUser) =>
              currentUser?.id === userId
                ? {
                    ...currentUser,
                    full_name: profile.full_name,
                    role: profile.role as TenantRole,
                  }
                : currentUser,
            );
          })
          .catch((error: unknown) => {
            if (active) {
              setTenantList([]);
              setCurrentTenantState(null);
              setTenantState(null);
              setTenantError(
                error instanceof Error ? error.message : 'Não foi possível carregar o tenant do usuário.',
              );
            }
          });
      }

      return () => {
        active = false;
      };
    }, [sessionUser?.id]);

    const setCurrentTenant = (tenantId: string) => {
      const nextTenant = tenantList.find((tenant) => tenant.id === tenantId) ?? null;
      setTenantState(nextTenant?.id ?? null);
      setCurrentTenantState(nextTenant);
    };

    const refreshTenants = async () => {
      if (!sessionUser?.id) {
        return;
      }

      try {
        const { profile, tenant } = await fetchTenantInfo(sessionUser.id);
        setTenantList([tenant]);
        setCurrentTenantState(tenant);
        setTenantState(tenant.id);
        setTenantError(null);
        setSessionUser((currentUser) =>
          currentUser?.id === sessionUser.id
            ? {
                ...currentUser,
                full_name: profile.full_name,
                role: profile.role as TenantRole,
              }
            : currentUser,
        );
      } catch (error) {
        setTenantList([]);
        setCurrentTenantState(null);
        setTenantState(null);
        setTenantError(
          error instanceof Error ? error.message : 'Não foi possível carregar o tenant do usuário.',
        );
      }
    };

    const value: TenantContextValue = {
      tenant_id: tenantState,
      user: sessionUser,
      tenants: tenantList,
      currentTenant,
      setCurrentTenant,
      refreshTenants,
      tenantError,
    };

    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
  }

  export function useTenantContext(): TenantContextValue {
    const context = useContext(TenantContext);

    if (!context) {
      throw new Error('useTenantContext must be used inside a TenantProvider');
    }

    return context;
  }

  export default TenantContext;
