-- Gestão CX RARS V2.0 — estado de bootstrap gerencial

create or replace function public.manager_signup_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles
    where role = 'manager'
  );
$$;

revoke all on function public.manager_signup_available() from public;
grant execute on function public.manager_signup_available() to anon, authenticated;
