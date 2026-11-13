CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.role
  FROM public.profiles AS profile
  WHERE profile.id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS properties_tenant_access ON public.properties;
DROP POLICY IF EXISTS properties_tenant_read ON public.properties;
DROP POLICY IF EXISTS properties_tenant_insert ON public.properties;
DROP POLICY IF EXISTS properties_tenant_update ON public.properties;
DROP POLICY IF EXISTS properties_tenant_delete ON public.properties;

CREATE POLICY properties_tenant_read
  ON public.properties FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY properties_tenant_insert
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager')
  );

CREATE POLICY properties_tenant_update
  ON public.properties FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager')
  );

CREATE POLICY properties_tenant_delete
  ON public.properties FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS work_orders_tenant_access ON public.work_orders;
DROP POLICY IF EXISTS work_orders_tenant_read ON public.work_orders;
DROP POLICY IF EXISTS work_orders_tenant_insert ON public.work_orders;
DROP POLICY IF EXISTS work_orders_tenant_update ON public.work_orders;
DROP POLICY IF EXISTS work_orders_tenant_delete ON public.work_orders;

CREATE POLICY work_orders_tenant_read
  ON public.work_orders FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY work_orders_tenant_insert
  ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager', 'technician')
  );

CREATE POLICY work_orders_tenant_update
  ON public.work_orders FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager', 'technician')
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager', 'technician')
  );

CREATE POLICY work_orders_tenant_delete
  ON public.work_orders FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_user_role()) IN ('admin', 'manager')
  );
