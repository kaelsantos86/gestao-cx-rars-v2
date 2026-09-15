import { requireManager } from '@/lib/auth';
import { isTalentSourceEligible, type TalentSourceRow } from '@/lib/talent';

export async function getEligibleTalentSources(employeeId: string): Promise<TalentSourceRow[]> {
  const auth = await requireManager();
  const supabase = auth!.supabase;

  const { data, error } = await supabase
    .from('module_records')
    .select('id, module_type, status, cycle_label, occurred_on, completed_at, created_at, payload')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth!.user.id)
    .is('deleted_at', null)
    .in('module_type', ['marco_zero', 'ninety_days', 'competencies', 'pdi', 'feedback'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      module_type: String(row.module_type),
      status: String(row.status),
      cycle_label: row.cycle_label,
      occurred_on: row.occurred_on,
      completed_at: row.completed_at,
      created_at: row.created_at,
      payload: (row.payload ?? {}) as Record<string, any>,
    }))
    .filter(isTalentSourceEligible);
}

export async function getTalentSourcesByIds(employeeId: string, ids: string[]): Promise<TalentSourceRow[]> {
  if (ids.length === 0) return [];
  const eligible = await getEligibleTalentSources(employeeId);
  const wanted = new Set(ids);
  return eligible.filter((row) => wanted.has(row.id));
}
