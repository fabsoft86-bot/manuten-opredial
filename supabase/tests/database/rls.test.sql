-- Testes de RLS (pgTAP). Rodam com: supabase test db
-- Garantem o isolamento entre clientes (tenants) e as permissões por papel.
begin;
select plan(15);

-- ---------------------------------------------------------------- dados
-- Tudo abaixo é criado como superusuário (ignora RLS) e desfeito no rollback.
insert into public.tenants (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Cliente A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Cliente B');

insert into auth.users (id, email) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'admin-a@teste.local'),
  ('a2a2a2a2-0000-0000-0000-000000000002', 'tecnico-a@teste.local'),
  ('a3a3a3a3-0000-0000-0000-000000000003', 'leitor-a@teste.local'),
  ('b1b1b1b1-0000-0000-0000-000000000004', 'admin-b@teste.local');

insert into public.profiles (id, tenant_id, role) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('a2a2a2a2-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'technician'),
  ('a3a3a3a3-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'viewer'),
  ('b1b1b1b1-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'admin');

insert into public.properties (id, tenant_id, name) values
  ('a0a0a0a0-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'Predio A'),
  ('b0b0b0b0-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'Predio B');

insert into public.work_orders (id, tenant_id, title, status, priority) values
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'OS A original', 'open', 'normal'),
  ('b0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000002', 'OS B original', 'open', 'normal');

-- ------------------------------------------- admin do cliente A: isolamento
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1a1a1a1-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.work_orders), 1::bigint,
  'admin A enxerga só as ordens do cliente A');
select is((select count(*) from public.tenants), 1::bigint,
  'admin A enxerga só o próprio tenant');
select is((select count(*) from public.profiles), 1::bigint,
  'admin A enxerga só o próprio perfil');
select is((select count(*) from public.properties), 1::bigint,
  'admin A enxerga só os imóveis do cliente A');

select throws_ok(
  $$ insert into public.work_orders (tenant_id, title, status, priority)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'invasao', 'open', 'normal') $$,
  '42501', null, 'admin A não cria ordem no tenant B');

select throws_ok(
  $$ insert into public.work_orders (tenant_id, property_id, title, status, priority)
     values ('aaaaaaaa-0000-0000-0000-000000000001',
             'b0b0b0b0-0000-0000-0000-00000000000b', 'imovel alheio', 'open', 'normal') $$,
  '23514', null, 'ordem do tenant A não pode apontar para imóvel do tenant B');

update public.work_orders set title = 'hackeada'
  where id = 'b0000000-0000-0000-0000-0000000000b1';
delete from public.work_orders where id = 'b0000000-0000-0000-0000-0000000000b1';

-- Sem política de UPDATE em profiles, a RLS bloqueia em silêncio (0 linhas).
-- O resultado é conferido depois do reset role.
update public.profiles set tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  where id = 'a1a1a1a1-0000-0000-0000-000000000001';

select lives_ok(
  $$ insert into public.properties (tenant_id, name)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Predio novo') $$,
  'admin A cadastra imóvel no próprio tenant');

reset role;
select is((select title from public.work_orders
           where id = 'b0000000-0000-0000-0000-0000000000b1'),
  'OS B original', 'ordem do tenant B continua intacta (update e delete do admin A não tiveram efeito)');

select is((select tenant_id from public.profiles
           where id = 'a1a1a1a1-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'usuário não consegue trocar o próprio tenant');

-- --------------------------------------------------- técnico do cliente A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.work_orders (tenant_id, title, status, priority)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'OS do tecnico', 'open', 'normal') $$,
  'técnico cria ordem');

select throws_ok(
  $$ insert into public.properties (tenant_id, name)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'tecnico nao pode') $$,
  '42501', null, 'técnico não cadastra imóvel');

delete from public.work_orders where id = 'a0000000-0000-0000-0000-0000000000a1';

reset role;
select is((select count(*) from public.work_orders
           where id = 'a0000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'técnico não consegue excluir ordem');

-- --------------------------------------------------- leitor do cliente A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a3a3a3a3-0000-0000-0000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.work_orders (tenant_id, title, status, priority)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'leitor nao pode', 'open', 'normal') $$,
  '42501', null, 'leitor (viewer) não cria ordem');

update public.work_orders set title = 'leitor editou'
  where id = 'a0000000-0000-0000-0000-0000000000a1';

reset role;
select is((select title from public.work_orders
           where id = 'a0000000-0000-0000-0000-0000000000a1'),
  'OS A original', 'leitor não consegue editar ordem');

-- ---------------------------------------------------------- sem login (anon)
set local role anon;
select is((select count(*) from public.work_orders), 0::bigint,
  'sem login não se vê nenhuma ordem');

select * from finish();
rollback;
