-- Gestão CX RARS V2.0 — bootstrap seguro do primeiro gestor
-- Enquanto a V2 for uma aplicação gerencial individual, somente a primeira conta
-- pode ser criada. Essa conta recebe vínculo com todos os colaboradores ativos já cadastrados.

create or replace function public.handle_new_manager_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager_name text;
begin
  -- Impede criação de uma segunda conta gerencial pelo formulário público.
  if exists (select 1 from public.profiles) then
    raise exception 'manager_signup_closed';
  end if;

  manager_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Gestor'
  );

  insert into public.profiles (id, display_name, role)
  values (new.id, manager_name, 'manager');

  insert into public.manager_assignments (manager_id, employee_id, starts_on)
  select new.id, e.id, current_date
  from public.employees e
  where e.active = true
  on conflict (manager_id, employee_id, starts_on) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_manager_user() from public, anon, authenticated;
grant execute on function public.handle_new_manager_user() to supabase_auth_admin;
