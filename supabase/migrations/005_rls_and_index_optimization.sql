-- Gestão CX RARS V2.0 — otimização de RLS e índices

-- Recria policies usando (select auth.uid()) para evitar reavaliação por linha.
drop policy if exists "profile_self_read" on public.profiles;
create policy "profile_self_read" on public.profiles
for select using (id = (select auth.uid()));

create policy "profile_self_update" on public.profiles
for update using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "manager_reads_assigned_employees" on public.employees;
create policy "manager_reads_assigned_employees" on public.employees
for select using (
  exists (
    select 1 from public.manager_assignments ma
    where ma.employee_id = employees.id
      and ma.manager_id = (select auth.uid())
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
);

drop policy if exists "manager_reads_own_assignments" on public.manager_assignments;
create policy "manager_reads_own_assignments" on public.manager_assignments
for select using (manager_id = (select auth.uid()));

drop policy if exists "manager_reads_own_records" on public.module_records;
create policy "manager_reads_own_records" on public.module_records
for select using (manager_id = (select auth.uid()));

drop policy if exists "manager_inserts_assigned_records" on public.module_records;
create policy "manager_inserts_assigned_records" on public.module_records
for insert with check (
  manager_id = (select auth.uid())
  and exists (
    select 1 from public.manager_assignments ma
    where ma.manager_id = (select auth.uid())
      and ma.employee_id = module_records.employee_id
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
);

drop policy if exists "manager_updates_assigned_records" on public.module_records;
create policy "manager_updates_assigned_records" on public.module_records
for update using (
  manager_id = (select auth.uid())
  and exists (
    select 1 from public.manager_assignments ma
    where ma.manager_id = (select auth.uid())
      and ma.employee_id = module_records.employee_id
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
) with check (
  manager_id = (select auth.uid())
  and exists (
    select 1 from public.manager_assignments ma
    where ma.manager_id = (select auth.uid())
      and ma.employee_id = module_records.employee_id
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
);

drop policy if exists "manager_reads_participant_responses" on public.participant_responses;
create policy "manager_reads_participant_responses" on public.participant_responses
for select using (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_responses.record_id
      and mr.manager_id = (select auth.uid())
  )
);

drop policy if exists "manager_reads_participant_tokens" on public.participant_access_tokens;
create policy "manager_reads_participant_tokens" on public.participant_access_tokens
for select using (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = (select auth.uid())
  )
);

drop policy if exists "manager_creates_participant_tokens" on public.participant_access_tokens;
create policy "manager_creates_participant_tokens" on public.participant_access_tokens
for insert with check (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = (select auth.uid())
  )
);

drop policy if exists "manager_revokes_participant_tokens" on public.participant_access_tokens;
create policy "manager_revokes_participant_tokens" on public.participant_access_tokens
for update using (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = (select auth.uid())
  )
);

-- Dependências: o gestor só vê/cria relações entre registros sob sua gestão.
create policy "manager_reads_record_dependencies" on public.record_dependencies
for select using (
  exists (select 1 from public.module_records s where s.id = source_record_id and s.manager_id = (select auth.uid()))
  and exists (select 1 from public.module_records t where t.id = target_record_id and t.manager_id = (select auth.uid()))
);

create policy "manager_creates_record_dependencies" on public.record_dependencies
for insert with check (
  exists (select 1 from public.module_records s where s.id = source_record_id and s.manager_id = (select auth.uid()))
  and exists (select 1 from public.module_records t where t.id = target_record_id and t.manager_id = (select auth.uid()))
);

-- Revisões: histórico vinculado a registros do próprio gestor.
create policy "manager_reads_record_revisions" on public.record_revisions
for select using (
  exists (select 1 from public.module_records mr where mr.id = record_id and mr.manager_id = (select auth.uid()))
);

create policy "manager_creates_record_revisions" on public.record_revisions
for insert with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.module_records mr where mr.id = record_id and mr.manager_id = (select auth.uid()))
);

-- Anexos: acesso somente quando vinculados a pessoa atribuída ou registro do gestor.
create policy "manager_reads_attachments" on public.attachments
for select using (
  (employee_id is not null and exists (
    select 1 from public.manager_assignments ma
    where ma.employee_id = attachments.employee_id
      and ma.manager_id = (select auth.uid())
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  ))
  or
  (record_id is not null and exists (
    select 1 from public.module_records mr
    where mr.id = attachments.record_id
      and mr.manager_id = (select auth.uid())
  ))
);

create policy "manager_creates_attachments" on public.attachments
for insert with check (
  created_by = (select auth.uid())
  and (
    (employee_id is not null and exists (
      select 1 from public.manager_assignments ma
      where ma.employee_id = attachments.employee_id
        and ma.manager_id = (select auth.uid())
        and ma.starts_on <= current_date
        and (ma.ends_on is null or ma.ends_on >= current_date)
    ))
    or
    (record_id is not null and exists (
      select 1 from public.module_records mr
      where mr.id = attachments.record_id
        and mr.manager_id = (select auth.uid())
    ))
  )
);

-- Fontes legadas: visíveis e graváveis apenas para a equipe sob gestão.
create policy "manager_reads_legacy_sources" on public.legacy_sources
for select using (
  (employee_id is not null and exists (
    select 1 from public.manager_assignments ma
    where ma.employee_id = legacy_sources.employee_id
      and ma.manager_id = (select auth.uid())
  ))
  or
  (record_id is not null and exists (
    select 1 from public.module_records mr
    where mr.id = legacy_sources.record_id
      and mr.manager_id = (select auth.uid())
  ))
);

create policy "manager_creates_legacy_sources" on public.legacy_sources
for insert with check (
  (employee_id is not null and exists (
    select 1 from public.manager_assignments ma
    where ma.employee_id = legacy_sources.employee_id
      and ma.manager_id = (select auth.uid())
  ))
  or
  (record_id is not null and exists (
    select 1 from public.module_records mr
    where mr.id = legacy_sources.record_id
      and mr.manager_id = (select auth.uid())
  ))
);

-- Auditoria: o gestor lê eventos próprios ou relacionados à sua equipe e grava apenas como si mesmo.
create policy "manager_reads_audit_events" on public.audit_events
for select using (
  actor_id = (select auth.uid())
  or (employee_id is not null and exists (
    select 1 from public.manager_assignments ma
    where ma.employee_id = audit_events.employee_id
      and ma.manager_id = (select auth.uid())
  ))
  or (record_id is not null and exists (
    select 1 from public.module_records mr
    where mr.id = audit_events.record_id
      and mr.manager_id = (select auth.uid())
  ))
);

create policy "manager_creates_audit_events" on public.audit_events
for insert with check (actor_id = (select auth.uid()));

-- Índices de FKs e caminhos de consulta.
create index if not exists manager_assignments_employee_idx on public.manager_assignments(employee_id);
create index if not exists participant_access_tokens_record_idx on public.participant_access_tokens(record_id);
create index if not exists record_dependencies_target_idx on public.record_dependencies(target_record_id);
create index if not exists record_revisions_created_by_idx on public.record_revisions(created_by);
create index if not exists attachments_employee_idx on public.attachments(employee_id);
create index if not exists attachments_record_idx on public.attachments(record_id);
create index if not exists attachments_created_by_idx on public.attachments(created_by);
create index if not exists legacy_sources_employee_idx on public.legacy_sources(employee_id);
create index if not exists legacy_sources_record_idx on public.legacy_sources(record_id);
create index if not exists audit_events_actor_idx on public.audit_events(actor_id);
create index if not exists audit_events_employee_idx on public.audit_events(employee_id);
create index if not exists audit_events_record_idx on public.audit_events(record_id);
