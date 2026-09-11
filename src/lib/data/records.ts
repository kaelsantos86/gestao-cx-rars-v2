import { hasSupabaseEnv } from '@/lib/env';
import { requireManager } from '@/lib/auth';

export async function getMarcoZeroRecord(id: string) {
  if (!hasSupabaseEnv()) return null;

  const auth = await requireManager();
  const supabase = auth!.supabase;

  const { data: record, error: recordError } = await supabase
    .from('module_records')
    .select('id, employee_id, manager_id, status, cycle_label, occurred_on, payload, participant_locked_at, completed_at, created_at')
    .eq('id', id)
    .eq('module_type', 'marco_zero')
    .maybeSingle();

  if (recordError) throw recordError;
  if (!record) return null;

  const [{ data: employee, error: employeeError }, { data: responses, error: responseError }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, display_name, role_title, current_squad')
      .eq('id', record.employee_id)
      .maybeSingle(),
    supabase
      .from('participant_responses')
      .select('version, response_payload, is_submitted, submitted_at, created_at')
      .eq('record_id', record.id)
      .order('version', { ascending: false })
      .limit(1),
  ]);

  if (employeeError) throw employeeError;
  if (responseError) throw responseError;

  return {
    ...record,
    employee,
    latestResponse: responses?.[0] ?? null,
  };
}

export async function getParticipantMarcoZero(token: string) {
  if (!hasSupabaseEnv()) return null;

  const auth = await import('@/lib/supabase/server');
  const supabase = await auth.createClient();
  const { data, error } = await supabase.rpc('get_participant_record', { raw_token: token });

  if (error) return null;
  return data as {
    record_id: string;
    module_type: string;
    status: string;
    locked: boolean;
    employee_name: string;
    shared_context: Record<string, string | null>;
    latest_response: Record<string, string>;
  };
}
