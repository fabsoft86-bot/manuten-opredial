'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { loadIdentity } from '../lib/offlineIdentity';
import { supabase } from '../lib/supabase/client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      const isPublicRoute = pathname === '/login';

      try {
        let isAuthenticated: boolean;

        if (!navigator.onLine) {
          // Sem rede não dá para validar a sessão no servidor: usa a última identidade salva.
          isAuthenticated = loadIdentity() !== null;
        } else {
          const { data, error } = await supabase.auth.getUser();
          isAuthenticated = Boolean(data.user);

          // Queda de rede durante a validação não significa sessão inválida.
          if (!isAuthenticated && error?.name === 'AuthRetryableFetchError') {
            isAuthenticated = loadIdentity() !== null;
          }
        }

        if (!active) {
          return;
        }

        if (!isAuthenticated && !isPublicRoute) {
          router.replace('/login');
          return;
        }

        if (isAuthenticated && isPublicRoute) {
          router.replace('/');
          return;
        }
      } catch {
        if (!active) {
          return;
        }

        if (!isPublicRoute) {
          router.replace('/login');
        }
      } finally {
        if (active) {
          setIsChecking(false);
        }
      }
    }

    void validateSession();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Verificando sessão...
      </div>
    );
  }

  return <>{children}</>;
}
