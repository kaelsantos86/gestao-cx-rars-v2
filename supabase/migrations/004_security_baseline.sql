-- Gestão CX RARS V2.0 — baseline de segurança após auditoria Supabase

-- Tokens de participação estão no schema público e precisam de RLS ativo.
alter table public.participant_access_tokens enable row level security;

-- O gestor pode consultar apenas os próprios vínculos ativos/históricos.
-- Esta política também permite que a policy de employees valide a associação.
create policy "manager_reads_own_assignments" on public.manager_assignments
for select using (manager_id = auth.uid());

-- Índice para acelerar validações de vínculo usadas nas policies.
create index if not exists manager_assignments_manager_employee_idx
on public.manager_assignments(manager_id, employee_id, starts_on, ends_on);
