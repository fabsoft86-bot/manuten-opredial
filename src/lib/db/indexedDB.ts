import Dexie, { type Table } from 'dexie';

import type { LocalProperty, LocalWorkOrderDraft, Property } from '../../types/database';

export type { LocalWorkOrderDraft } from '../../types/database';
export type WorkOrderSyncStatus = LocalWorkOrderDraft['sync_status'];

class FixProDB extends Dexie {
  work_orders!: Table<LocalWorkOrderDraft, string>;
  properties!: Table<LocalProperty, string>;

  constructor() {
    super('fixpro-offline-db');

    this.version(1).stores({
      work_orders:
        '&id, tenant_id, property_id, status, priority, sync_status, last_modified, created_at, updated_at',
    });

    this.version(2).stores({
      work_orders:
        '&id, tenant_id, property_id, status, priority, sync_status, last_modified, created_at, updated_at',
      properties: '&id, tenant_id, name',
    });

    this.version(3)
      .stores({
        work_orders:
          '&id, tenant_id, property_id, status, priority, sync_status, last_modified, created_at, updated_at',
        properties: '&id, tenant_id, name, sync_status, last_modified',
      })
      .upgrade(async (transaction) => {
        await transaction.table('properties').toCollection().modify((property) => {
          property.sync_status ??= 'synced';
          property.last_modified ??= property.created_at;
        });
      });
  }
}

export const db = new FixProDB();

export const workOrdersTable = db.table('work_orders');
export const propertiesTable = db.table('properties');

export async function getCachedProperties(tenantId: string): Promise<LocalProperty[]> {
  return propertiesTable.where('tenant_id').equals(tenantId).sortBy('name');
}

export async function cacheProperties(properties: Property[]): Promise<void> {
  if (properties.length > 0) {
    await db.transaction('rw', propertiesTable, async () => {
      for (const property of properties) {
        const existing = await propertiesTable.get(property.id);
        if (existing && existing.sync_status !== 'synced') {
          continue;
        }

        await propertiesTable.put({
          ...property,
          sync_status: 'synced',
          last_modified: property.created_at,
        });
      }
    });
  }
}

/**
 * Remove do cache local os itens já sincronizados que não existem mais no servidor.
 * Itens com alterações pendentes nunca são removidos.
 */
export async function pruneSyncedRecords(
  table: 'work_orders' | 'properties',
  tenantId: string,
  remoteIds: Iterable<string>,
): Promise<void> {
  const keep = new Set(remoteIds);
  const target = db.table(table);

  await db.transaction('rw', target, async () => {
    const staleIds = (await target.where('tenant_id').equals(tenantId).toArray())
      .filter((item) => item.sync_status === 'synced' && !keep.has(item.id))
      .map((item) => item.id);

    if (staleIds.length > 0) {
      await target.bulkDelete(staleIds);
    }
  });
}

export async function getPendingSyncProperties(tenantId: string): Promise<LocalProperty[]> {
  const properties = await propertiesTable
    .where('sync_status')
    .anyOf(['pending_created', 'pending_updated'])
    .toArray();

  return properties.filter((property) => property.tenant_id === tenantId);
}

export async function markPropertySynced(
  id: string,
  expectedLastModified: string,
): Promise<void> {
  await db.transaction('rw', propertiesTable, async () => {
    const current = await propertiesTable.get(id);
    if (!current || current.last_modified !== expectedLastModified) {
      return;
    }

    await propertiesTable.update(id, {
      sync_status: 'synced',
      last_modified: new Date().toISOString(),
    });
  });
}

export async function markWorkOrderSynced(
  id: string,
  expectedLastModified: string,
): Promise<void> {
  await db.transaction('rw', workOrdersTable, async () => {
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
