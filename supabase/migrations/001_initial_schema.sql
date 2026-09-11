-- Gestão CX RARS V2.0 — schema inicial
-- PostgreSQL / Supabase

create extension if not exists pgcrypto;

create type public.app_role as enum ('manager', 'admin');
create type public.module_type as enum ('marco_zero','ninety_days','competencies','pdi','feedback','talent');
create type public.record_status as enum ('draft','awaiting_participant','participant_submitted','in_conversation','active','in_review','completed','archived','cancelled');
create type public.dependency_type as enum ('source_for','previous_cycle','evidence_for','derived_from');
create type public.legacy_integrity as enum ('unverified','verified','reference_only','migration_failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  current_role text,
  current_squad text,
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manager_assignments (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id),
  employee_id uuid not null references public.employees(id),
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique(manager_id, employee_id, starts_on)
);

create table public.module_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  manager_id uuid not null references public.profiles(id),
  module_type public.module_type not null,
  status public.record_status not null default 'draft',
  cycle_label text,
  occurred_on date,
  payload jsonb not null default '{}'::jsonb,
  private_notes text,
  participant_locked_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  imported_from_legacy boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index module_records_employee_idx on public.module_records(employee_id, created_at desc);
create index module_records_manager_idx on public.module_records(manager_id, status);
create index module_records_type_idx on public.module_records(module_type, status);

create table public.participant_responses (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.module_records(id) on delete restrict,
  version integer not null default 1,
  response_payload jsonb not null default '{}'::jsonb,
  is_submitted boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(record_id, version)
);

create table public.participant_access_tokens (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.module_records(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.record_dependencies (
  source_record_id uuid not null references public.module_records(id) on delete restrict,
  target_record_id uuid not null references public.module_records(id) on delete restrict,
  relation_type public.dependency_type not null,
  created_at timestamptz not null default now(),
  primary key(source_record_id, target_record_id, relation_type),
  check (source_record_id <> target_record_id)
);

create table public.record_revisions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.module_records(id) on delete restrict,
  revision_no integer not null,
  snapshot jsonb not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(record_id, revision_no)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete restrict,
  record_id uuid references public.module_records(id) on delete restrict,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  document_kind text,
  visibility text not null default 'manager' check (visibility in ('manager','shared')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (employee_id is not null or record_id is not null)
);

create table public.legacy_sources (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete restrict,
  record_id uuid references public.module_records(id) on delete restrict,
  source_kind text not null check (source_kind in ('v1_url','file','pdf','manual_reference','other')),
  source_locator text not null,
  module_type public.module_type,
  original_status text,
  original_date date,
  integrity public.legacy_integrity not null default 'unverified',
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  employee_id uuid references public.employees(id),
  record_id uuid references public.module_records(id),
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.manager_assignments enable row level security;
alter table public.module_records enable row level security;
alter table public.participant_responses enable row level security;
alter table public.record_dependencies enable row level security;
alter table public.record_revisions enable row level security;
alter table public.attachments enable row level security;
alter table public.legacy_sources enable row level security;
alter table public.audit_events enable row level security;

create policy "profile_self_read" on public.profiles
for select using (id = auth.uid());

create policy "manager_reads_assigned_employees" on public.employees
for select using (
  exists (
    select 1 from public.manager_assignments ma
    where ma.employee_id = employees.id
      and ma.manager_id = auth.uid()
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
);

create policy "manager_reads_own_records" on public.module_records
for select using (manager_id = auth.uid());

create policy "manager_inserts_own_records" on public.module_records
for insert with check (manager_id = auth.uid());

create policy "manager_updates_own_records" on public.module_records
for update using (manager_id = auth.uid()) with check (manager_id = auth.uid());

-- Sem DELETE físico em module_records. Exclusão funcional usa deleted_at
-- e valida dependências no serviço de domínio.
