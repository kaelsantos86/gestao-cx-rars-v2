-- Gestão CX RARS V2.0 — revoga links públicos quando um registro é concluído.
-- O bloqueio do colaborador já impede novas edições; esta regra também invalida
-- explicitamente qualquer token ainda ativo, reduzindo superfície de acesso.

create or replace function public.revoke_participant_tokens_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.participant_access_tokens
      set revoked_at = coalesce(revoked_at, now())
    where record_id = new.id
      and revoked_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_revoke_participant_tokens_on_completion on public.module_records;

create trigger trg_revoke_participant_tokens_on_completion
after update of status on public.module_records
for each row
execute function public.revoke_participant_tokens_on_completion();
