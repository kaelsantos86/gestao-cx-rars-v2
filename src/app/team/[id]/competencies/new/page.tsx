import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { CompetencyAssessmentCard, CompetencySubmitButton } from '@/components/competency-assessment-card';
import {
  bandForScore,
  buildAutomaticOfficialComment,
  competencies,
  competencyContextFields,
  competencyMoments,
  competencyRoleProfiles,
  defaultCompetencyCycleLabel,
} from '@/lib/competencies';

const contextPlaceholders: Record<string, string> = {
  semesterContext: 'Resuma mudanças, projetos, prioridades e resultados que contextualizam a leitura do semestre.',
  demonstrationOpportunities: 'Registre onde houve exposição real para demonstrar comportamentos e onde o contexto limitou a observação.',
  priorAgreements: 'Retome acordos profissionais vigentes que você efetivamente reconhece. Se ainda não houver fonte migrada da V1, não recrie histórico artificialmente.',
};

function normalizeScore(value: FormDataEntryValue | null) {
  return Number(String(value ?? '').replace(',', '.'));
}

async function createCompetencyReview(formData: FormData) {
  'use server';

  const employeeId = String(formData.get('employeeId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: existing } = await auth.supabase
    .from('module_records')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth.user.id)
    .eq('module_type', 'competencies')
    .not('status', 'in', '(completed,archived,cancelled)')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/records/${existing.id}/competencies`);

  const initialAssessments = Object.fromEntries(
    competencies.map((competency) => {
      const score = normalizeScore(formData.get(`assessment_${competency.key}_score`));
      const band = bandForScore(score);
      if (!band) throw new Error(`invalid_score_${competency.key}`);

      const evidence = String(formData.get(`assessment_${competency.key}_evidence`) ?? '').trim();
      const nextStep = String(formData.get(`assessment_${competency.key}_nextStep`) ?? '').trim();
      if (!evidence) throw new Error(`missing_assessment_${competency.key}`);

      const officialComment = buildAutomaticOfficialComment(
        competency.label,
        score,
        evidence,
        nextStep,
      );

      return [competency.key, { band, score, evidence, officialComment, nextStep }];
    }),
  );

  const context = Object.fromEntries(
    competencyContextFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );
  if (!context.semesterContext || !context.demonstrationOpportunities) throw new Error('missing_context');

  const { data: sourceRecords, error: sourceError } = await auth.supabase
    .from('module_records')
    .select('id, module_type')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth.user.id)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .in('module_type', ['marco_zero', 'ninety_days', 'pdi', 'feedback'])
    .order('completed_at', { ascending: false });
  if (sourceError) throw sourceError;

  const payload = {
    roleProfile: String(formData.get('roleProfile') ?? ''),
    momentInRole: String(formData.get('momentInRole') ?? ''),
    ...context,
    initialAssessments,
    sourceRecordIds: (sourceRecords ?? []).map((record) => record.id),
    competencyUxVersion: 2,
  };

  const cycleLabel = String(formData.get('cycleLabel') ?? '').trim();
  if (!cycleLabel || !payload.roleProfile || !payload.momentInRole) throw new Error('missing_competency_context');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .insert({
      employee_id: employeeId,
      manager_id: auth.user.id,
      module_type: 'competencies',
      status: 'draft',
      cycle_label: `Competências · ${cycleLabel}`,
      occurred_on: new Date().toISOString().slice(0, 10),
      payload,
      private_notes: String(formData.get('privateNotes') ?? '').trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;

  if ((sourceRecords ?? []).length > 0) {
    const dependencies = (sourceRecords ?? []).map((source) => ({
      source_record_id: source.id,
      target_record_id: record.id,
      relation_type: 'source_for' as const,
    }));
    const { error: dependencyError } = await auth.supabase.from('record_dependencies').insert(dependencies);
    if (dependencyError) throw dependencyError;
  }

  redirect(`/records/${record.id}/competencies`);
}

export default async function NewCompetencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const mappedMoment = employee.professionalMoment === 'entry'
    ? 'entry'
    : employee.professionalMoment === 'consolidation'
      ? 'consolidation'
      : employee.professionalMoment === 'established'
        ? 'consistent_autonomy'
        : 'consolidation';

  return (
    <main className="page">
      <Link href={`/team/${id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>Competências · Gestor</p>
      <h1 className="pageTitle">Preparar avaliação semestral</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Informe a nota e os fatos observados. A plataforma calcula a faixa e prepara automaticamente o comentário para o +Evolução.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        A nota é a entrada principal. A faixa oficial é consequência automática da nota: 0,00–0,79 Não atende; 0,80–0,99 Atende parcialmente; 1,00–1,10 Atende à expectativa; 1,11–1,20 Supera a expectativa.
      </div>

      <form action={createCompetencyReview} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="employeeId" value={employee.id} />

        <section className="card">
          <p className="eyebrow">1. Contexto e perfil</p>
          <h2>Base da leitura</h2>
          <div className="grid grid2">
            <div className="field">
              <label htmlFor="cycleLabel">Ciclo</label>
              <input id="cycleLabel" name="cycleLabel" defaultValue={defaultCompetencyCycleLabel()} required />
            </div>
            <div className="field">
              <label htmlFor="roleProfile">Perfil do papel</label>
              <select id="roleProfile" name="roleProfile" defaultValue="collaborator_advisor" required>
                {competencyRoleProfiles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="momentInRole">Momento atual na função</label>
              <select id="momentInRole" name="momentInRole" defaultValue={mappedMoment} required>
                {competencyMoments.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid2" style={{ marginTop: 16 }}>
            {competencyContextFields.map(([key, label]) => {
              const optional = key === 'priorAgreements';
              return (
                <div className="field" key={key}>
                  <label htmlFor={key}>{label}{optional && <span className="muted"> (opcional)</span>}</label>
                  <textarea id={key} name={key} rows={4} required={!optional} placeholder={contextPlaceholders[key]} />
                  {optional && <small className="fieldHelp">Use apenas acordos reais do ciclo anterior.</small>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">2. Avaliar</p>
          <h2>Sete competências oficiais</h2>
          <p className="muted">Abra uma competência por vez. Você informa somente nota, comentário/evidência e, se necessário, um próximo foco. Faixa e comentário para a ferramenta oficial são produzidos automaticamente.</p>
          <div className="grid" style={{ gap: 12 }}>
            {competencies.map((competency) => (
              <CompetencyAssessmentCard key={competency.key} competency={competency} />
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Notas privadas</p>
          <div className="field">
            <label htmlFor="privateNotes">Observações do gestor <span className="muted">(opcional)</span></label>
            <textarea id="privateNotes" name="privateNotes" rows={3} placeholder="Somente hipóteses ou pontos de observação que não constituam acordo formal." />
          </div>
        </section>

        <div><CompetencySubmitButton /></div>
      </form>
    </main>
  );
}
