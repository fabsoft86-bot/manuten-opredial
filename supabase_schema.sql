create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name text,
  role text not null check (role in ('admin', 'technician', 'client')),
  constraint profiles_id_organization_id_key unique (id, organization_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  created_by uuid not null,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  constraint tickets_created_by_same_organization
    foreign key (created_by, organization_id)
    references public.profiles (id, organization_id),
  constraint tickets_assigned_to_same_organization
    foreign key (assigned_to, organization_id)
    references public.profiles (id, organization_id)
);

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.organization_id
  from public.profiles as profile
  where profile.id = (select auth.uid())
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
$$;

revoke all on function public.current_user_organization_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.tickets to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;

create policy "Organization members can read their organization"
  on public.organizations for select to authenticated
  using (id = (select public.current_user_organization_id()));

create policy "Organization admins can update their organization"
  on public.organizations for update to authenticated
  using (
    id = (select public.current_user_organization_id())
    and (select public.current_user_role()) = 'admin'
  )
  with check (id = (select public.current_user_organization_id()));

create policy "Users can read profiles in their organization"
  on public.profiles for select to authenticated
  using (organization_id = (select public.current_user_organization_id()));

create policy "Organization admins can add profiles"
  on public.profiles for insert to authenticated
  with check (
    organization_id = (select public.current_user_organization_id())
    and (select public.current_user_role()) = 'admin'
  );

create policy "Organization admins can update profiles"
  on public.profiles for update to authenticated
  using (
    organization_id = (select public.current_user_organization_id())
    and (select public.current_user_role()) = 'admin'
  )
  with check (organization_id = (select public.current_user_organization_id()));

create policy "Organization admins can delete profiles"
  on public.profiles for delete to authenticated
  using (
    organization_id = (select public.current_user_organization_id())
    and (select public.current_user_role()) = 'admin'
  );

create policy "Users can read tickets in their organization"
  on public.tickets for select to authenticated
  using (organization_id = (select public.current_user_organization_id()));

create policy "Organization members can create tickets"
  on public.tickets for insert to authenticated
  with check (
    organization_id = (select public.current_user_organization_id())
    and created_by = (select auth.uid())
  );

create policy "Organization admins and technicians can update tickets"
  on public.tickets for update to authenticated
  using (
    organization_id = (select public.current_user_organization_id())
    and (select public.current_user_role()) in ('admin', 'technician')
  )
  with check (
    organization_id = (select public.current_user_organization_id())
    and (select public.current_user_role()) in ('admin', 'technician')
  );

create policy "Organization admins can delete tickets"
  on public.tickets for delete to authenticated
  using (
    organization_id = (select public.current_user_organization_id())
    and (select public.current_user_role()) = 'admin'
  );

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do update set public = excluded.public;

create policy "Organization members can upload ticket attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[1] = (select public.current_user_organization_id())::text
  );

create policy "Organization members can delete ticket attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[1] = (select public.current_user_organization_id())::text
  );

-- Organizations and initial profiles must be provisioned by a trusted backend or administrator.
-- Do not create organization membership or grant roles from user-editable auth metadata.
