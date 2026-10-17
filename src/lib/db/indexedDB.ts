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

export const indexedDB = new FixProDB();

export const workOrdersTable = indexedDB.table('work_orders');
export const propertiesTable = indexedDB.table('properties');

export async function getCachedProperties(tenantId: string): Promise<LocalProperty[]> {
  return propertiesTable.where('tenant_id').equals(tenantId).sortBy('name');
}

export async function cacheProperties(properties: Property[]): Promise<void> {
  if (properties.length > 0) {
    await indexedDB.transaction('rw', propertiesTable, async () => {
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
  await indexedDB.transaction('rw', propertiesTable, async () => {
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
