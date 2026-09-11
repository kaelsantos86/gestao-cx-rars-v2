-- Gestão CX RARS V2.0 — participação opcional em Competências

create or replace function public.get_competency_participant_record(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token_row public.participant_access_tokens%rowtype;
  record_row public.module_records%rowtype;
  employee_row public.employees%rowtype;
  latest_response jsonb;
  latest_submitted boolean := false;
begin
  select * into token_row
  from public.participant_access_tokens
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if token_row.id is null then
    raise exception 'invalid_or_expired_token';
  end if;

  select * into record_row
  from public.module_records
  where id = token_row.record_id
    and module_type = 'competencies';

  if record_row.id is null or record_row.deleted_at is not null then
    raise exception 'record_not_available';
  end if;

  select * into employee_row from public.employees where id = record_row.employee_id;

  select response_payload, is_submitted into latest_response, latest_submitted
  from public.participant_responses
  where record_id = record_row.id
  order by version desc
  limit 1;

  return jsonb_build_object(
    'record_id', record_row.id,
    'module_type', record_row.module_type,
    'status', record_row.status,
    'locked', record_row.participant_locked_at is not null,
    'employee_name', employee_row.display_name,
    'cycle_label', record_row.cycle_label,
    'shared_context', jsonb_build_object(
      'roleProfile', record_row.payload->>'roleProfile',
      'momentInRole', record_row.payload->>'momentInRole',
      'semesterContext', record_row.payload->>'semesterContext'
    ),
    'latest_response', coalesce(latest_response, '{}'::jsonb),
    'latest_submitted', coalesce(latest_submitted, false)
  );
end;
$$;

grant execute on function public.get_competency_participant_record(text) to anon, authenticated;
