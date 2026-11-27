'use client';

import { useState } from 'react';

import { workOrderRepository } from '../../services/workOrderRepository';
import type { LocalProperty, LocalWorkOrderDraft, WorkOrderPriority } from '../../types/database';

interface WorkOrderFormProps {
  tenantId: string | null;
  properties: LocalProperty[];
  /** Imóvel selecionado (controlado pelo pai: cadastrar um imóvel já o seleciona). */
  propertyId: string;
  onPropertyIdChange: (propertyId: string) => void;
  onCreated: (workOrder: LocalWorkOrderDraft) => void;
  onError: (message: string | null) => void;
}

const emptyForm = {
  title: '',
  description: '',
  priority: 'normal' as WorkOrderPriority,
};

export function WorkOrderForm({
  tenantId,
  properties,
  propertyId,
  onPropertyIdChange,
  onCreated,
  onError,
}: WorkOrderFormProps) {
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !tenantId) return;

    try {
      const newOrder = await workOrderRepository.createWorkOrder({
        tenant_id: tenantId,
        property_id: propertyId || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: 'open',
        priority: form.priority,
      });

      setForm(emptyForm);
      onPropertyIdChange('');
      onCreated(newOrder);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar a ordem localmente.');
    }
  };

  return (
    <>
      <h2 className="mb-4 text-xl font-semibold text-white">Nova Ordem de Serviço</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label htmlFor="property-id" className="mb-1.5 block text-sm text-slate-300">
            Imóvel
          </label>
          <select
            id="property-id"
            value={propertyId}
            onChange={(event) => onPropertyIdChange(event.target.value)}
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
          disabled={!tenantId}
          className="w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {tenantId ? 'Criar Ordem de Serviço' : 'Aguardando tenant'}
        </button>
      </form>
    </>
  );
}
