CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'technician', 'viewer')),
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('draft', 'open', 'in_progress', 'pending_review', 'completed', 'cancelled')),
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.tenant_id
  FROM public.profiles AS profile
  WHERE profile.id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

DROP POLICY IF EXISTS tenants_isolation ON public.tenants;
DROP POLICY IF EXISTS profiles_isolation ON public.profiles;
DROP POLICY IF EXISTS properties_isolation ON public.properties;
DROP POLICY IF EXISTS work_orders_isolation ON public.work_orders;
DROP POLICY IF EXISTS tenants_read_own ON public.tenants;
DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
DROP POLICY IF EXISTS properties_tenant_access ON public.properties;
DROP POLICY IF EXISTS work_orders_tenant_access ON public.work_orders;

CREATE POLICY tenants_read_own
  ON public.tenants FOR SELECT TO authenticated
  USING (id = (SELECT public.current_tenant_id()));

CREATE POLICY profiles_read_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY properties_tenant_access
  ON public.properties FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY work_orders_tenant_access
  ON public.work_orders FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

GRANT SELECT ON public.tenants, public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.work_orders TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_orders_set_updated_at ON public.work_orders;
CREATE TRIGGER trg_work_orders_set_updated_at
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id
  ON public.profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_properties_tenant_id
  ON public.properties (tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_id
  ON public.work_orders (tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_property_id
  ON public.work_orders (property_id);
