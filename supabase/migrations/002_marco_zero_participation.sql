-- Gestão CX RARS V2.0 — Marco Zero / participação segura

-- Gestor pode ler as respostas e gerenciar os tokens apenas dos próprios registros.
create policy "manager_reads_participant_responses" on public.participant_responses
for select using (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_responses.record_id
      and mr.manager_id = auth.uid()
  )
);

create policy "manager_reads_participant_tokens" on public.participant_access_tokens
for select using (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = auth.uid()
  )
);

create policy "manager_creates_participant_tokens" on public.participant_access_tokens
for insert with check (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = auth.uid()
  )
);

create policy "manager_revokes_participant_tokens" on public.participant_access_tokens
for update using (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.module_records mr
    where mr.id = participant_access_tokens.record_id
      and mr.manager_id = auth.uid()
  )
);

-- Acesso público só ocorre através destas funções SECURITY DEFINER.
-- O token bruto nunca é persistido; apenas SHA-256 em hexadecimal.
create or replace function public.get_participant_record(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_row public.participant_access_tokens%rowtype;
  record_row public.module_records%rowtype;
  employee_row public.employees%rowtype;
  latest_response jsonb;
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

  select * into record_row from public.module_records where id = token_row.record_id;
  if record_row.id is null or record_row.deleted_at is not null then
    raise exception 'record_not_available';
  end if;

  select * into employee_row from public.employees where id = record_row.employee_id;

  select response_payload into latest_response
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
    'shared_context', jsonb_build_object(
      'purpose', record_row.payload->>'purpose',
      'expectedContribution', record_row.payload->>'expectedContribution',
      'qualityCriteria', record_row.payload->>'qualityCriteria',
      'first30Days', record_row.payload->>'first30Days',
      'autonomy', record_row.payload->>'autonomy',
      'waysOfWorking', record_row.payload->>'waysOfWorking'
    ),
    'latest_response', coalesce(latest_response, '{}'::jsonb)
  );
end;
$$;

create or replace function public.save_participant_response(
  raw_token text,
  response jsonb,
  submit_response boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_row public.participant_access_tokens%rowtype;
  record_row public.module_records%rowtype;
  next_version integer;
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

  select * into record_row from public.module_records where id = token_row.record_id for update;
  if record_row.participant_locked_at is not null or record_row.status in ('completed','archived','cancelled') then
    raise exception 'participant_locked';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.participant_responses
  where record_id = record_row.id;

  insert into public.participant_responses(record_id, version, response_payload, is_submitted, submitted_at)
  values (
    record_row.id,
    next_version,
    response,
    submit_response,
    case when submit_response then now() else null end
  );

  if submit_response then
    update public.module_records
    set status = 'participant_submitted', updated_at = now()
    where id = record_row.id;
  end if;

  return jsonb_build_object(
    'record_id', record_row.id,
    'version', next_version,
    'submitted', submit_response
  );
end;
$$;

grant execute on function public.get_participant_record(text) to anon, authenticated;
grant execute on function public.save_participant_response(text, jsonb, boolean) to anon, authenticated;
