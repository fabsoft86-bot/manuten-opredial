import { supabase } from '../lib/supabase/client';
import {
  cacheProperties,
  getCachedProperties,
  propertiesTable,
} from '../lib/db/indexedDB';
import type { LocalProperty } from '../types/database';

export async function getProperties(tenantId: string): Promise<LocalProperty[]> {
  const cachedProperties = await getCachedProperties(tenantId);
  if (!navigator.onLine) {
    return cachedProperties;
  }

  const { data, error } = await supabase
    .from('properties')
    .select('id, tenant_id, name, address, created_at')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error) {
    if (cachedProperties.length > 0) {
      return cachedProperties;
    }
    throw new Error(`Falha ao carregar imóveis: ${error.message}`);
  }

  const properties = data ?? [];
  await cacheProperties(properties);
  const pendingById = new Map(
    cachedProperties
      .filter((property) => property.sync_status !== 'synced')
      .map((property) => [property.id, property]),
  );
  const syncedProperties = properties.map((property) =>
    pendingById.get(property.id) ?? {
      ...property,
      sync_status: 'synced' as const,
      last_modified: property.created_at,
    },
  );
  const currentIds = new Set(syncedProperties.map((property) => property.id));
  return [
    ...syncedProperties,
    ...cachedProperties.filter(
      (property) => property.sync_status !== 'synced' && !currentIds.has(property.id),
    ),
  ].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

export async function createProperty(
  tenantId: string,
  name: string,
  address: string | null,
): Promise<LocalProperty> {
  if (!navigator.onLine) {
    const now = new Date().toISOString();
    const localProperty: LocalProperty = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `property-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tenant_id: tenantId,
      name,
      address,
      created_at: now,
      sync_status: 'pending_created',
      last_modified: now,
    };

    await propertiesTable.put(localProperty);
    return localProperty;
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({ tenant_id: tenantId, name, address })
    .select('id, tenant_id, name, address, created_at')
    .single();

  if (error) {
    throw new Error(`Falha ao cadastrar imóvel: ${error.message}`);
  }

  await cacheProperties([data]);
  return { ...data, sync_status: 'synced', last_modified: data.created_at };
}

export async function updateProperty(
  tenantId: string,
  propertyId: string,
  name: string,
  address: string | null,
): Promise<LocalProperty> {
  if (!navigator.onLine) {
    const existing = await propertiesTable.get(propertyId);
    if (!existing) {
      throw new Error('Imóvel não encontrado no cache local. Conecte-se para carregá-lo antes de editar.');
    }

    const updatedProperty: LocalProperty = {
      ...existing,
      name,
      address,
      sync_status: existing.sync_status === 'pending_created' ? 'pending_created' : 'pending_updated',
      last_modified: new Date().toISOString(),
    };
    await propertiesTable.put(updatedProperty);
    return updatedProperty;
  }

  const { data, error } = await supabase
    .from('properties')
    .update({ name, address })
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .select('id, tenant_id, name, address, created_at')
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar imóvel: ${error.message}`);
  }

  await cacheProperties([data]);
  return { ...data, sync_status: 'synced', last_modified: data.created_at };
}