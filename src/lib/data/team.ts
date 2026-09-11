import { hasSupabaseEnv } from '@/lib/env';
import { requireManager } from '@/lib/auth';
import { demoTeam, demoTimeline, type EmployeeSummary, type TimelineItem } from '@/lib/demo-data';

function mapEmployee(row: {
  id: string;
  display_name: string;
  current_role: string | null;
  current_squad: string | null;
}): EmployeeSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    currentRole: row.current_role ?? 'Função não informada',
    currentSquad: row.current_squad ?? 'Frente não informada',
    stage: 'Em acompanhamento',
    nextMilestone: 'Ver timeline',
  };
}

export async function getTeam(): Promise<EmployeeSummary[]> {
  if (!hasSupabaseEnv()) return demoTeam;

  const auth = await requireManager();
  const supabase = auth!.supabase;
  const { data, error } = await supabase
    .from('employees')
    .select('id, display_name, current_role, current_squad')
    .eq('active', true)
    .order('display_name');

  if (error) throw error;
  return (data ?? []).map(mapEmployee);
}

export async function getEmployee(id: string): Promise<EmployeeSummary | null> {
  if (!hasSupabaseEnv()) {
    return demoTeam.find((employee) => employee.id === id) ?? null;
  }

  const auth = await requireManager();
  const supabase = auth!.supabase;
  const { data, error } = await supabase
    .from('employees')
    .select('id, display_name, current_role, current_squad')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEmployee(data) : null;
}

export async function getEmployeeTimeline(id: string): Promise<TimelineItem[]> {
  if (!hasSupabaseEnv()) return demoTimeline[id] ?? [];

  const auth = await requireManager();
  const supabase = auth!.supabase;
  const { data, error } = await supabase
    .from('module_records')
    .select('id, module_type, status, cycle_label, occurred_on, created_at')
    .eq('employee_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((record) => ({
    id: record.id,
    module: String(record.module_type),
    title: record.cycle_label || moduleLabel(String(record.module_type)),
    status: String(record.status),
    date: record.occurred_on || String(record.created_at).slice(0, 10),
    description: 'Registro da trajetória profissional na Gestão CX RARS.',
  }));
}

function moduleLabel(module: string) {
  const labels: Record<string, string> = {
    marco_zero: 'Marco Zero',
    ninety_days: 'Avaliação de 90 dias',
    competencies: 'Competências',
    pdi: 'PDI Evolutivo',
    feedback: 'Feedback',
    talent: 'Talento em Evidência',
  };
  return labels[module] ?? module;
}
