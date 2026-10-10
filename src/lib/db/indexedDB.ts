import Dexie, { type Table } from 'dexie';

import type {
  LocalWorkOrderDraft,
} from '../../types/database';

export type { LocalWorkOrderDraft } from '../../types/database';
export type WorkOrderSyncStatus = LocalWorkOrderDraft['sync_status'];

class FixProDB extends Dexie {
  work_orders!: Table<LocalWorkOrderDraft, string>;

  constructor() {
    super('fixpro-offline-db');

    this.version(1).stores({
      work_orders:
        '&id, tenant_id, property_id, status, priority, sync_status, last_modified, created_at, updated_at',
    });
  }
}

export const indexedDB = new FixProDB();

export const workOrdersTable = indexedDB.table('work_orders');

export async function createLocalWorkOrder(
  input: Omit<LocalWorkOrderDraft, 'sync_status' | 'last_modified'>,
): Promise<LocalWorkOrderDraft> {
  const now = new Date().toISOString();
  const workOrder: LocalWorkOrderDraft = {
    ...input,
    sync_status: 'pending_created',
    last_modified: now,
  };

  await workOrdersTable.put(workOrder);

  return workOrder;
}

export async function markWorkOrderUpdated(id: string): Promise<void> {
  const existing = await workOrdersTable.get(id);
  if (!existing) {
    return;
  }

  await workOrdersTable.update(id, {
    sync_status: 'pending_updated',
    last_modified: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function markWorkOrderSynced(
  id: string,
  expectedLastModified: string,
): Promise<void> {
  await indexedDB.transaction('rw', workOrdersTable, async () => {
    const current = await workOrdersTable.get(id);
    if (!current || current.last_modified !== expectedLastModified) {
      return;
    }

    await workOrdersTable.update(id, {
      sync_status: 'synced',
      last_modified: new Date().toISOString(),
    });
  });
}

export async function getPendingSyncWorkOrders(tenantId: string): Promise<LocalWorkOrderDraft[]> {
  const items = await workOrdersTable
    .where('sync_status')
    .anyOf(['pending_created', 'pending_updated'])
    .toArray();

  return items.filter((item) => item.tenant_id === tenantId);
}
