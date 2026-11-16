import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { buildPdiSourceContext } from '@/lib/workflow-automation';
import {
  defaultPdiCycleLabel,
  pdiCycleTypes,
} from '@/lib/pdi';
import {
  PdiCycleTypeField,
} from '@/components/pdi-creation-sections';

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

  const extraordinaryReason = String(formData.get('extraordinaryReason') ?? '').trim();
  if (cycleType === 'extraordinary_review' && !extraordinaryReason) throw new Error('missing_extraordinary_reason');

  const cycleLabel = String(formData.get('cycleLabel') ?? '').trim();
  if (!cycleLabel || !pdiCycleTypes.some((item) => item.value === cycleType)) throw new Error('invalid_pdi_cycle');

  const previousPdi = sources.find((source) => source.module_type === 'pdi') ?? null;
  const sourceContext = buildPdiSourceContext(sources);
  const payload = {
    cycleType,
    cycleLabel,
    extraordinaryReason,
    ninetyDaysConfirmedWithoutV2Record: needsNinetyDays && !hasCompletedNinetyDays && ninetyDaysConfirmed,
    workflowVersion: "collaborator_first",
    priorities: [],
    sourceReadings: sourceContext.sourceReadings,
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
      <h1 className="pageTitle">Iniciar escuta para o PDI</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Primeiro, convide o colaborador a refletir sobre suas necessidades, expectativas e carreira. Depois, prepare sua leitura e construam o plano juntos.</p>

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
              <label htmlFor="cycleLabel">Ano do PDI · ciclo anual</label>
              <input id="cycleLabel" name="cycleLabel" defaultValue={defaultPdiCycleLabel()} required />
              <small className="fieldHelp">Planeje o ano indicado com base na trajetória e nos aprendizados do ano anterior. Ex.: PDI 2027 com contexto de 2026.</small>
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

        <div className="notice">Ao abrir o ciclo, você poderá gerar o link de reflexão. Contexto, objetivos, cursos e compromissos serão definidos após o envio do colaborador.</div>

        <div><button className="button" type="submit">Abrir ciclo e preparar convite</button></div>
      </form>
    </main>
  );
}
