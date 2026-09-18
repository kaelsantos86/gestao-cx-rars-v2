import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { CompetencyFinalReviewCard } from '@/components/competency-final-review-card';
import { requireManager } from '@/lib/auth';
import { getCompetencyRecord } from '@/lib/data/records';
import {
  bandForScore,
  bandLabel,
  buildAutomaticOfficialComment,
  competencies,
  competencyMoments,
  competencyRoleProfiles,
  scoreText,
} from '@/lib/competencies';
import { buildCompetencyConversationGuide, buildCompetencyFinalSummary } from '@/lib/workflow-automation';

function normalizeScore(value: FormDataEntryValue | null) {
  return Number(String(value ?? '').replace(',', '.'));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Preparação do gestor',
    awaiting_participant: 'Autoavaliação convidada',
    participant_submitted: 'Autoavaliação recebida',
    in_conversation: 'Em consolidação',
    completed: 'Concluída',
    archived: 'Arquivada',
  };
  return labels[status] ?? status;
}

const bandOrder: Record<string, number> = {
  not_meets: 0,
  partial: 1,
  meets: 2,
  exceeds: 3,
};

function comparisonLabel(managerBand?: string, participantBand?: string) {
  if (!participantBand) return 'Sem autoavaliação';
  if (!managerBand) return 'Sem leitura do gestor';
  const delta = Math.abs((bandOrder[managerBand] ?? 0) - (bandOrder[participantBand] ?? 0));
  if (delta === 0) return 'Convergência';
  if (delta === 1) return 'Diferença a explorar';
  return 'Ponto importante de conversa';
}

async function generateParticipantLink(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await auth.supabase
    .from('participant_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('record_id', recordId)
    .is('revoked_at', null);

  const { error } = await auth.supabase.from('participant_access_tokens').insert({
    record_id: recordId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) throw error;

  const { data: record } = await auth.supabase
    .from('module_records')
    .select('status')
    .eq('id', recordId)
    .eq('module_type', 'competencies')
    .single();

  if (record?.status === 'draft') {
    await auth.supabase
      .from('module_records')
      .update({ status: 'awaiting_participant', updated_at: new Date().toISOString() })
      .eq('id', recordId);
  }

  redirect(`/records/${recordId}/competencies?invite=${encodeURIComponent(rawToken)}`);
}

async function finalizeCompetencies(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submittedResponse, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload, status')
      .eq('id', recordId)
      .eq('module_type', 'competencies')
      .single(),
    auth.supabase
      .from('participant_responses')
      .select('response_payload')
      .eq('record_id', recordId)
      .eq('is_submitted', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (recordError) throw recordError;
  if (responseError) throw responseError;
  if (['completed', 'archived', 'cancelled'].includes(String(record.status))) redirect(`/records/${recordId}/competencies`);

  const skipSelfAssessment = formData.get('skipSelfAssessment') === 'on';
  if (!submittedResponse && !skipSelfAssessment) {
    redirect(`/records/${recordId}/competencies?selfAssessment=decision`);
  }

  if (formData.get('conversationConfirmed') !== 'on') {
    redirect(`/records/${recordId}/competencies?conversation=required`);
  }

  const finalAssessmentsEntries = competencies.map((competency) => {
    const score = normalizeScore(formData.get(`final_${competency.key}_score`));
    const band = bandForScore(score);
    const evidence = String(formData.get(`final_${competency.key}_evidence`) ?? '').trim();
    const nextStep = String(formData.get(`final_${competency.key}_nextStep`) ?? '').trim();
    const suppliedComment = String(formData.get(`final_${competency.key}_officialComment`) ?? '').trim();

    if (!band || !evidence) throw new Error(`invalid_final_assessment_${competency.key}`);

    const officialComment = suppliedComment || buildAutomaticOfficialComment(
      competency.label,
      score,
      evidence,
      nextStep,
    );

    return [competency.key, { band, score, evidence, officialComment, nextStep }] as const;
  });

  const finalAssessments = Object.fromEntries(finalAssessmentsEntries);
  const ranked = competencies
    .map((competency) => ({ competency, assessment: finalAssessments[competency.key] }))
    .sort((a, b) => Number(b.assessment.score) - Number(a.assessment.score));

  const strongest = ranked.slice(0, 2);
  const strengthSummary = strongest
    .map(({ competency, assessment }) => `${competency.label} (${scoreText(assessment.score)}): ${assessment.officialComment}`)
    .join(' ');

  const explicitDevelopment = ranked
    .slice()
    .reverse()
    .find(({ assessment }) => Boolean(assessment.nextStep?.trim()));
  const participantPayload = (submittedResponse?.response_payload ?? {}) as Record<string, any>;
  const participantOverview = (participantPayload.overview ?? {}) as Record<string, string>;
  let developmentPriority = '';
  if (explicitDevelopment) {
    developmentPriority = `${explicitDevelopment.competency.label}: ${explicitDevelopment.assessment.nextStep}`;
  } else {
    const lowest = ranked[ranked.length - 1];
    if (lowest && Number(lowest.assessment.score) < 1) {
      developmentPriority = `${lowest.competency.label}: ${lowest.assessment.officialComment}`;
    } else if (participantOverview.desiredDevelopment?.trim()) {
      developmentPriority = `Perspectiva do colaborador: ${participantOverview.desiredDevelopment.trim()}`;
    }
  }

  const conversationAdjustment = String(formData.get('conversationAdjustment') ?? '').trim();
  const nextCycleAgreement = String(formData.get('nextCycleAgreement') ?? '').trim();
  const managerSupport = String(formData.get('managerSupport') ?? '').trim();
  const returnDate = String(formData.get('returnDate') ?? '').trim();

  const now = new Date().toISOString();
  const existingPayload = (record.payload ?? {}) as Record<string, any>;
  const payloadBase = {
    ...existingPayload,
    finalAssessments,
    strengthSummary,
    recognizedStrengths: strengthSummary,
    developmentPriority,
    conversationAdjustment,
    employeeAgreements: nextCycleAgreement,
    managerSupport,
    pdiConnection: nextCycleAgreement ? 'Avaliar conexão com o PDI conforme a prioridade acordada.' : '',
    returnDate,
    selfAssessmentUsed: Boolean(submittedResponse),
    selfAssessmentSkipped: !submittedResponse,
    consolidationSavedAt: now,
    competencyUxVersion: 3,
  };
  const payload = {
    ...payloadBase,
    competencySummary: buildCompetencyFinalSummary(payloadBase),
  };

  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({
      payload,
      status: 'completed',
      participant_locked_at: now,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', recordId)
    .eq('module_type', 'competencies');
  if (updateError) throw updateError;

  await auth.supabase
    .from('participant_access_tokens')
    .update({ revoked_at: now })
    .eq('record_id', recordId)
    .is('revoked_at', null);

  redirect(`/records/${recordId}/competencies?completed=1`);
}

export default async function CompetencyManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; completed?: string; selfAssessment?: string; conversation?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getCompetencyRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const initialAssessments = (payload.initialAssessments ?? {}) as Record<string, any>;
  const finalAssessments = (payload.finalAssessments ?? initialAssessments) as Record<string, any>;
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, any>;
  const participantCompetencies = (response.competencies ?? {}) as Record<string, { band?: string; evidence?: string }>;
  const participantOverview = (response.overview ?? {}) as Record<string, string>;
  const participantSubmitted = Boolean(record.latestResponse?.is_submitted);
  const participantPath = query.invite ? `/participate/competencies/${query.invite}` : null;
  const completed = ['completed', 'archived'].includes(record.status);
  const roleLabel = competencyRoleProfiles.find((item) => item.value === payload.roleProfile)?.label ?? payload.roleProfile;
  const momentLabel = competencyMoments.find((item) => item.value === payload.momentInRole)?.label ?? payload.momentInRole;
  const conversationGuide = buildCompetencyConversationGuide(payload, response, record.employee.display_name);
  const summaryPreview = buildCompetencyFinalSummary(payload);

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>

      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Competências · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{record.cycle_label} · {roleLabel} · {momentLabel}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Avaliação concluída. O resumo oficial foi gerado automaticamente e o registro já pode alimentar a trajetória e o PDI.</div>}
      {query.selfAssessment === 'decision' && <div className="notice" style={{ marginBottom: 18 }}>A autoavaliação é opcional. Se o ciclo seguirá sem ela, marque essa decisão no fechamento.</div>}
      {query.conversation === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Confirme que a conversa foi realizada antes de concluir a avaliação.</div>}

      <div className="workspaceStack">
        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>1. Contexto do semestre</strong><small>Base registrada pelo gestor.</small></span>
            <span className="badge">Contexto</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody grid grid3">
            <article className="workspaceMiniCard"><strong>Momento e entregas</strong><p className="muted">{String(payload.semesterContext ?? '—')}</p></article>
            <article className="workspaceMiniCard"><strong>Oportunidades reais</strong><p className="muted">{String(payload.demonstrationOpportunities ?? '—')}</p></article>
            <article className="workspaceMiniCard"><strong>Acordos anteriores</strong><p className="muted">{String(payload.priorAgreements ?? '—')}</p></article>
          </div>
        </details>

        <details className="workspaceAccordion" open={participantSubmitted}>
          <summary className="workspaceSummary">
            <span><strong>2. Comparação gestor × colaborador</strong><small>As sete competências lado a lado.</small></span>
            <span className={`badge ${participantSubmitted ? 'badgeAccent' : ''}`}>{participantSubmitted ? 'Autoavaliação recebida' : 'Aguardando'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            {!participantSubmitted && <p className="muted" style={{ marginTop: 0 }}>Quando a autoavaliação chegar, a comparação aparecerá aqui sem substituir sua leitura.</p>}
            <div className="grid" style={{ gap: 10 }}>
              {competencies.map((competency) => {
                const manager = finalAssessments[competency.key] ?? initialAssessments[competency.key] ?? {};
                const managerBand = bandForScore(Number(manager.score)) ?? manager.band;
                const participant = participantCompetencies[competency.key] ?? {};
                return (
                  <details className="competencyAccordion" key={competency.key}>
                    <summary className="competencySummary">
                      <span>
                        <strong>{competency.label}</strong>
                        <small>
                          Gestor: {managerBand ? `${bandLabel(managerBand)} · ${typeof manager.score === 'number' ? scoreText(manager.score) : '—'}` : '—'} · Colaborador: {participantSubmitted ? bandLabel(participant.band) : '—'}
                        </small>
                      </span>
                      <span className="badge">{comparisonLabel(managerBand ?? undefined, participant.band)}</span>
                      <span className="competencyChevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="competencyAccordionBody grid grid2">
                      <div>
                        <strong>Leitura do gestor</strong>
                        <p className="muted">{manager.evidence || '—'}</p>
                      </div>
                      <div>
                        <strong>Autoavaliação do colaborador</strong>
                        <p className="muted">{participantSubmitted ? participant.evidence || 'Sem evidência registrada.' : 'Ainda não enviada.'}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>

            {participantSubmitted && participantOverview.desiredDevelopment && (
              <div className="notice" style={{ marginTop: 14 }}>
                <strong>Desenvolvimento indicado pelo colaborador</strong>
                <p className="muted" style={{ marginBottom: 0 }}>{participantOverview.desiredDevelopment}</p>
              </div>
            )}
          </div>
        </details>

        {!completed && (
          <details className="workspaceAccordion" open={Boolean(participantPath) || !participantSubmitted}>
            <summary className="workspaceSummary">
              <span><strong>3. Autoavaliação</strong><small>Link exclusivo para as sete competências.</small></span>
              <span className={`badge ${participantSubmitted ? 'badgeAccent' : ''}`}>{participantSubmitted ? 'Recebida' : 'Opcional'}</span>
              <span className="competencyChevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="workspaceBody">
              <p className="muted" style={{ marginTop: 0 }}>O colaborador avalia cada competência e registra uma evidência. Ele não vê sua nota antes da conversa.</p>
              <form action={generateParticipantLink}>
                <input type="hidden" name="recordId" value={record.id} />
                <button className="button buttonSecondary" type="submit">{participantSubmitted ? 'Gerar novo link de revisão' : 'Gerar link da autoavaliação'}</button>
              </form>
              {participantPath && (
                <div className="notice" style={{ marginTop: 14 }}>
                  <strong>Link seguro gerado</strong>
                  <p className="muted" style={{ margin: '8px 0' }}>O novo link revoga links anteriores e expira em 14 dias.</p>
                  <CopyLink path={participantPath} />
                </div>
              )}
            </div>
          </details>
        )}

        {!completed && (
          <details className="workspaceAccordion" open={participantSubmitted}>
            <summary className="workspaceSummary">
              <span><strong>4. Orientação da conversa · Gestor</strong><small>Convergências, diferenças e foco para o próximo ciclo.</small></span>
              <span className="badge">Roteiro</span>
              <span className="competencyChevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="workspaceBody">
              <div className="notice" style={{ marginBottom: 14 }}>
                <strong>Objetivo da conversa</strong>
                <p className="muted" style={{ marginBottom: 0 }}>{conversationGuide.objective}</p>
              </div>
              <div className="grid grid2">
                <article className="workspaceMiniCard">
                  <strong>Reconhecer</strong>
                  {conversationGuide.recognition.length ? <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.recognition.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul> : <p className="muted">Use as evidências mais fortes já registradas.</p>}
                </article>
                <article className="workspaceMiniCard">
                  <strong>Perguntas-chave</strong>
                  {conversationGuide.questions.length ? <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.questions.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul> : <p className="muted">Não há divergências relevantes; valide exemplos e escolha o foco de evolução.</p>}
                </article>
                <article className="workspaceMiniCard">
                  <strong>Direcionamento</strong>
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.managerDirections.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul>
                </article>
                <article className="workspaceMiniCard">
                  <strong>Cuidados de condução</strong>
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.watchouts.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul>
                </article>
              </div>
            </div>
          </details>
        )}

        {completed ? (
          <details className="workspaceAccordion" open>
            <summary className="workspaceSummary">
              <span><strong>5. Fechamento</strong><small>Síntese produzida pela avaliação concluída.</small></span>
              <span className="badge badgeAccent">Concluída</span>
              <span className="competencyChevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="workspaceBody">
              <p className="muted">{summaryPreview || 'Avaliação concluída. Consulte o resumo para registro oficial ao final da página.'}</p>
              {payload.strengthSummary && <p className="muted"><strong>Forças:</strong> {payload.strengthSummary}</p>}
              {payload.developmentPriority && <p className="muted"><strong>Prioridade:</strong> {payload.developmentPriority}</p>}
              {payload.employeeAgreements && <p className="muted"><strong>Acordo do próximo ciclo:</strong> {payload.employeeAgreements}</p>}
            </div>
          </details>
        ) : (
          <section className="card">
            <p className="eyebrow">5. Fechamento rápido</p>
            <h2>Revisar, conversar e concluir</h2>
            <p className="muted">As notas e comentários abaixo já vêm preenchidos com sua leitura inicial. Abra somente a competência que precisar ajustar após a conversa. O resumo final será montado automaticamente.</p>

            <form action={finalizeCompetencies} className="grid" style={{ gap: 14 }}>
              <input type="hidden" name="recordId" value={record.id} />

              {!participantSubmitted && (
                <label className="checkboxRow">
                  <input type="checkbox" name="skipSelfAssessment" />
                  <span><strong>Concluir sem autoavaliação</strong><br /><small className="muted">Confirmo que este ciclo seguirá sem a perspectiva formal do colaborador.</small></span>
                </label>
              )}

              <div className="grid" style={{ gap: 10 }}>
                {competencies.map((competency) => {
                  const assessment = finalAssessments[competency.key] ?? initialAssessments[competency.key] ?? {};
                  const participant = participantCompetencies[competency.key] ?? {};
                  return (
                    <CompetencyFinalReviewCard
                      key={competency.key}
                      competencyKey={competency.key}
                      competencyLabel={competency.label}
                      competencyHelp={competency.help}
                      initial={assessment}
                      participantBand={participant.band}
                      participantEvidence={participant.evidence}
                    />
                  );
                })}
              </div>

              <div className="grid grid2">
                <div className="field">
                  <label htmlFor="conversationAdjustment">Ajuste relevante após a conversa <span className="muted">(opcional)</span></label>
                  <textarea id="conversationAdjustment" name="conversationAdjustment" rows={3} defaultValue={payload.conversationAdjustment ?? ''} placeholder="Registre somente algo que tenha mudado sua leitura ou que precise constar no fechamento." />
                </div>
                <div className="field">
                  <label htmlFor="nextCycleAgreement">Acordo principal do próximo ciclo <span className="muted">(opcional)</span></label>
                  <textarea id="nextCycleAgreement" name="nextCycleAgreement" rows={3} defaultValue={payload.employeeAgreements ?? ''} placeholder="Um acordo objetivo é suficiente quando houver." />
                </div>
                <div className="field">
                  <label htmlFor="managerSupport">Apoio do gestor <span className="muted">(opcional)</span></label>
                  <textarea id="managerSupport" name="managerSupport" rows={2} defaultValue={payload.managerSupport ?? ''} placeholder="Somente se houver apoio específico combinado." />
                </div>
                <div className="field">
                  <label htmlFor="returnDate">Data de retorno <span className="muted">(opcional)</span></label>
                  <input id="returnDate" name="returnDate" type="date" defaultValue={payload.returnDate ?? ''} />
                </div>
              </div>

              <label className="checkboxRow">
                <input type="checkbox" name="conversationConfirmed" required />
                <span><strong>Conversa realizada e leitura final confirmada</strong><br /><small className="muted">As notas acima representam minha avaliação final deste ciclo.</small></span>
              </label>

              <div>
                <button className="button" type="submit">Concluir avaliação e gerar resumo</button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
