import { hasSupabaseEnv } from '@/lib/env';
import { requireManager } from '@/lib/auth';
import {
  demoTeam,
  demoTimeline,
  type CoreJourneyModule,
  type EmployeeSummary,
  type TimelineItem,
} from '@/lib/demo-data';

const momentLabels: Record<EmployeeSummary['professionalMoment'], string> = {
  entry: 'Entrada',
  consolidation: 'Consolidação',
  established: 'Estabilizado',
  transition: 'Transição',
};

const moduleLabels: Record<EmployeeSummary['v2EntryModule'], string> = {
  marco_zero: 'Marco Zero',
  ninety_days: 'Avaliação de 90 dias',
  competencies: 'Competências',
  pdi: 'PDI Evolutivo',
  feedback: 'Feedback',
  talent: 'Talento em Evidência',
};

type OpenJourneyRecord = {
  id: string;
  module: CoreJourneyModule;
  status: string;
};

function isCoreJourneyModule(value: string): value is CoreJourneyModule {
  return ['marco_zero', 'ninety_days', 'competencies', 'pdi'].includes(value);
}

function deriveNextMilestone(
  entryModule: EmployeeSummary['v2EntryModule'],
  completed: Set<string>,
  openRecord: OpenJourneyRecord | null,
) {
  if (openRecord) {
    if (openRecord.module === 'pdi' && ['active', 'in_review'].includes(openRecord.status)) return 'PDI ativo';
    return moduleLabels[openRecord.module];
  }

  if (entryModule === 'marco_zero') {
    if (!completed.has('marco_zero')) return 'Marco Zero';
    if (!completed.has('ninety_days')) return 'Avaliação de 90 dias';
    if (!completed.has('pdi')) return 'PDI Evolutivo';
    return 'Competências';
  }

  if (entryModule === 'ninety_days') {
    if (!completed.has('ninety_days')) return 'Avaliação de 90 dias';
    if (!completed.has('pdi')) return 'PDI Evolutivo';
    return 'Competências';
  }

  if (entryModule === 'competencies') {
    if (!completed.has('competencies')) return 'Competências';
    if (!completed.has('pdi')) return 'PDI Evolutivo';
    return 'Competências';
  }

  if (entryModule === 'pdi') {
    if (!completed.has('pdi')) return 'PDI Evolutivo';
    return 'Competências';
  }

  return moduleLabels[entryModule];
}

function mapEmployee(row: {
  id: string;
  display_name: string;
  role_title: string | null;
  current_squad: string | null;
  professional_moment: EmployeeSummary['professionalMoment'];
  v2_entry_module: EmployeeSummary['v2EntryModule'];
  journey_note: string | null;
}, completed = new Set<string>(), openRecord: OpenJourneyRecord | null = null): EmployeeSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    currentRole: row.role_title ?? 'Função não informada',
    currentSquad: row.current_squad ?? 'Frente não informada',
    stage: momentLabels[row.professional_moment],
    professionalMoment: row.professional_moment,
    v2EntryModule: row.v2_entry_module,
    journeyNote: row.journey_note ?? 'Ponto de entrada ainda não configurado.',
    nextMilestone: deriveNextMilestone(row.v2_entry_module, completed, openRecord),
    ...(openRecord ? {
      openRecordId: openRecord.id,
      openRecordModule: openRecord.module,
      openRecordStatus: openRecord.status,
    } : {}),
  };
}

function buildJourneyState(records: Array<{ id: string; employee_id: string; module_type: string; status: string }>) {
  const completedByEmployee = new Map<string, Set<string>>();
  const openRecordByEmployee = new Map<string, OpenJourneyRecord>();
  const terminalStatuses = new Set(['completed', 'archived', 'cancelled']);

  for (const record of records) {
    if (record.status === 'completed') {
      const modules = completedByEmployee.get(record.employee_id) ?? new Set<string>();
      modules.add(String(record.module_type));
      completedByEmployee.set(record.employee_id, modules);
    }

    if (
      !terminalStatuses.has(record.status)
      && isCoreJourneyModule(record.module_type)
      && !openRecordByEmployee.has(record.employee_id)
    ) {
      openRecordByEmployee.set(record.employee_id, {
        id: record.id,
        module: record.module_type,
        status: record.status,
      });
    }
  }

  return { completedByEmployee, openRecordByEmployee };
}

export async function getTeam(): Promise<EmployeeSummary[]> {
  if (!hasSupabaseEnv()) return demoTeam;

  const auth = await requireManager();
  const supabase = auth!.supabase;
  const { data, error } = await supabase
    .from('employees')
    .select('id, display_name, role_title, current_squad, professional_moment, v2_entry_module, journey_note')
    .eq('active', true)
    .order('display_name');

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: records, error: recordError } = await supabase
    .from('module_records')
    .select('id, employee_id, module_type, status')
    .in('employee_id', rows.map((row) => row.id))
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (recordError) throw recordError;

  const { completedByEmployee, openRecordByEmployee } = buildJourneyState(
    (records ?? []).map((record) => ({
      id: record.id,
      employee_id: record.employee_id,
      module_type: String(record.module_type),
      status: String(record.status),
    })),
  );

  return rows.map((row) => mapEmployee(
    row,
    completedByEmployee.get(row.id) ?? new Set<string>(),
    openRecordByEmployee.get(row.id) ?? null,
  ));
}

export async function getEmployee(id: string): Promise<EmployeeSummary | null> {
  if (!hasSupabaseEnv()) {
    return demoTeam.find((employee) => employee.id === id) ?? null;
  }

  const auth = await requireManager();
  const supabase = auth!.supabase;
  const [{ data, error }, { data: records, error: recordError }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, display_name, role_title, current_squad, professional_moment, v2_entry_module, journey_note')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('module_records')
      .select('id, employee_id, module_type, status')
      .eq('employee_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  if (error) throw error;
  if (recordError) throw recordError;
  if (!data) return null;

  const { completedByEmployee, openRecordByEmployee } = buildJourneyState(
    (records ?? []).map((record) => ({
      id: record.id,
      employee_id: record.employee_id,
      module_type: String(record.module_type),
      status: String(record.status),
    })),
  );

  return mapEmployee(
    data,
    completedByEmployee.get(id) ?? new Set<string>(),
    openRecordByEmployee.get(id) ?? null,
  );
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
