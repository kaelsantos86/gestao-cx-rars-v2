-- Gestão CX RARS V2.0 — bootstrap de perfil a partir do Supabase Auth

create or replace function public.handle_new_manager_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Gestor'
    ),
    'manager'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_manager_user() from public, anon, authenticated;
grant execute on function public.handle_new_manager_user() to supabase_auth_admin;

drop trigger if exists on_auth_manager_created on auth.users;
create trigger on_auth_manager_created
after insert on auth.users
for each row execute procedure public.handle_new_manager_user();
