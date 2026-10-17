export type UserRole = 'admin' | 'manager' | 'technician' | 'viewer';
export type WorkOrderStatus =
  | 'draft'
  | 'open'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'cancelled';
export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SyncStatus = 'synced' | 'pending_created' | 'pending_updated';

export interface Tenant {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface LocalProperty extends Property {
  sync_status: SyncStatus;
  last_modified: string;
}

export interface WorkOrder {
  id: string;
  tenant_id: string;
  property_id: string | null;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  created_at: string;
  updated_at: string;
}

export interface LocalWorkOrderDraft extends WorkOrder {
  sync_status: SyncStatus;
  last_modified: string;
}

export type OfflineWorkOrder = LocalWorkOrderDraft;
