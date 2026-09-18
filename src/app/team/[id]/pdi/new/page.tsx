import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { buildPdiSourceContext } from '@/lib/workflow-automation';
import {
  defaultPdiCycleLabel,
  pdiContextFields,
  pdiCycleTypes,
} from '@/lib/pdi';
import {
  PdiCycleTypeField,
  PdiDirectionSection,
  PdiPrioritiesSection,
  PdiPrivateNotesSection,
} from '@/components/pdi-creation-sections';

function readPriority(formData: FormData, index: number) {
  const fields = {
    axis: String(formData.get(`priority_${index}_axis`) ?? '').trim(),
    title: String(formData.get(`priority_${index}_title`) ?? '').trim(),
    currentState: String(formData.get(`priority_${index}_currentState`) ?? '').trim(),
    desiredState: String(formData.get(`priority_${index}_desiredState`) ?? '').trim(),
    practice: String(formData.get(`priority_${index}_practice`) ?? '').trim(),
    evidence: String(formData.get(`priority_${index}_evidence`) ?? '').trim(),
    support: String(formData.get(`priority_${index}_support`) ?? '').trim(),
    autonomy: String(formData.get(`priority_${index}_autonomy`) ?? '').trim(),
    relatedCompetency: String(formData.get(`priority_${index}_relatedCompetency`) ?? '').trim(),
  };

  const touched = Object.values(fields).some(Boolean);
  if (!touched) return null;

  const required = [fields.axis, fields.title, fields.currentState, fields.desiredState, fields.practice, fields.evidence, fields.support, fields.autonomy];
  if (required.some((value) => !value)) throw new Error(`incomplete_priority_${index}`);
  return { id: `priority_${index}`, ...fields };
}

async function createPdi(formData: FormData) {
  'use server';

  const employeeId = String(formData.get('employeeId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: existing, error: existingError } = await auth.supabase
    .from('module_records')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth.user.id)
    .eq('module_type', 'pdi')
    .not('status', 'in', '(completed,archived,cancelled)')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) redirect(`/records/${existing.id}/pdi`);

  const { data: sourceCandidates, error: sourceError } = await auth.supabase
    .from('module_records')
    .select('id, module_type, status, cycle_label, completed_at, created_at, payload')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth.user.id)
    .is('deleted_at', null)
    .in('module_type', ['ninety_days', 'competencies', 'pdi'])
    .order('created_at', { ascending: false });
  if (sourceError) throw sourceError;

  const sources = (sourceCandidates ?? []).filter((source) => {
    if (source.module_type === 'ninety_days' || source.module_type === 'competencies') return source.status === 'completed';
    return source.module_type === 'pdi' && ['completed', 'archived'].includes(String(source.status));
  });

  const cycleType = String(formData.get('cycleType') ?? '');
  const needsNinetyDays = cycleType === 'first_pdi' || cycleType === 'role_consolidation';
  const hasCompletedNinetyDays = sources.some((source) => source.module_type === 'ninety_days' && source.status === 'completed');
  const ninetyDaysConfirmed = formData.get('ninetyDaysConfirmed') === 'on';
  if (needsNinetyDays && !hasCompletedNinetyDays && !ninetyDaysConfirmed) {
    redirect(`/team/${employeeId}/pdi/new?prerequisite=required`);
  }

  const context = Object.fromEntries(
    pdiContextFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );
  const requiredContext = ['contextAndRole', 'currentMoment', 'strengthsToPreserve', 'aspiration', 'developmentDirection'];
  if (requiredContext.some((key) => !context[key])) throw new Error('missing_pdi_context');

  const extraordinaryReason = String(formData.get('extraordinaryReason') ?? '').trim();
  if (cycleType === 'extraordinary_review' && !extraordinaryReason) throw new Error('missing_extraordinary_reason');

  const priorities = [1, 2, 3]
    .map((index) => readPriority(formData, index))
    .filter(Boolean);
  if (priorities.length < 1 || priorities.length > 3) throw new Error('invalid_priority_count');

  const cycleLabel = String(formData.get('cycleLabel') ?? '').trim();
  if (!cycleLabel || !pdiCycleTypes.some((item) => item.value === cycleType)) throw new Error('invalid_pdi_cycle');

  const previousPdi = sources.find((source) => source.module_type === 'pdi') ?? null;
  const sourceContext = buildPdiSourceContext(sources);
  const payload = {
    cycleType,
    cycleLabel,
    extraordinaryReason,
    ninetyDaysConfirmedWithoutV2Record: needsNinetyDays && !hasCompletedNinetyDays && ninetyDaysConfirmed,
    ...context,
    priorities,
    managerCommitment: sourceContext.managerSupport,
    sourceRecordIds: sources.map((source) => source.id),
    previousPdiId: previousPdi?.id ?? null,
  };

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .insert({
      employee_id: employeeId,
      manager_id: auth.user.id,
      module_type: 'pdi',
      status: 'draft',
      cycle_label: `PDI · ${cycleLabel}`,
      occurred_on: new Date().toISOString().slice(0, 10),
      payload,
      private_notes: String(formData.get('privateNotes') ?? '').trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (sources.length > 0) {
    const { error: dependencyError } = await auth.supabase.from('record_dependencies').insert(
      sources.map((source) => ({
        source_record_id: source.id,
        target_record_id: record.id,
        relation_type: 'source_for' as const,
      })),
    );
    if (dependencyError) throw dependencyError;
  }

  if (previousPdi?.status === 'completed') {
    const now = new Date().toISOString();
    const { error: archiveError } = await auth.supabase
      .from('module_records')
      .update({ status: 'archived', archived_at: now, updated_at: now })
      .eq('id', previousPdi.id)
      .eq('module_type', 'pdi');
    if (archiveError) throw archiveError;
  }

  redirect(`/records/${record.id}/pdi`);
}

export default async function NewPdiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prerequisite?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const auth = await requireManager();
  if (!auth) redirect('/login');
  const { data: sources, error } = await auth.supabase
    .from('module_records')
    .select('id, module_type, status, cycle_label, completed_at, created_at, payload')
    .eq('employee_id', id)
    .eq('manager_id', auth.user.id)
    .is('deleted_at', null)
    .in('module_type', ['ninety_days', 'competencies', 'pdi'])
    .order('created_at', { ascending: false });
  if (error) throw error;

  const eligibleSources = (sources ?? []).filter((source) => {
    if (source.module_type === 'ninety_days' || source.module_type === 'competencies') return source.status === 'completed';
    return source.module_type === 'pdi' && ['completed', 'archived'].includes(String(source.status));
  });
  const sourceContext = buildPdiSourceContext(eligibleSources);

  const suggestedType = employee.professionalMoment === 'consolidation'
    ? 'role_consolidation'
    : employee.professionalMoment === 'established'
      ? 'semiannual_evolution'
      : employee.professionalMoment === 'transition'
        ? 'extraordinary_review'
        : 'first_pdi';

  return (
    <main className="page">
      <Link href={`/team/${id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>PDI Evolutivo · Gestor</p>
      <h1 className="pageTitle">Construir ciclo de desenvolvimento</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Poucas prioridades, prática real, evidência natural e autonomia.</p>

      {query.prerequisite === 'required' && (
        <div className="notice" style={{ marginBottom: 18 }}>
          Primeiro PDI e PDI de consolidação exigem a devolutiva de 90 dias concluída ou a confirmação explícita de que ela já ocorreu.
        </div>
      )}

      <form action={createPdi} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="employeeId" value={employee.id} />

        <section className="card">
          <p className="eyebrow">1. Ciclo e fontes</p>
          <h2>De onde este PDI parte</h2>
          <div className="grid grid2">
            <div className="field">
              <label htmlFor="cycleLabel">Ciclo</label>
              <input id="cycleLabel" name="cycleLabel" defaultValue={defaultPdiCycleLabel()} required />
            </div>
            <PdiCycleTypeField suggestedType={suggestedType} />
          </div>

          <div className="grid" style={{ gap: 10, marginTop: 16 }}>
            {sourceContext.sources.length > 0 ? sourceContext.sources.map((source) => (
              <div className="workspaceMiniCard" key={source.id}>
                <strong>{source.label}</strong>
                <p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{source.summary || 'Fonte concluída disponível na trajetória.'}</p>
              </div>
            )) : (
              <div className="notice">Ainda não há fonte concluída na V2 para este PDI. Use somente contexto profissional real e, quando aplicável, confirme a devolutiva de 90 dias já realizada fora da V2.</div>
            )}
          </div>

          <label className="checkboxRow" style={{ marginTop: 14 }}>
            <input type="checkbox" name="ninetyDaysConfirmed" />
            <span>Confirmo que a devolutiva de 90 dias já ocorreu quando este tipo de PDI exigir esse pré-requisito, mesmo que o registro ainda não esteja migrado para a V2.</span>
          </label>
        </section>

        <PdiDirectionSection defaultValues={{
          strengthsToPreserve: sourceContext.strengthsToPreserve,
          developmentDirection: sourceContext.developmentDirection,
          sourceReadings: sourceContext.sourceReadings,
        }} />
        <PdiPrioritiesSection />
        <PdiPrivateNotesSection />

        <div><button className="button" type="submit">Criar PDI Evolutivo</button></div>
      </form>
    </main>
  );
}
