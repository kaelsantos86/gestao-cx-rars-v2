import { hasSupabaseEnv } from '@/lib/env';
import { requireManager } from '@/lib/auth';

type SupportedManagerModule = 'marco_zero' | 'ninety_days' | 'competencies' | 'pdi' | 'feedback';

async function getManagerRecord(id: string, moduleType: SupportedManagerModule) {
  if (!hasSupabaseEnv()) return null;

  const auth = await requireManager();
  const supabase = auth!.supabase;

  const { data: record, error: recordError } = await supabase
    .from('module_records')
    .select('id, employee_id, manager_id, status, cycle_label, occurred_on, payload, private_notes, participant_locked_at, completed_at, archived_at, created_at')
    .eq('id', id)
    .eq('module_type', moduleType)
    .maybeSingle();

  if (recordError) throw recordError;
  if (!record) return null;

  const [
    { data: employee, error: employeeError },
    { data: responses, error: responseError },
    { data: dependencies, error: dependencyError },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, display_name, role_title, current_squad, professional_moment, v2_entry_module')
      .eq('id', record.employee_id)
      .maybeSingle(),
    supabase
      .from('participant_responses')
      .select('version, response_payload, is_submitted, submitted_at, created_at')
      .eq('record_id', record.id)
      .order('version', { ascending: false })
      .limit(1),
    supabase
      .from('record_dependencies')
      .select('source_record_id, relation_type')
      .eq('target_record_id', record.id),
  ]);

  if (employeeError) throw employeeError;
  if (responseError) throw responseError;
  if (dependencyError) throw dependencyError;

  return {
    ...record,
    employee,
    latestResponse: responses?.[0] ?? null,
    dependencies: dependencies ?? [],
  };
}

export async function getMarcoZeroRecord(id: string) {
  return getManagerRecord(id, 'marco_zero');
}

export async function getNinetyDayRecord(id: string) {
  return getManagerRecord(id, 'ninety_days');
}

export async function getCompetencyRecord(id: string) {
  return getManagerRecord(id, 'competencies');
}

export async function getPdiRecord(id: string) {
  return getManagerRecord(id, 'pdi');
}

export async function getFeedbackRecord(id: string) {
  return getManagerRecord(id, 'feedback');
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

export async function getParticipantNinetyDay(token: string) {
  if (!hasSupabaseEnv()) return null;

  const auth = await import('@/lib/supabase/server');
  const supabase = await auth.createClient();
  const { data, error } = await supabase.rpc('get_ninety_day_participant_record', { raw_token: token });

  if (error) return null;
  return data as {
    record_id: string;
    module_type: string;
    status: string;
    locked: boolean;
    employee_name: string;
    cycle_label: string | null;
    latest_response: Record<string, unknown>;
    latest_submitted: boolean;
  };
}

export async function getParticipantCompetencies(token: string) {
  if (!hasSupabaseEnv()) return null;

  const auth = await import('@/lib/supabase/server');
  const supabase = await auth.createClient();
  const { data, error } = await supabase.rpc('get_competency_participant_record', { raw_token: token });

  if (error) return null;
  return data as {
    record_id: string;
    module_type: string;
    status: string;
    locked: boolean;
    employee_name: string;
    cycle_label: string | null;
    shared_context: Record<string, string | null>;
    latest_response: Record<string, unknown>;
    latest_submitted: boolean;
  };
}

export async function getParticipantPdi(token: string) {
  if (!hasSupabaseEnv()) return null;

  const auth = await import('@/lib/supabase/server');
  const supabase = await auth.createClient();
  const { data, error } = await supabase.rpc('get_pdi_participant_record', { raw_token: token });

  if (error) return null;
  return data as {
    record_id: string;
    module_type: string;
    status: string;
    locked: boolean;
    employee_name: string;
    cycle_label: string | null;
    shared_context: Record<string, unknown>;
    latest_response: Record<string, unknown>;
    latest_submitted: boolean;
  };
}

export async function getParticipantFeedback(token: string) {
  if (!hasSupabaseEnv()) return null;

  const auth = await import('@/lib/supabase/server');
  const supabase = await auth.createClient();
  const { data, error } = await supabase.rpc('get_feedback_participant_record', { raw_token: token });

  if (error) return null;
  return data as {
    record_id: string;
    module_type: string;
    status: string;
    locked: boolean;
    employee_name: string;
    cycle_label: string | null;
    shared_context: Record<string, string | null>;
    latest_response: Record<string, unknown>;
    latest_submitted: boolean;
  };
}
