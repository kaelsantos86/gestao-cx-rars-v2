import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import {
  defaultPdiCycleLabel,
  pdiAxes,
  pdiContextFields,
  pdiCycleTypes,
  relatedCompetencies,
} from '@/lib/pdi';

const contextPlaceholders: Record<string, string> = {
  contextAndRole: 'Resuma escopo, prioridades e condições que afetam o desenvolvimento neste ciclo.',
  currentMoment: 'Descreva maturidade, desafios e transição sem transformar o momento em nota.',
  strengthsToPreserve: 'Escolha repertórios que sustentam o próximo passo e que devem ser preservados.',
  aspiration: 'Registre o movimento profissional desejado pela pessoa, sem presumir promoção.',
  developmentDirection: 'Conecte capacidade, contexto e impacto em uma frase de direção.',
  notPriorityNow: 'Proteja foco: registre oportunidades que não precisam virar prioridade neste ciclo.',
  sourceReadings: 'Sintetize os sinais reais vindos de 90 dias, Competências ou PDI anterior. Não altere a autoria das fontes.',
};

function sourceLabel(moduleType: string, cycleLabel: string | null) {
  const labels: Record<string, string> = {
    ninety_days: 'Avaliação de 90 dias',
    competencies: 'Competências',
    pdi: 'PDI anterior',
  };
  return cycleLabel || labels[moduleType] || moduleType;
}

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
    .select('id, module_type, status, cycle_label, completed_at, payload')
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
  const payload = {
    cycleType,
    cycleLabel,
    extraordinaryReason,
    ninetyDaysConfirmedWithoutV2Record: needsNinetyDays && !hasCompletedNinetyDays && ninetyDaysConfirmed,
    ...context,
    priorities,
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
    .select('id, module_type, status, cycle_label, completed_at')
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
            <div className="field">
              <label htmlFor="cycleType">Tipo de PDI</label>
              <select id="cycleType" name="cycleType" defaultValue={suggestedType} required>
                {pdiCycleTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid" style={{ gap: 10, marginTop: 16 }}>
            {eligibleSources.length > 0 ? eligibleSources.slice(0, 6).map((source) => (
              <div className="workspaceMiniCard" key={source.id}>
                <strong>{sourceLabel(String(source.module_type), source.cycle_label)}</strong>
                <span className="muted">Fonte real disponível na trajetória.</span>
              </div>
            )) : (
              <div className="notice">Ainda não há fonte concluída na V2 para este PDI. Use somente contexto profissional real e, quando aplicável, confirme a devolutiva de 90 dias já realizada fora da V2.</div>
            )}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="extraordinaryReason">Motivo extraordinário <span className="muted">(somente se aplicável)</span></label>
            <textarea id="extraordinaryReason" name="extraordinaryReason" rows={3} placeholder="Preencha apenas se o tipo escolhido for Revisão extraordinária." />
          </div>

          <label className="checkboxRow" style={{ marginTop: 14 }}>
            <input type="checkbox" name="ninetyDaysConfirmed" />
            <span>Confirmo que a devolutiva de 90 dias já ocorreu quando este tipo de PDI exigir esse pré-requisito, mesmo que o registro ainda não esteja migrado para a V2.</span>
          </label>
        </section>

        <section className="card">
          <p className="eyebrow">2. Direção do ciclo</p>
          <h2>Contexto antes das prioridades</h2>
          <div className="grid grid2">
            {pdiContextFields.map(([key, label]) => {
              const required = ['contextAndRole', 'currentMoment', 'strengthsToPreserve', 'aspiration', 'developmentDirection'].includes(key);
              return (
                <div className="field" key={key}>
                  <label htmlFor={key}>{label}{!required && <span className="muted"> (opcional)</span>}</label>
                  <textarea id={key} name={key} rows={4} required={required} placeholder={contextPlaceholders[key]} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">3. Prioridades</p>
          <h2>Até 3 movimentos de desenvolvimento</h2>
          <p className="muted">A prioridade 1 é obrigatória. Abra as prioridades 2 e 3 somente se elas realmente aumentarem foco, e não o transformarem em checklist.</p>

          <div className="grid" style={{ gap: 12 }}>
            {[1, 2, 3].map((index) => (
              <details className="competencyAccordion" key={index} open={index === 1}>
                <summary className="competencySummary">
                  <span><strong>Prioridade {index}</strong><small>{index === 1 ? 'Obrigatória' : 'Opcional'}</small></span>
                  <span className="competencyChevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="competencyAccordionBody grid grid2">
                  <div className="field">
                    <label htmlFor={`priority_${index}_axis`}>Eixo</label>
                    <select id={`priority_${index}_axis`} name={`priority_${index}_axis`} defaultValue="">
                      <option value="">Selecione</option>
                      {pdiAxes.map((axis) => <option key={axis.value} value={axis.value}>{axis.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`priority_${index}_relatedCompetency`}>Competência relacionada <span className="muted">(opcional)</span></label>
                    <select id={`priority_${index}_relatedCompetency`} name={`priority_${index}_relatedCompetency`} defaultValue="">
                      <option value="">Sem vínculo obrigatório</option>
                      {relatedCompetencies.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor={`priority_${index}_title`}>Título: capacidade + impacto</label>
                    <input id={`priority_${index}_title`} name={`priority_${index}_title`} placeholder="Ex.: Conduzir pactuações multiarea com clareza e influência." />
                  </div>
                  <div className="field"><label>Estado atual</label><textarea name={`priority_${index}_currentState`} rows={4} placeholder="Padrão atual com fatos, sem desqualificar a pessoa." /></div>
                  <div className="field"><label>Estado desejado</label><textarea name={`priority_${index}_desiredState`} rows={4} placeholder="Comportamento ou resultado que indicará evolução." /></div>
                  <div className="field"><label>Prática ou experiência</label><textarea name={`priority_${index}_practice`} rows={4} placeholder="Situação real de trabalho em que a capacidade será praticada." /></div>
                  <div className="field"><label>Evidência natural</label><textarea name={`priority_${index}_evidence`} rows={4} placeholder="Produto ou efeito verificável do trabalho, sem microgestão." /></div>
                  <div className="field"><label>Apoio do gestor/organização</label><textarea name={`priority_${index}_support`} rows={4} placeholder="Contexto, exposição, conexão, recurso ou debrief necessário." /></div>
                  <div className="field"><label>Autonomia</label><textarea name={`priority_${index}_autonomy`} rows={4} placeholder="O que a pessoa pode decidir e quais situações pedem alinhamento." /></div>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Notas privadas</p>
          <div className="field">
            <label htmlFor="privateNotes">Observações do gestor</label>
            <textarea id="privateNotes" name="privateNotes" rows={3} placeholder="Hipóteses de acompanhamento que não compõem o plano compartilhado. Não esconda aqui decisões que afetem a pessoa." />
          </div>
        </section>

        <div><button className="button" type="submit">Criar PDI Evolutivo</button></div>
      </form>
    </main>
  );
}
