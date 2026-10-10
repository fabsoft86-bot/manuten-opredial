'use client';

import { useTenantContext } from '../contexts/TenantContext';

export interface TenantOption {
  id: string;
  name: string;
}

export interface TenantSelectorProps {
  tenants?: TenantOption[];
}

export function TenantSelector({ tenants = [] }: TenantSelectorProps) {
  const { tenant_id, setCurrentTenant } = useTenantContext();

  if (tenants.length === 0) {
    return null;
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant</span>
      <select
        value={tenant_id ?? tenants[0]?.id ?? ''}
        onChange={(event) => setCurrentTenant(event.target.value)}
        className="bg-transparent text-sm text-white outline-none"
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id} className="bg-slate-900 text-white">
            {tenant.name}
          </option>
        ))}
      </select>
    </label>
  );
}
