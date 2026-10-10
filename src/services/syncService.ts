import { supabase } from '../lib/supabase/client';
import {
  getPendingSyncWorkOrders,
  indexedDB,
  markWorkOrderSynced,
  workOrdersTable,
  type LocalWorkOrderDraft,
} from '../lib/db/indexedDB';

export type RemoteSyncHandler = (workOrder: LocalWorkOrderDraft) => Promise<void>;

export async function pullRemoteWorkOrders(tenantId: string): Promise<void> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, tenant_id, property_id, title, description, status, priority, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar ordens do Supabase: ${error.message}`);
  }

  await indexedDB.transaction('rw', workOrdersTable, async () => {
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

  for (const workOrder of pending) {
    await remoteSyncHandler(workOrder);
    await markWorkOrderSynced(workOrder.id, workOrder.last_modified);
  }

  return pending;
}
