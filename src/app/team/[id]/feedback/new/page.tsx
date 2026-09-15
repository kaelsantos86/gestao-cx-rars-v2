import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { FeedbackNewEnhancer } from '@/components/feedback-new-enhancer';
import {
  feedbackCycleLabel,
  feedbackFlows,
  orientationPreparationFields,
  promotionFields,
  recognitionModes,
  recognitionPreparationFields,
} from '@/lib/feedback';

function readFields(formData: FormData, fields: readonly (readonly [string, string])[]) {
  return Object.fromEntries(fields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]));
}

async function createFeedback(formData: FormData) {
  'use server';
  const employeeId = String(formData.get('employeeId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const feedbackFlow = String(formData.get('feedbackFlow') ?? '');
  const occurredOn = String(formData.get('occurredOn') ?? '').trim();
  if (!feedbackFlows.some((item) => item.value === feedbackFlow) || !occurredOn) {
    throw new Error('invalid_feedback_header');
  }

  const payload: Record<string, unknown> = {
    feedbackFlow,
    occurredOn,
    participantPerspectiveUsed: false,
    participantPerspectiveSkipped: false,
    talentEligible: false,
    recognitionEvidenceReady: false,
  };

  if (feedbackFlow === 'orientation') {
    const values = readFields(formData, orientationPreparationFields);
    const required = ['situationReason', 'shareableContext', 'observedFacts', 'behavioralImpact', 'expectedDirection'];
    if (required.some((key) => !values[key])) throw new Error('missing_orientation_feedback_fields');
    Object.assign(payload, values, { recognitionMode: null, promotionApproved: false });
  } else {
    const values = readFields(formData, recognitionPreparationFields);
    const required = ['concreteContribution', 'generatedImpact', 'recognizedStrengths', 'competenciesValues'];
    if (required.some((key) => !values[key])) throw new Error('missing_recognition_feedback_fields');

    const recognitionMode = String(formData.get('recognitionMode') ?? 'recognition');
    if (!recognitionModes.some((item) => item.value === recognitionMode)) throw new Error('invalid_recognition_mode');
    Object.assign(payload, values, { recognitionMode });

    if (recognitionMode === 'promotion') {
      const promotion = readFields(formData, promotionFields);
      const promotionApproved = formData.get('promotionApproved') === 'on';
      if (Object.values(promotion).some((value) => !value) || !promotionApproved) {
        throw new Error('promotion_requires_formal_approval');
      }
      Object.assign(payload, promotion, { promotionApproved: true });
    } else {
      Object.assign(payload, {
        roleTransition: '',
        newResponsibilities: '',
        effectiveDate: '',
        promotionApproved: false,
      });
    }
  }

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .insert({
      employee_id: employeeId,
      manager_id: auth.user.id,
      module_type: 'feedback',
      status: 'draft',
      cycle_label: feedbackCycleLabel(feedbackFlow, occurredOn),
      occurred_on: occurredOn,
      payload,
      private_notes: String(formData.get('privateNotes') ?? '').trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;

  redirect(`/records/${record.id}/feedback`);
}

export default async function NewFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="page">
      <Link href={`/team/${id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>Feedback pontual · Gestor</p>
      <h1 className="pageTitle">Preparar conversa relevante</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Registre apenas situações que realmente mereçam preparação e memória.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        Feedback cotidiano não precisa virar registro. Use este módulo quando uma situação específica exigir clareza, escuta, acordo ou reconhecimento formal.
      </div>

      <form action={createFeedback} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="employeeId" value={employee.id} />
        <FeedbackNewEnhancer />

        <section className="card">
          <p className="eyebrow">1. Tipo e data</p>
          <h2 style={{ marginTop: 0 }}>Qual conversa precisa ser registrada?</h2>
          <div className="grid grid2">
            <div className="field">
              <label htmlFor="feedbackFlow">Tipo de feedback</label>
              <select id="feedbackFlow" name="feedbackFlow" defaultValue="orientation">
                {feedbackFlows.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
              <small className="muted">Orientação/correção não alimenta Talento. Reconhecimento/promoção pode alimentar quando concluído com evidência.</small>
            </div>
            <div className="field">
              <label htmlFor="occurredOn">Data de referência</label>
              <input id="occurredOn" name="occurredOn" type="date" defaultValue={today} required />
            </div>
          </div>
        </section>

        <section className="card" data-feedback-flow="orientation">
          <p className="eyebrow">2. Preparação</p>
          <h2 style={{ marginTop: 0 }}>Orientação / correção de rota</h2>
          <p className="muted">Estruture situação → comportamento/fatos → impacto → direção. Contexto anterior é opcional e não deve virar dossiê.</p>
          <div className="grid grid2">
            {orientationPreparationFields.map(([key, label]) => (
              <div className="field" key={key} style={key === 'shareableContext' ? { gridColumn: '1 / -1' } : undefined}>
                <label htmlFor={key}>{label}{key === 'previousContext' && <span className="muted"> (opcional)</span>}</label>
                <textarea id={key} name={key} rows={4} placeholder={key === 'shareableContext' ? 'Escreva somente o que pode ser mostrado à pessoa antes da conversa.' : 'Use fatos profissionais, contexto e efeito observável.'} />
              </div>
            ))}
          </div>
        </section>

        <section className="card" data-feedback-flow="recognition">
          <p className="eyebrow">2. Preparação</p>
          <h2 style={{ marginTop: 0 }}>Promoção e/ou reconhecimento</h2>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="recognitionMode">Natureza do registro</label>
            <select id="recognitionMode" name="recognitionMode" defaultValue="recognition">
              {recognitionModes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="grid grid2">
            {recognitionPreparationFields.map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <textarea id={key} name={key} rows={4} placeholder="Conecte contribuição, fatos, capacidade e impacto verificável." />
              </div>
            ))}
          </div>

          <div data-recognition-mode="promotion" style={{ marginTop: 18 }}>
            <div className="notice" style={{ marginBottom: 16 }}>Promoção só pode ser registrada como confirmada após aprovação formal da governança competente.</div>
            <div className="grid grid2">
              {promotionFields.map(([key, label]) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>{label}</label>
                  {key === 'effectiveDate' ? (
                    <input id={key} name={key} type="date" />
                  ) : (
                    <textarea id={key} name={key} rows={4} placeholder="Descreva mudança real de escopo e responsabilidade." />
                  )}
                </div>
              ))}
            </div>
            <label className="checkboxRow" style={{ marginTop: 14 }}>
              <input type="checkbox" name="promotionApproved" />
              <span><strong>Promoção formalmente aprovada</strong><br /><small className="muted">Marque somente após confirmação oficial. Sem isso, o registro não pode ser criado como promoção.</small></span>
            </label>
          </div>
        </section>

        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>Notas privadas do gestor</strong><small>Hipóteses de condução que não aparecem para o colaborador.</small></span>
            <span className="badge">Opcional</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            <div className="field">
              <label htmlFor="privateNotes">Observações privadas</label>
              <textarea id="privateNotes" name="privateNotes" rows={4} placeholder="Use para cuidados de condução. Não esconda aqui acordos ou decisões que afetem a pessoa." />
            </div>
          </div>
        </details>

        <div><button className="button" type="submit">Criar Feedback</button></div>
      </form>
    </main>
  );
}
