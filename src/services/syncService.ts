import { supabase } from '../lib/supabase/client';
import {
  getPendingSyncProperties,
  getPendingSyncWorkOrders,
  db,
  markPropertySynced,
  markWorkOrderSynced,
  pruneSyncedRecords,
  workOrdersTable,
  type LocalWorkOrderDraft,
} from '../lib/db/indexedDB';

export type RemoteSyncHandler = (workOrder: LocalWorkOrderDraft) => Promise<void>;

export async function syncPendingProperties(tenantId: string): Promise<void> {
  const pending = await getPendingSyncProperties(tenantId);

  const failures: string[] = [];

  for (const property of pending) {
    const { error } = await supabase.from('properties').upsert(
      {
        id: property.id,
        tenant_id: property.tenant_id,
        name: property.name,
        address: property.address,
        created_at: property.created_at,
      },
      { onConflict: 'id' },
    );

    if (error) {
      failures.push(`"${property.name}": ${error.message}`);
      continue;
    }

    await markPropertySynced(property.id, property.last_modified);
  }

  if (failures.length > 0) {
    throw new Error(`Falha ao sincronizar imóvel(is) — ${failures.join('; ')}`);
  }
}

export async function pullRemoteWorkOrders(tenantId: string): Promise<void> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, tenant_id, property_id, title, description, status, priority, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar ordens do Supabase: ${error.message}`);
  }

  await pruneSyncedRecords(
    'work_orders',
    tenantId,
    (data ?? []).map((remoteOrder) => remoteOrder.id),
  );

  await db.transaction('rw', workOrdersTable, async () => {
    for (const remoteOrder of data ?? []) {
      const localOrder = await workOrdersTable.get(remoteOrder.id);

      if (localOrder && localOrder.sync_status !== 'synced') {
        continue;
      }

      await workOrdersTable.put({
        ...remoteOrder,
        sync_status: 'synced',
        last_modified: remoteOrder.updated_at,
      });
    }
  });
}

async function defaultRemoteSyncHandler(workOrder: LocalWorkOrderDraft): Promise<void> {
  const safePayload = {
    id: workOrder.id,
    tenant_id: workOrder.tenant_id,
    property_id: workOrder.property_id,
    title: workOrder.title,
    description: workOrder.description,
    status: workOrder.status,
    priority: workOrder.priority,
    created_at: workOrder.created_at,
    updated_at: workOrder.updated_at,
  };

  const { error } = await supabase.from('work_orders').upsert(safePayload, {
    onConflict: 'id',
  });

  if (error) {
    throw new Error(`Falha ao sincronizar com o Supabase: ${error.message}`);
  }
}

export async function syncPendingWorkOrders(
  tenantId: string,
  remoteSyncHandler: RemoteSyncHandler = defaultRemoteSyncHandler,
): Promise<LocalWorkOrderDraft[]> {
  const pending = await getPendingSyncWorkOrders(tenantId);

  if (pending.length === 0) {
    return [];
  }

  const synced: LocalWorkOrderDraft[] = [];
  const failures: string[] = [];

  for (const workOrder of pending) {
    try {
      await remoteSyncHandler(workOrder);
      await markWorkOrderSynced(workOrder.id, workOrder.last_modified);
      synced.push(workOrder);
    } catch (error) {
      failures.push(
        `"${workOrder.title}": ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Falha ao sincronizar ordem(ns) — ${failures.join('; ')}`);
  }

  return synced;
}
