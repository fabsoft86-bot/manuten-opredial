'use client';

import { TenantProvider } from '../contexts/TenantContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TenantProvider>{children}</TenantProvider>;
}
