create or replace function public.keep_project_active()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select current_timestamp;
$$;

revoke all on function public.keep_project_active() from public;
grant execute on function public.keep_project_active() to anon, authenticated;

comment on function public.keep_project_active() is
  'Harmless scheduled probe used by Vercel Cron to keep the Free Plan project active without reading or changing business records.';
