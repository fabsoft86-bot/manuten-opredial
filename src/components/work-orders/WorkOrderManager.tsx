'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TenantSelector } from '../TenantSelector';
import { useTenantContext } from '../../contexts/TenantContext';
import { supabase } from '../../lib/supabase/client';
import { workOrderRepository } from '../../services/workOrderRepository';
import { pullRemoteWorkOrders, syncPendingWorkOrders } from '../../services/syncService';
import type { LocalWorkOrderDraft, SyncStatus, WorkOrderPriority } from '../../types/database';

const priorityStyles: Record<WorkOrderPriority, string> = {
  low: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  normal: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  high: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  urgent: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const syncStyles: Record<SyncStatus, string> = {
  synced: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  pending_created: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  pending_updated: 'bg-orange-500/15 text-orange-200 border border-orange-500/30',
};

export function WorkOrderManager() {
  const router = useRouter();
  const { tenant_id, tenants, user, tenantError } = useTenantContext();
  const [workOrders, setWorkOrders] = useState<LocalWorkOrderDraft[]>([]);
  const [loadedTenantId, setLoadedTenantId] = useState<string | null>(null);
  const isLoading = Boolean(tenant_id) && loadedTenantId !== tenant_id;
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const syncInFlightRef = useRef<{ tenantId: string; promise: Promise<void> } | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal' as WorkOrderPriority,
  });

  const synchronizeTenant = async (targetTenantId: string) => {
    if (!navigator.onLine) {
      return;
    }

    const inFlight = syncInFlightRef.current;
    if (inFlight) {
      try {
        await inFlight.promise;
      } catch (error) {
        if (inFlight.tenantId === targetTenantId) {
          throw error;
        }
      }
      if (inFlight.tenantId === targetTenantId) {
        return;
      }
    }

    const promise = (async () => {
      await syncPendingWorkOrders(targetTenantId);
      await pullRemoteWorkOrders(targetTenantId);
    })();
    const currentSync = { tenantId: targetTenantId, promise };
    syncInFlightRef.current = currentSync;
    setIsSyncing(true);

    try {
      await promise;
    } finally {
      if (syncInFlightRef.current === currentSync) {
        syncInFlightRef.current = null;
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    const updateNetworkStatus = () => setIsOnline(navigator.onLine);
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {

    if (!tenant_id) {
      return;
    }

    let active = true;

    const refreshWorkOrders = async () => {
      try {
        if (navigator.onLine) {
          await synchronizeTenant(tenant_id);
        }
        const items = await workOrderRepository.getWorkOrders(tenant_id);
        if (active) {
          setWorkOrders(items);
          setDataError(null);
        }
      } catch (error) {
        const localItems = await workOrderRepository.getWorkOrders(tenant_id);
        if (active) {
          setWorkOrders(localItems);
          setDataError(
            error instanceof Error ? error.message : 'Não foi possível atualizar as ordens de serviço.',
          );
        }
      } finally {
        if (active) {
          setLoadedTenantId(tenant_id);
        }
      }
    };

    const handleOnline = async () => {
      setIsOnline(true);
      try {
        await refreshWorkOrders();
      } catch (error) {
        setDataError(
          error instanceof Error ? error.message : 'Falha ao sincronizar as ordens com o Supabase.',
        );
      }
    };

    void refreshWorkOrders();
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [tenant_id]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !tenant_id) return;

    try {
      const newOrder = await workOrderRepository.createWorkOrder({
        tenant_id,
        property_id: null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: 'open',
        priority: form.priority,
      });

      setForm({ title: '', description: '', priority: 'normal' });
      setWorkOrders((current) => [newOrder, ...current]);
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Não foi possível salvar a ordem localmente.',
      );
    }
  };

  const handleSync = async () => {
    if (!tenant_id || !navigator.onLine) return;

    try {
      await synchronizeTenant(tenant_id);
      setWorkOrders(await workOrderRepository.getWorkOrders(tenant_id));
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Falha ao sincronizar as ordens com o Supabase.',
      );
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const visibleWorkOrders = useMemo(
    () => workOrders.filter((item) => item.tenant_id === tenant_id),
    [tenant_id, workOrders],
  );

  const pendingCount = useMemo(
    () => visibleWorkOrders.filter((item) => item.sync_status !== 'synced').length,
    [visibleWorkOrders],
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">
                FixPro • Gestão de Manutenção
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Ordens de Serviço</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <TenantSelector tenants={tenants} />
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                  isSyncing
                    ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/20'
                    : isOnline
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20'
                    : 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/20'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${
                  isSyncing ? 'bg-sky-400' : isOnline ? 'bg-emerald-400' : 'bg-rose-400'
                }`} />
                {isSyncing ? 'Sincronizando' : isOnline ? 'Online' : 'Offline'}
              </span>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={isSyncing || pendingCount === 0 || !tenant_id || !isOnline}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              </button>
              {user ? (
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                >
                  Sair
                </button>
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </header>

        {tenantError ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {tenantError} Solicite ao administrador o provisionamento do perfil e do tenant no Supabase.
          </div>
        ) : null}
        {dataError ? (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {dataError} As ordens locais foram mantidas.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Lista de OS</h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                {visibleWorkOrders.length} itens
              </span>
            </div>

            {tenant_id && isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                Carregando ordens...
              </div>
            ) : visibleWorkOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                Nenhuma ordem de serviço cadastrada para este tenant.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleWorkOrders.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white">{item.title}</h3>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${priorityStyles[item.priority]}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{item.description || 'Sem descrição adicional.'}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${syncStyles[item.sync_status]}`}>
                        {item.sync_status === 'synced'
                          ? 'Sincronizado'
                          : item.sync_status === 'pending_updated'
                            ? 'Pendente de atualização'
                            : 'Pendente de criação'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>{item.status}</span>
                      <span>
                        {new Date(item.updated_at).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
            <h2 className="mb-4 text-xl font-semibold text-white">Nova Ordem de Serviço</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="title" className="mb-1.5 block text-sm text-slate-300">Título</label>
                <input
                  id="title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-0 transition focus:border-cyan-400"
                  placeholder="Ex: Vala de drenagem entupida"
                />
              </div>
              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm text-slate-300">Descrição</label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="Descreva o problema encontrado..."
                />
              </div>
              <div>
                <label htmlFor="priority" className="mb-1.5 block text-sm text-slate-300">Prioridade</label>
                <select
                  id="priority"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    priority: event.target.value as WorkOrderPriority,
                  }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!tenant_id}
                className="w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {tenant_id ? 'Criar Ordem de Serviço' : 'Aguardando tenant'}
              </button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
