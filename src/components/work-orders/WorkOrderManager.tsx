'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TenantSelector } from '../TenantSelector';
import { useTenantContext, type TenantRole } from '../../contexts/TenantContext';
import { supabase } from '../../lib/supabase/client';
import { createProperty, getProperties, updateProperty } from '../../services/propertyRepository';
import { workOrderRepository } from '../../services/workOrderRepository';
import {
  pullRemoteWorkOrders,
  syncPendingProperties,
  syncPendingWorkOrders,
} from '../../services/syncService';
import type {
  LocalProperty,
  LocalWorkOrderDraft,
  Property,
  SyncStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../../types/database';

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

const statusLabels: Record<WorkOrderStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  in_progress: 'Em andamento',
  pending_review: 'Aguardando revisão',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const priorityLabels: Record<WorkOrderPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const priorityRank: Record<WorkOrderPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

const roleLabels: Record<TenantRole, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  technician: 'Técnico',
  viewer: 'Consulta',
};

function escapeCsvCell(value: string): string {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function WorkOrderManager() {
  const router = useRouter();
  const { tenant_id, tenants, user, tenantError } = useTenantContext();
  const canManageWorkOrders =
    user?.role === 'admin' || user?.role === 'manager' || user?.role === 'technician';
  const canManageProperties = user?.role === 'admin' || user?.role === 'manager';
  const [workOrders, setWorkOrders] = useState<LocalWorkOrderDraft[]>([]);
  const [propertyState, setPropertyState] = useState<{
    tenantId: string;
    items: LocalProperty[];
  } | null>(null);
  const properties = useMemo(
    () => propertyState?.tenantId === tenant_id ? propertyState.items : [],
    [propertyState, tenant_id],
  );
  const [loadedTenantId, setLoadedTenantId] = useState<string | null>(null);
  const isLoading = Boolean(tenant_id) && loadedTenantId !== tenant_id;
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const syncInFlightRef = useRef<{ tenantId: string; promise: Promise<void> } | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [form, setForm] = useState({
    property_id: '',
    title: '',
    description: '',
    priority: 'normal' as WorkOrderPriority,
  });
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '' });
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ name: '', address: '' });
  const [isUpdatingProperty, setIsUpdatingProperty] = useState(false);
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    property_id: '',
    title: '',
    description: '',
    priority: 'normal' as WorkOrderPriority,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'updated_desc' | 'updated_asc' | 'priority'>('updated_desc');

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
      await syncPendingProperties(targetTenantId);
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

  useEffect(() => {
    if (!tenant_id) {
      return;
    }

    let active = true;

    const refreshProperties = () => {
      void getProperties(tenant_id)
        .then((items) => {
          if (active) setPropertyState({ tenantId: tenant_id, items });
        })
        .catch((error) => {
          if (active) {
            setDataError(
              error instanceof Error ? error.message : 'Não foi possível carregar os imóveis.',
            );
          }
        });
    };

    refreshProperties();
    window.addEventListener('online', refreshProperties);

    return () => {
      active = false;
      window.removeEventListener('online', refreshProperties);
    };
  }, [tenant_id]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageWorkOrders || !form.title.trim() || !tenant_id) return;

    try {
      const newOrder = await workOrderRepository.createWorkOrder({
        tenant_id,
        property_id: form.property_id || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: 'open',
        priority: form.priority,
      });

      setForm({ property_id: '', title: '', description: '', priority: 'normal' });
      setWorkOrders((current) => [newOrder, ...current]);
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Não foi possível salvar a ordem localmente.',
      );
    }
  };

  const handleCreateProperty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageProperties || !tenant_id || !propertyForm.name.trim()) return;

    setIsCreatingProperty(true);
    try {
      const property = await createProperty(
        tenant_id,
        propertyForm.name.trim(),
        propertyForm.address.trim() || null,
      );
      setPropertyState((current) => {
        const currentProperties = current?.tenantId === tenant_id ? current.items : [];
        const items = [...currentProperties, property].sort((left, right) =>
          left.name.localeCompare(right.name, 'pt-BR'),
        );
        return { tenantId: tenant_id, items };
      });
      setForm((current) => ({ ...current, property_id: property.id }));
      setPropertyForm({ name: '', address: '' });
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Não foi possível cadastrar o imóvel.',
      );
    } finally {
      setIsCreatingProperty(false);
    }
  };

  const handleStartEditingProperty = (property: Property) => {
    if (!canManageProperties) return;
    setEditingPropertyId(property.id);
    setEditPropertyForm({ name: property.name, address: property.address ?? '' });
  };

  const handleUpdateProperty = async (
    event: React.FormEvent<HTMLFormElement>,
    propertyId: string,
  ) => {
    event.preventDefault();
    if (!canManageProperties || !tenant_id || !editPropertyForm.name.trim()) return;

    setIsUpdatingProperty(true);
    try {
      const updatedProperty = await updateProperty(
        tenant_id,
        propertyId,
        editPropertyForm.name.trim(),
        editPropertyForm.address.trim() || null,
      );
      setPropertyState((current) => {
        if (current?.tenantId !== tenant_id) return current;
        const items = current.items
          .map((property) => property.id === propertyId ? updatedProperty : property)
          .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
        return { tenantId: tenant_id, items };
      });
      setEditingPropertyId(null);
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Não foi possível atualizar o imóvel.',
      );
    } finally {
      setIsUpdatingProperty(false);
    }
  };

  const handleStatusChange = async (workOrderId: string, status: WorkOrderStatus) => {
    if (!canManageWorkOrders) return;

    try {
      const updatedOrder = await workOrderRepository.updateWorkOrder(workOrderId, { status });
      if (!updatedOrder) return;

      setWorkOrders((current) =>
        current.map((item) => (item.id === workOrderId ? updatedOrder : item)),
      );
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Não foi possível atualizar o status da ordem.',
      );
    }
  };

  const handleStartEditing = (workOrder: LocalWorkOrderDraft) => {
    if (!canManageWorkOrders) return;
    setEditingWorkOrderId(workOrder.id);
    setEditForm({
      property_id: workOrder.property_id ?? '',
      title: workOrder.title,
      description: workOrder.description ?? '',
      priority: workOrder.priority,
    });
  };

  const handleSaveEdit = async (
    event: React.FormEvent<HTMLFormElement>,
    workOrderId: string,
  ) => {
    event.preventDefault();
    if (!canManageWorkOrders || !editForm.title.trim()) return;

    try {
      const updatedOrder = await workOrderRepository.updateWorkOrder(workOrderId, {
        property_id: editForm.property_id || null,
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        priority: editForm.priority,
      });
      if (!updatedOrder) {
        throw new Error('Ordem de serviço não encontrada no armazenamento local.');
      }

      setWorkOrders((current) =>
        current.map((item) => (item.id === workOrderId ? updatedOrder : item)),
      );
      setEditingWorkOrderId(null);
      setDataError(null);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Não foi possível atualizar a ordem de serviço.',
      );
    }
  };

  const handleSync = async () => {
    if (!canManageWorkOrders || !tenant_id || !navigator.onLine) return;

    try {
      await synchronizeTenant(tenant_id);
      setPropertyState({ tenantId: tenant_id, items: await getProperties(tenant_id) });
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

  const tenantWorkOrders = useMemo(
    () => workOrders.filter((item) => item.tenant_id === tenant_id),
    [tenant_id, workOrders],
  );

  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );

  const visibleWorkOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');

    return tenantWorkOrders.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesProperty =
        propertyFilter === 'all' ||
        (propertyFilter === 'unassigned'
          ? !item.property_id
          : item.property_id === propertyFilter);
      const property = item.property_id ? propertyById.get(item.property_id) : undefined;
      const searchableText = [
        item.title,
        item.description ?? '',
        property?.name ?? '',
        property?.address ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      return (
        matchesStatus &&
        matchesPriority &&
        matchesProperty &&
        searchableText.includes(normalizedQuery)
      );
    }).sort((left, right) => {
      if (sortOrder === 'priority') {
        const priorityDifference = priorityRank[right.priority] - priorityRank[left.priority];
        return priorityDifference || Date.parse(right.updated_at) - Date.parse(left.updated_at);
      }

      const timeDifference = Date.parse(right.updated_at) - Date.parse(left.updated_at);
      return sortOrder === 'updated_asc' ? -timeDifference : timeDifference;
    });
  }, [priorityFilter, propertyById, propertyFilter, searchQuery, sortOrder, statusFilter, tenantWorkOrders]);

  const pendingCount = useMemo(
    () =>
      tenantWorkOrders.filter((item) => item.sync_status !== 'synced').length +
      properties.filter((property) => property.sync_status !== 'synced').length,
    [properties, tenantWorkOrders],
  );

  const workOrderSummary = useMemo(
    () => [
      {
        label: 'Abertas',
        value: tenantWorkOrders.filter((item) => item.status === 'open').length,
      },
      {
        label: 'Em andamento',
        value: tenantWorkOrders.filter((item) => item.status === 'in_progress').length,
      },
      {
        label: 'Aguardando revisão',
        value: tenantWorkOrders.filter((item) => item.status === 'pending_review').length,
      },
      {
        label: 'Urgentes ativas',
        value: tenantWorkOrders.filter(
          (item) =>
            item.priority === 'urgent' &&
            item.status !== 'completed' &&
            item.status !== 'cancelled',
        ).length,
      },
    ],
    [tenantWorkOrders],
  );

  const handleExportCsv = () => {
    const headers = [
      'Título',
      'Descrição',
      'Status',
      'Prioridade',
      'Imóvel',
      'Endereço',
      'Criada em',
      'Atualizada em',
    ];
    const records = visibleWorkOrders.map((workOrder) => {
      const property = workOrder.property_id
        ? propertyById.get(workOrder.property_id)
        : undefined;

      return [
        workOrder.title,
        workOrder.description ?? '',
        statusLabels[workOrder.status],
        priorityLabels[workOrder.priority],
        property?.name ?? '',
        property?.address ?? '',
        new Date(workOrder.created_at).toLocaleString('pt-BR'),
        new Date(workOrder.updated_at).toLocaleString('pt-BR'),
      ];
    });
    const csvRows = [headers, ...records].map((record) =>
      record.map(escapeCsvCell).join(';'),
    );
    const csvContent = `\uFEFF${csvRows.join('\r\n')}`;
    const fileUrl = URL.createObjectURL(
      new Blob([csvContent], { type: 'text/csv;charset=utf-8' }),
    );
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = `ordens-servico-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  };

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
              {user ? (
                <div className="min-w-0 px-1 text-right">
                  <p className="max-w-48 truncate text-sm font-medium text-slate-100">
                    {user.full_name?.trim() &&
                    user.full_name.trim().toLocaleLowerCase('pt-BR') !==
                      (user.role ? roleLabels[user.role].toLocaleLowerCase('pt-BR') : '')
                      ? user.full_name.trim()
                      : user.email || user.full_name?.trim() || 'Usuário'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {user.role ? roleLabels[user.role] : 'Carregando perfil'}
                  </p>
                </div>
              ) : null}
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
                disabled={
                  !canManageWorkOrders || isSyncing || pendingCount === 0 || !tenant_id || !isOnline
                }
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isSyncing
                  ? 'Sincronizando...'
                  : pendingCount > 0
                    ? `Sincronizar Agora (${pendingCount})`
                    : 'Sincronizar Agora'}
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

        <section
          aria-label="Resumo das ordens de serviço"
          className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-4"
        >
          {workOrderSummary.map((metric) => (
            <div key={metric.label} className="bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Imóveis</h2>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
              {properties.length} itens
            </span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              {properties.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                  Nenhum imóvel cadastrado para este tenant.
                </p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {properties.map((property) => (
                    <li key={property.id} className="py-3 first:pt-0 last:pb-0">
                      {editingPropertyId === property.id && canManageProperties ? (
                        <form
                          onSubmit={(event) => void handleUpdateProperty(event, property.id)}
                          className="space-y-3"
                        >
                          <div>
                            <label
                              htmlFor={`edit-property-name-${property.id}`}
                              className="mb-1.5 block text-sm text-slate-300"
                            >
                              Nome
                            </label>
                            <input
                              id={`edit-property-name-${property.id}`}
                              value={editPropertyForm.name}
                              onChange={(event) =>
                                setEditPropertyForm((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                              required
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`edit-property-address-${property.id}`}
                              className="mb-1.5 block text-sm text-slate-300"
                            >
                              Endereço
                            </label>
                            <input
                              id={`edit-property-address-${property.id}`}
                              value={editPropertyForm.address}
                              onChange={(event) =>
                                setEditPropertyForm((current) => ({
                                  ...current,
                                  address: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={isUpdatingProperty}
                              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isUpdatingProperty ? 'Salvando...' : 'Salvar imóvel'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPropertyId(null)}
                              disabled={isUpdatingProperty}
                              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{property.name}</p>
                            {property.address ? (
                              <p className="mt-1 text-sm text-slate-400">{property.address}</p>
                            ) : null}
                            {property.sync_status !== 'synced' ? (
                              <p className="mt-1 text-xs text-amber-300">Pendente de sincronização</p>
                            ) : null}
                          </div>
                          {canManageProperties ? (
                            <button
                              type="button"
                              onClick={() => handleStartEditingProperty(property)}
                              disabled={isUpdatingProperty}
                              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Editar
                            </button>
                          ) : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canManageProperties ? (
              <form onSubmit={handleCreateProperty} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">Cadastrar imóvel</h3>
              <div>
                <label htmlFor="property-name" className="mb-1.5 block text-sm text-slate-300">
                  Nome
                </label>
                <input
                  id="property-name"
                  value={propertyForm.name}
                  onChange={(event) =>
                    setPropertyForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="Ex: Edifício Central"
                  required
                />
              </div>
              <div>
                <label htmlFor="property-address" className="mb-1.5 block text-sm text-slate-300">
                  Endereço
                </label>
                <input
                  id="property-address"
                  value={propertyForm.address}
                  onChange={(event) =>
                    setPropertyForm((current) => ({ ...current, address: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="Rua, número e cidade"
                />
              </div>
              <button
                type="submit"
                disabled={!tenant_id || isCreatingProperty}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isCreatingProperty ? 'Cadastrando...' : 'Cadastrar imóvel'}
              </button>
              </form>
            ) : (
              <p className="text-sm text-slate-400">
                Seu perfil permite consultar imóveis, mas não gerenciá-los.
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Lista de OS</h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                    {visibleWorkOrders.length} itens
                  </span>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={visibleWorkOrders.length === 0}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Exportar CSV
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="search"
                  aria-label="Buscar ordens por título, descrição ou imóvel"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por título, descrição ou imóvel"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <select
                    aria-label="Filtrar por status"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as WorkOrderStatus | 'all')
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="all">Todos os status</option>
                    {Object.entries(statusLabels).map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar por prioridade"
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(event.target.value as WorkOrderPriority | 'all')
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="all">Todas as prioridades</option>
                    {Object.entries(priorityLabels).map(([priority, label]) => (
                      <option key={priority} value={priority}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar por imóvel"
                    value={propertyFilter}
                    onChange={(event) => setPropertyFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="all">Todos os imóveis</option>
                    <option value="unassigned">Sem imóvel vinculado</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ordenar ordens de serviço"
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value as typeof sortOrder)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="updated_desc">Mais recentes</option>
                    <option value="updated_asc">Mais antigas</option>
                    <option value="priority">Maior prioridade</option>
                  </select>
                </div>
              </div>
            </div>

            {tenant_id && isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                Carregando ordens...
              </div>
            ) : visibleWorkOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                {tenantWorkOrders.length === 0
                  ? 'Nenhuma ordem de serviço cadastrada para este tenant.'
                  : 'Nenhuma ordem corresponde à busca ou ao status selecionado.'}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleWorkOrders.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    {editingWorkOrderId === item.id ? (
                      <form onSubmit={(event) => void handleSaveEdit(event, item.id)} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                          <div>
                            <label htmlFor={`edit-title-${item.id}`} className="mb-1.5 block text-sm text-slate-300">
                              Título
                            </label>
                            <input
                              id={`edit-title-${item.id}`}
                              value={editForm.title}
                              onChange={(event) =>
                                setEditForm((current) => ({ ...current, title: event.target.value }))
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-priority-${item.id}`} className="mb-1.5 block text-sm text-slate-300">
                              Prioridade
                            </label>
                            <select
                              id={`edit-priority-${item.id}`}
                              value={editForm.priority}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  priority: event.target.value as WorkOrderPriority,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                            >
                              <option value="low">Baixa</option>
                              <option value="normal">Normal</option>
                              <option value="high">Alta</option>
                              <option value="urgent">Urgente</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`edit-description-${item.id}`} className="mb-1.5 block text-sm text-slate-300">
                            Descrição
                          </label>
                          <textarea
                            id={`edit-description-${item.id}`}
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, description: event.target.value }))
                            }
                            rows={3}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-property-${item.id}`} className="mb-1.5 block text-sm text-slate-300">
                            Imóvel
                          </label>
                          <select
                            id={`edit-property-${item.id}`}
                            value={editForm.property_id}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, property_id: event.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                          >
                            <option value="">Sem imóvel vinculado</option>
                            {properties.map((property) => (
                              <option key={property.id} value={property.id}>
                                {property.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                          >
                            Salvar alterações
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWorkOrderId(null)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-white">{item.title}</h3>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${priorityStyles[item.priority]}`}>
                              {priorityLabels[item.priority]}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300">{item.description || 'Sem descrição adicional.'}</p>
                          {item.property_id && propertyById.has(item.property_id) ? (
                            <p className="text-xs text-slate-400">
                              Imóvel: {propertyById.get(item.property_id)?.name}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${syncStyles[item.sync_status]}`}>
                            {item.sync_status === 'synced'
                              ? 'Sincronizado'
                              : item.sync_status === 'pending_updated'
                                ? 'Pendente de atualização'
                                : 'Pendente de criação'}
                          </span>
                          {canManageWorkOrders ? (
                            <button
                              type="button"
                              onClick={() => handleStartEditing(item)}
                              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                            >
                              Editar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <select
                        aria-label={`Status de ${item.title}`}
                        value={item.status}
                        disabled={!canManageWorkOrders || editingWorkOrderId === item.id}
                        onChange={(event) =>
                          void handleStatusChange(item.id, event.target.value as WorkOrderStatus)
                        }
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-400"
                      >
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <option key={status} value={status}>
                            {label}
                          </option>
                        ))}
                      </select>
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

          {canManageWorkOrders ? (
            <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
            <h2 className="mb-4 text-xl font-semibold text-white">Nova Ordem de Serviço</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="property-id" className="mb-1.5 block text-sm text-slate-300">
                  Imóvel
                </label>
                <select
                  id="property-id"
                  value={form.property_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, property_id: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="">Sem imóvel vinculado</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>
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
          ) : (
            <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-sm text-slate-400">
              Seu perfil permite consultar as ordens, mas não criá-las nem editá-las.
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
