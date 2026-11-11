-- Endurecimento de segurança (executar depois de 003_role_permissions.sql).

-- 1) Fixa o search_path da função de trigger existente.
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- 2) Impede que uma ordem de serviço aponte para um imóvel de outro tenant.
CREATE OR REPLACE FUNCTION public.enforce_work_order_property_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.properties AS property
    WHERE property.id = NEW.property_id
      AND property.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O imóvel informado não pertence ao tenant da ordem de serviço.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_orders_property_tenant ON public.work_orders;
CREATE TRIGGER trg_work_orders_property_tenant
BEFORE INSERT OR UPDATE OF property_id, tenant_id ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_work_order_property_tenant();
