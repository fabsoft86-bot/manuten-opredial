import {
  workOrdersTable,
  type LocalWorkOrderDraft,
} from '../lib/db/indexedDB';

import type { WorkOrder, WorkOrderPriority, WorkOrderStatus } from '../types/database';

export type WorkOrderCreateInput = Pick<
  LocalWorkOrderDraft,
  'tenant_id' | 'property_id' | 'title' | 'description' | 'status' | 'priority'
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WorkOrderUpdateInput = Partial<
  Pick<
    LocalWorkOrderDraft,
    'tenant_id' | 'property_id' | 'title' | 'description' | 'status' | 'priority'
  >
> & {
  updated_at?: string;
};

function buildId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `wo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getWorkOrders(tenantId: string): Promise<LocalWorkOrderDraft[]> {
  return workOrdersTable
    .where('tenant_id')
    .equals(tenantId)
    .reverse()
    .sortBy('last_modified');
}

async function createWorkOrder(
  data: WorkOrderCreateInput,
): Promise<LocalWorkOrderDraft> {
  const now = new Date().toISOString();
  const workOrder: LocalWorkOrderDraft = {
    id: data.id ?? buildId(),
    tenant_id: data.tenant_id,
    property_id: data.property_id ?? null,
    title: data.title,
    description: data.description ?? null,
    status: data.status,
    priority: data.priority,
    created_at: data.created_at ?? now,
    updated_at: data.updated_at ?? now,
    sync_status: 'pending_created',
    last_modified: now,
  };

  await workOrdersTable.put(workOrder);

  return workOrder;
}

async function updateWorkOrder(
  id: string,
  data: WorkOrderUpdateInput,
): Promise<LocalWorkOrderDraft | null> {
  const existing = await workOrdersTable.get(id);

  if (!existing) {
    return null;
  }

  const requestedUpdatedAt = Date.parse(data.updated_at ?? new Date().toISOString());
  const previousModifiedAt = Date.parse(existing.last_modified);
  const updatedAt = new Date(Math.max(requestedUpdatedAt, previousModifiedAt + 1)).toISOString();
  const updatedWorkOrder: LocalWorkOrderDraft = {
    ...existing,
    ...data,
    updated_at: updatedAt,
    last_modified: updatedAt,
    sync_status: existing.sync_status === 'pending_created' ? 'pending_created' : 'pending_updated',
  };

  await workOrdersTable.put(updatedWorkOrder);

  return updatedWorkOrder;
}

export const workOrderRepository = {
  getWorkOrders,
  createWorkOrder,
  updateWorkOrder,
};

export type { LocalWorkOrderDraft, WorkOrder, WorkOrderPriority, WorkOrderStatus };
