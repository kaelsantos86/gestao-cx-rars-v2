import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getPdiRecord } from '@/lib/data/records';
import {
  pdiAgreementFields,
  pdiAxes,
  pdiAxisLabel,
  pdiCycleTypeLabel,
  pdiReviewStatuses,
  relatedCompetencies,
} from '@/lib/pdi';

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Em construção',
    awaiting_participant: 'Perspectiva convidada',
    participant_submitted: 'Perspectiva recebida',
    in_conversation: 'Acordos registrados',
    active: 'PDI ativo',
    in_review: 'Em revisão',
    completed: 'Ciclo encerrado',
    archived: 'Arquivado',
  };
  return labels[status] ?? status;
}

function readPriority(formData: FormData, index: number) {
  const priority = {
    id: String(formData.get(`priority_${index}_id`) ?? `priority_${index}`),
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
  const required = [priority.axis, priority.title, priority.currentState, priority.desiredState, priority.practice, priority.evidence, priority.support, priority.autonomy];
  if (required.some((value) => !value)) throw new Error(`incomplete_priority_${index}`);
  return priority;
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
    .eq('module_type', 'pdi')
    .single();

  if (record?.status === 'draft') {
    await auth.supabase
      .from('module_records')
      .update({ status: 'awaiting_participant', updated_at: new Date().toISOString() })
      .eq('id', recordId);
  }

  redirect(`/records/${recordId}/pdi?invite=${encodeURIComponent(rawToken)}`);
}

async function savePdiAgreements(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload, status')
      .eq('id', recordId)
      .eq('module_type', 'pdi')
      .single(),
    auth.supabase
      .from('participant_responses')
      .select('id')
      .eq('record_id', recordId)
      .eq('is_submitted', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (recordError) throw recordError;
  if (responseError) throw responseError;
  if (['active', 'in_review', 'completed', 'archived'].includes(String(record.status))) redirect(`/records/${recordId}/pdi`);

  const skipPerspective = formData.get('skipPerspective') === 'on';
  if (!submitted && !skipPerspective) redirect(`/records/${recordId}/pdi?perspective=decision`);

  const existingPayload = (record.payload ?? {}) as Record<string, any>;
  const existingPriorities = Array.isArray(existingPayload.priorities) ? existingPayload.priorities : [];
  const priorities = existingPriorities.map((_: unknown, index: number) => readPriority(formData, index + 1));
  if (priorities.length < 1 || priorities.length > 3) throw new Error('invalid_priority_count');

  const agreements = Object.fromEntries(
    pdiAgreementFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );
  const formalReviewDate = String(formData.get('formalReviewDate') ?? '').trim();
  if (Object.values(agreements).some((value) => !value) || !formalReviewDate) {
    redirect(`/records/${recordId}/pdi?agreement=required`);
  }

  const payload = {
    ...existingPayload,
    priorities,
    ...agreements,
    formalReviewDate,
    participantPerspectiveUsed: Boolean(submitted),
    participantPerspectiveSkipped: !submitted,
    agreementSavedAt: new Date().toISOString(),
  };

  const { error } = await auth.supabase
    .from('module_records')
    .update({ payload, status: 'in_conversation', updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'pdi');
  if (error) throw error;

  redirect(`/records/${recordId}/pdi?agreement=saved`);
}

async function activatePdi(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload, status')
    .eq('id', recordId)
    .eq('module_type', 'pdi')
    .single();
  if (error) throw error;
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  if (!payload.agreementSavedAt || record.status !== 'in_conversation') redirect(`/records/${recordId}/pdi?agreement=required`);

  const now = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({ status: 'active', participant_locked_at: now, updated_at: now })
    .eq('id', recordId)
    .eq('module_type', 'pdi');
  if (updateError) throw updateError;

  await auth.supabase
    .from('participant_access_tokens')
    .update({ revoked_at: now })
    .eq('record_id', recordId)
    .is('revoked_at', null);

  redirect(`/records/${recordId}/pdi?activated=1`);
}

async function savePdiReview(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload, status')
    .eq('id', recordId)
    .eq('module_type', 'pdi')
    .single();
  if (error) throw error;
  if (!['active', 'in_review'].includes(String(record.status))) redirect(`/records/${recordId}/pdi`);

  const payload = (record.payload ?? {}) as Record<string, any>;
  const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
  const objectiveReviews = priorities.map((priority: any, index: number) => {
    const status = String(formData.get(`review_${index + 1}_status`) ?? '').trim();
    const evidence = String(formData.get(`review_${index + 1}_evidence`) ?? '').trim();
    if (!pdiReviewStatuses.some((item) => item.value === status) || !evidence) throw new Error(`invalid_review_${index + 1}`);
    return { priorityId: priority.id, status, evidence };
  });

  const cycleSummary = String(formData.get('cycleSummary') ?? '').trim();
  const learningToPreserve = String(formData.get('learningToPreserve') ?? '').trim();
  const nextDirection = String(formData.get('nextDirection') ?? '').trim();
  if (!cycleSummary || !learningToPreserve || !nextDirection) redirect(`/records/${recordId}/pdi?review=required`);

  const nextPayload = {
    ...payload,
    review: {
      objectiveReviews,
      cycleSummary,
      learningToPreserve,
      nextDirection,
      reviewedAt: new Date().toISOString(),
    },
    reviewSavedAt: new Date().toISOString(),
  };

  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({ payload: nextPayload, status: 'in_review', updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'pdi');
  if (updateError) throw updateError;

  redirect(`/records/${recordId}/pdi?review=saved`);
}

async function closePdiCycle(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload, status')
    .eq('id', recordId)
    .eq('module_type', 'pdi')
    .single();
  if (error) throw error;
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  if (record.status !== 'in_review' || !payload.reviewSavedAt) redirect(`/records/${recordId}/pdi?review=required`);

  const now = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({ status: 'completed', completed_at: now, participant_locked_at: now, updated_at: now })
    .eq('id', recordId)
    .eq('module_type', 'pdi');
  if (updateError) throw updateError;

  redirect(`/records/${recordId}/pdi?completed=1`);
}

export default async function PdiManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; agreement?: string; perspective?: string; activated?: string; review?: string; completed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getPdiRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, any>;
  const participantOverview = (response.overview ?? {}) as Record<string, string>;
  const participantAxes = Array.isArray(response.axes) ? response.axes as string[] : [];
  const participantSubmitted = Boolean(record.latestResponse?.is_submitted);
  const participantPath = query.invite ? `/participate/pdi/${query.invite}` : null;
  const readOnly = ['completed', 'archived'].includes(record.status);
  const canBuild = ['draft', 'awaiting_participant', 'participant_submitted', 'in_conversation'].includes(record.status);
  const canReview = ['active', 'in_review'].includes(record.status);
  const review = (payload.review ?? {}) as Record<string, any>;
  const objectiveReviews = Array.isArray(review.objectiveReviews) ? review.objectiveReviews : [];

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>

      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">PDI Evolutivo · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{record.cycle_label} · {pdiCycleTypeLabel(String(payload.cycleType ?? ''))}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.agreement === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Acordos e prioridades finais salvos. Revise e ative o PDI quando a conversa estiver concluída.</div>}
      {query.agreement === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Complete prioridades, acordos e data de revisão antes de ativar o PDI.</div>}
      {query.perspective === 'decision' && <div className="notice" style={{ marginBottom: 18 }}>Use a perspectiva do colaborador ou confirme explicitamente que o plano foi construído em conversa sem o formulário.</div>}
      {query.activated && <div className="notice" style={{ marginBottom: 18 }}>PDI ativo. O plano agora é fonte válida para a trajetória e pode ser revisado na data combinada.</div>}
      {query.review === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Revisão formal registrada. O ciclo pode ser encerrado após a conferência.</div>}
      {query.review === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Registre evidências de revisão, síntese, aprendizado e próxima direção antes de encerrar.</div>}
      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Ciclo encerrado. Ao criar o próximo PDI, este plano será preservado como histórico arquivado.</div>}

      <div className="workspaceStack">
        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>1. Contexto e fontes</strong><small>Direção profissional e sinais que sustentam o ciclo.</small></span>
            <span className="badge">{record.dependencies.length} fontes</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody grid grid2">
            <article className="workspaceMiniCard"><strong>Contexto da função</strong><p className="muted">{payload.contextAndRole || '—'}</p></article>
            <article className="workspaceMiniCard"><strong>Momento profissional</strong><p className="muted">{payload.currentMoment || '—'}</p></article>
            <article className="workspaceMiniCard"><strong>Fortalezas a preservar</strong><p className="muted">{payload.strengthsToPreserve || '—'}</p></article>
            <article className="workspaceMiniCard"><strong>Aspiração</strong><p className="muted">{payload.aspiration || '—'}</p></article>
            <article className="workspaceMiniCard"><strong>Direção de desenvolvimento</strong><p className="muted">{payload.developmentDirection || '—'}</p></article>
            <article className="workspaceMiniCard"><strong>Não priorizar agora</strong><p className="muted">{payload.notPriorityNow || '—'}</p></article>
            <article className="workspaceMiniCard" style={{ gridColumn: '1 / -1' }}><strong>Leitura das fontes</strong><p className="muted">{payload.sourceReadings || '—'}</p></article>
          </div>
        </details>

        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>2. Prioridades do ciclo</strong><small>Prática, evidência, apoio e autonomia.</small></span>
            <span className="badge">{priorities.length} prioridade{priorities.length === 1 ? '' : 's'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody grid" style={{ gap: 10 }}>
            {priorities.map((priority: any, index: number) => (
              <details className="competencyAccordion" key={priority.id ?? index}>
                <summary className="competencySummary">
                  <span><strong>{priority.title}</strong><small>{pdiAxisLabel(priority.axis)}{priority.relatedCompetency ? ` · ${priority.relatedCompetency}` : ''}</small></span>
                  <span className="competencyChevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="competencyAccordionBody grid grid2">
                  <div><strong>Estado atual</strong><p className="muted">{priority.currentState}</p></div>
                  <div><strong>Estado desejado</strong><p className="muted">{priority.desiredState}</p></div>
                  <div><strong>Prática real</strong><p className="muted">{priority.practice}</p></div>
                  <div><strong>Evidência</strong><p className="muted">{priority.evidence}</p></div>
                  <div><strong>Apoio</strong><p className="muted">{priority.support}</p></div>
                  <div><strong>Autonomia</strong><p className="muted">{priority.autonomy}</p></div>
                </div>
              </details>
            ))}
          </div>
        </details>

        <details className="workspaceAccordion" open={Boolean(participantPath)}>
          <summary className="workspaceSummary">
            <span><strong>3. Perspectiva do colaborador</strong><small>Momento, aspiração, prática, autonomia e apoio.</small></span>
            <span className={`badge ${participantSubmitted ? 'badgeAccent' : ''}`}>{participantSubmitted ? 'Recebida' : 'Compartilhada'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            {participantSubmitted ? (
              <div className="grid grid2">
                {Object.entries(participantOverview).map(([key, value]) => (
                  <div key={key}><strong>{key}</strong><div className="muted">{value || '—'}</div></div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}><strong>Eixos de maior interesse</strong><div className="muted">{participantAxes.map(pdiAxisLabel).join(' · ') || '—'}</div></div>
              </div>
            ) : canBuild ? (
              <>
                <p className="muted">A perspectiva ajuda a construir o plano com a pessoa. Se a conversa ocorrer sem formulário, isso precisa ser confirmado no bloco de acordos.</p>
                {participantPath && (
                  <div className="notice" style={{ marginBottom: 14 }}>
                    <strong>Link pronto</strong>
                    <div style={{ marginTop: 8 }}><CopyLink path={participantPath} /></div>
                  </div>
                )}
                <form action={generateParticipantLink}>
                  <input type="hidden" name="recordId" value={record.id} />
                  <button className="button" type="submit">{participantPath ? 'Gerar novo link' : 'Gerar link seguro'}</button>
                </form>
              </>
            ) : (
              <p className="muted">O PDI já está ativo ou encerrado. Novas edições da perspectiva estão bloqueadas.</p>
            )}
          </div>
        </details>

        <details className="workspaceAccordion" open={Boolean(query.agreement || query.perspective || record.status === 'in_conversation')}>
          <summary className="workspaceSummary">
            <span><strong>4. Acordos e ativação</strong><small>Prioridades finais, compromissos, autonomia e revisão formal.</small></span>
            <span className={`badge ${payload.agreementSavedAt ? 'badgeAccent' : ''}`}>{payload.agreementSavedAt ? 'Acordos salvos' : 'Pendente'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            {canBuild && !readOnly ? (
              <form action={savePdiAgreements} className="grid" style={{ gap: 14 }}>
                <input type="hidden" name="recordId" value={record.id} />

                {!participantSubmitted && (
                  <label className="checkboxRow">
                    <input type="checkbox" name="skipPerspective" defaultChecked={Boolean(payload.participantPerspectiveSkipped)} />
                    <span>Confirmo que este PDI foi construído em conversa com a pessoa e seguiremos sem o formulário de perspectiva neste ciclo.</span>
                  </label>
                )}

                {priorities.map((priority: any, index: number) => (
                  <details className="competencyAccordion" key={priority.id ?? index}>
                    <summary className="competencySummary">
                      <span><strong>Prioridade {index + 1}</strong><small>{priority.title}</small></span>
                      <span className="competencyChevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="competencyAccordionBody grid grid2">
                      <input type="hidden" name={`priority_${index + 1}_id`} value={priority.id ?? `priority_${index + 1}`} />
                      <div className="field"><label>Eixo</label><select name={`priority_${index + 1}_axis`} defaultValue={priority.axis} required>{pdiAxes.map((axis) => <option key={axis.value} value={axis.value}>{axis.label}</option>)}</select></div>
                      <div className="field"><label>Competência relacionada</label><select name={`priority_${index + 1}_relatedCompetency`} defaultValue={priority.relatedCompetency || ''}><option value="">Sem vínculo obrigatório</option>{relatedCompetencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Título</label><input name={`priority_${index + 1}_title`} defaultValue={priority.title} required /></div>
                      <div className="field"><label>Estado atual</label><textarea name={`priority_${index + 1}_currentState`} rows={4} defaultValue={priority.currentState} required /></div>
                      <div className="field"><label>Estado desejado</label><textarea name={`priority_${index + 1}_desiredState`} rows={4} defaultValue={priority.desiredState} required /></div>
                      <div className="field"><label>Prática ou experiência</label><textarea name={`priority_${index + 1}_practice`} rows={4} defaultValue={priority.practice} required /></div>
                      <div className="field"><label>Evidência natural</label><textarea name={`priority_${index + 1}_evidence`} rows={4} defaultValue={priority.evidence} required /></div>
                      <div className="field"><label>Apoio</label><textarea name={`priority_${index + 1}_support`} rows={4} defaultValue={priority.support} required /></div>
                      <div className="field"><label>Autonomia</label><textarea name={`priority_${index + 1}_autonomy`} rows={4} defaultValue={priority.autonomy} required /></div>
                    </div>
                  </details>
                ))}

                <div className="grid grid2">
                  {pdiAgreementFields.map(([key, label]) => (
                    <div className="field" key={key}>
                      <label htmlFor={key}>{label}</label>
                      <textarea id={key} name={key} rows={4} defaultValue={payload[key] || ''} required />
                    </div>
                  ))}
                  <div className="field">
                    <label htmlFor="formalReviewDate">Data de revisão formal</label>
                    <input id="formalReviewDate" name="formalReviewDate" type="date" defaultValue={payload.formalReviewDate || ''} required />
                    <small className="fieldHelp">Principalmente semestral, salvo mudança relevante.</small>
                  </div>
                </div>
                <div><button className="button buttonSecondary" type="submit">Salvar acordos do PDI</button></div>
              </form>
            ) : (
              <div className="grid grid2">
                {pdiAgreementFields.map(([key, label]) => <div key={key}><strong>{label}</strong><p className="muted">{payload[key] || '—'}</p></div>)}
                <div><strong>Revisão formal</strong><p className="muted">{payload.formalReviewDate || '—'}</p></div>
              </div>
            )}
          </div>
        </details>

        {(canReview || record.status === 'completed') && (
          <details className="workspaceAccordion" open={Boolean(query.review || record.status === 'in_review')}>
            <summary className="workspaceSummary">
              <span><strong>5. Revisão do ciclo</strong><small>Evidências, aprendizados e direção seguinte.</small></span>
              <span className={`badge ${payload.reviewSavedAt ? 'badgeAccent' : ''}`}>{payload.reviewSavedAt ? 'Revisão registrada' : 'Quando chegar a data'}</span>
              <span className="competencyChevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="workspaceBody">
              {canReview ? (
                <form action={savePdiReview} className="grid" style={{ gap: 14 }}>
                  <input type="hidden" name="recordId" value={record.id} />
                  {priorities.map((priority: any, index: number) => {
                    const saved = objectiveReviews.find((item: any) => item.priorityId === priority.id) ?? {};
                    return (
                      <details className="competencyAccordion" key={priority.id ?? index}>
                        <summary className="competencySummary">
                          <span><strong>{priority.title}</strong><small>Revisar com fatos</small></span>
                          <span className="competencyChevron" aria-hidden="true">⌄</span>
                        </summary>
                        <div className="competencyAccordionBody grid grid2">
                          <div className="field"><label>Status</label><select name={`review_${index + 1}_status`} defaultValue={saved.status || ''} required><option value="">Selecione</option>{pdiReviewStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                          <div className="field"><label>Evidência da revisão</label><textarea name={`review_${index + 1}_evidence`} rows={4} defaultValue={saved.evidence || ''} required /></div>
                        </div>
                      </details>
                    );
                  })}
                  <div className="grid grid2">
                    <div className="field"><label>Síntese do ciclo</label><textarea name="cycleSummary" rows={4} defaultValue={review.cycleSummary || ''} required /></div>
                    <div className="field"><label>Aprendizado a preservar</label><textarea name="learningToPreserve" rows={4} defaultValue={review.learningToPreserve || ''} required /></div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}><label>Direção seguinte</label><textarea name="nextDirection" rows={4} defaultValue={review.nextDirection || ''} required /></div>
                  </div>
                  <div><button className="button buttonSecondary" type="submit">Salvar revisão formal</button></div>
                </form>
              ) : (
                <div className="grid grid2">
                  <div><strong>Síntese do ciclo</strong><p className="muted">{review.cycleSummary || '—'}</p></div>
                  <div><strong>Aprendizado a preservar</strong><p className="muted">{review.learningToPreserve || '—'}</p></div>
                  <div><strong>Direção seguinte</strong><p className="muted">{review.nextDirection || '—'}</p></div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Estado do ciclo</p>
        {record.status === 'in_conversation' && payload.agreementSavedAt ? (
          <form action={activatePdi}>
            <input type="hidden" name="recordId" value={record.id} />
            <h2>Ativar PDI</h2>
            <p className="muted">A ativação transforma o plano em ciclo vigente, bloqueia novas edições pelo link do colaborador e torna o PDI uma fonte válida para a trajetória.</p>
            <button className="button" type="submit">Ativar PDI Evolutivo</button>
          </form>
        ) : record.status === 'active' ? (
          <><h2>PDI ativo</h2><p className="muted">Acompanhe no trabalho real e use a rotina de 1:1 para remover bloqueios. A revisão formal fica para a data combinada.</p><span className="badge badgeAccent">Ativo</span></>
        ) : record.status === 'in_review' && payload.reviewSavedAt ? (
          <form action={closePdiCycle}>
            <input type="hidden" name="recordId" value={record.id} />
            <h2>Encerrar este ciclo</h2>
            <p className="muted">O encerramento preserva evidências e aprendizados. Ao criar o próximo PDI, este ciclo será arquivado e ligado ao novo plano.</p>
            <button className="button" type="submit">Encerrar ciclo do PDI</button>
          </form>
        ) : record.status === 'completed' || record.status === 'archived' ? (
          <><h2>{record.status === 'archived' ? 'PDI arquivado' : 'Ciclo encerrado'}</h2><p className="muted">Registro preservado como histórico e somente leitura.</p></>
        ) : (
          <><h2>Em construção</h2><p className="muted">Registre a perspectiva e os acordos antes de ativar o PDI.</p><span className="badge">Aguardando acordos</span></>
        )}
      </section>
    </main>
  );
}
