-- Gestão CX RARS V2.0 — endurecimento das políticas de escrita

drop policy if exists "manager_inserts_own_records" on public.module_records;
drop policy if exists "manager_updates_own_records" on public.module_records;

create policy "manager_inserts_assigned_records" on public.module_records
for insert with check (
  manager_id = auth.uid()
  and exists (
    select 1
    from public.manager_assignments ma
    where ma.manager_id = auth.uid()
      and ma.employee_id = module_records.employee_id
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
);

create policy "manager_updates_assigned_records" on public.module_records
for update using (
  manager_id = auth.uid()
  and exists (
    select 1
    from public.manager_assignments ma
    where ma.manager_id = auth.uid()
      and ma.employee_id = module_records.employee_id
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
) with check (
  manager_id = auth.uid()
  and exists (
    select 1
    from public.manager_assignments ma
    where ma.manager_id = auth.uid()
      and ma.employee_id = module_records.employee_id
      and ma.starts_on <= current_date
      and (ma.ends_on is null or ma.ends_on >= current_date)
  )
);
