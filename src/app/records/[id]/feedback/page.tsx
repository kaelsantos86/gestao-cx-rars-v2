import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getFeedbackRecord } from '@/lib/data/records';
import {
  feedbackClosingFields,
  feedbackFlowLabel,
  feedbackParticipantFields,
  orientationPreparationFields,
  promotionFields,
  recognitionModeLabel,
  recognitionPreparationFields,
} from '@/lib/feedback';

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Preparação do gestor',
    awaiting_participant: 'Escuta convidada',
    participant_submitted: 'Perspectiva recebida',
    in_conversation: 'Conversa registrada',
    completed: 'Concluído',
    archived: 'Arquivado',
    cancelled: 'Cancelado',
  };
  return labels[status] ?? status;
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
    .eq('module_type', 'feedback')
    .single();

  if (record?.status === 'draft') {
    await auth.supabase
      .from('module_records')
      .update({ status: 'awaiting_participant', updated_at: new Date().toISOString() })
      .eq('id', recordId);
  }

  redirect(`/records/${recordId}/feedback?invite=${encodeURIComponent(rawToken)}`);
}

async function saveFeedbackClosing(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload, status')
      .eq('id', recordId)
      .eq('module_type', 'feedback')
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
  if (['completed', 'archived', 'cancelled'].includes(String(record.status))) redirect(`/records/${recordId}/feedback`);

  const skipPerspective = formData.get('skipPerspective') === 'on';
  if (!submitted && !skipPerspective) redirect(`/records/${recordId}/feedback?perspective=decision`);

  const existingPayload = (record.payload ?? {}) as Record<string, any>;
  const closing = Object.fromEntries(
    feedbackClosingFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );

  if (!closing.essentialRecord || !closing.futureDirection) {
    redirect(`/records/${recordId}/feedback?closing=required`);
  }

  const recognitionEvidenceReady = existingPayload.feedbackFlow === 'recognition'
    && Boolean(existingPayload.concreteContribution)
    && Boolean(existingPayload.generatedImpact)
    && Boolean(existingPayload.recognizedStrengths)
    && Boolean(existingPayload.competenciesValues);

  const payload = {
    ...existingPayload,
    ...closing,
    participantPerspectiveUsed: Boolean(submitted),
    participantPerspectiveSkipped: !submitted,
    recognitionEvidenceReady,
    closingSavedAt: new Date().toISOString(),
  };

  const { error } = await auth.supabase
    .from('module_records')
    .update({ payload, status: 'in_conversation', updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'feedback');
  if (error) throw error;

  redirect(`/records/${recordId}/feedback?closing=saved`);
}

async function completeFeedback(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload, status')
    .eq('id', recordId)
    .eq('module_type', 'feedback')
    .single();
  if (error) throw error;

  const payload = (record.payload ?? {}) as Record<string, any>;
  if (record.status !== 'in_conversation' || !payload.closingSavedAt) {
    redirect(`/records/${recordId}/feedback?closing=required`);
  }

  if (payload.feedbackFlow === 'recognition' && payload.recognitionMode === 'promotion' && !payload.promotionApproved) {
    redirect(`/records/${recordId}/feedback?promotion=approval`);
  }

  const talentEligible = payload.feedbackFlow === 'recognition' && Boolean(payload.recognitionEvidenceReady);
  const now = new Date().toISOString();
  const nextPayload = {
    ...payload,
    talentEligible,
    completedWithEvidence: talentEligible,
  };

  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({
      payload: nextPayload,
      status: 'completed',
      completed_at: now,
      participant_locked_at: now,
      updated_at: now,
    })
    .eq('id', recordId)
    .eq('module_type', 'feedback');
  if (updateError) throw updateError;

  await auth.supabase
    .from('participant_access_tokens')
    .update({ revoked_at: now })
    .eq('record_id', recordId)
    .is('revoked_at', null);

  redirect(`/records/${recordId}/feedback?completed=1`);
}

export default async function FeedbackManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; perspective?: string; closing?: string; promotion?: string; completed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getFeedbackRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, string>;
  const participantSubmitted = Boolean(record.latestResponse?.is_submitted);
  const participantPath = query.invite ? `/participate/feedback/${query.invite}` : null;
  const readOnly = ['completed', 'archived', 'cancelled'].includes(record.status);
  const flow = String(payload.feedbackFlow ?? 'orientation');
  const recognitionMode = String(payload.recognitionMode ?? 'recognition');
  const preparationFields = flow === 'orientation' ? orientationPreparationFields : recognitionPreparationFields;

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>

      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Feedback pontual · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{feedbackFlowLabel(flow)}{flow === 'recognition' ? ` · ${recognitionModeLabel(recognitionMode)}` : ''}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.closing === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Conversa e registro essencial salvos. Revise e conclua quando o conteúdo estiver confirmado.</div>}
      {query.closing === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Registre ao menos o resumo essencial e a direção futura antes de concluir.</div>}
      {query.perspective === 'decision' && <div className="notice" style={{ marginBottom: 18 }}>Use a escuta do colaborador ou confirme explicitamente que seguirá sem o formulário opcional.</div>}
      {query.promotion === 'approval' && <div className="notice" style={{ marginBottom: 18 }}>Promoção não pode ser concluída sem aprovação formal registrada.</div>}
      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Feedback concluído. O registro está bloqueado para novas edições do colaborador.</div>}

      <div className="workspaceStack">
        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>1. Preparação do gestor</strong><small>Fatos, intenção e contexto específico da conversa.</small></span>
            <span className="badge">{flow === 'orientation' ? 'Orientação' : recognitionModeLabel(recognitionMode)}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody grid grid2">
            {preparationFields.map(([key, label]) => (
              <article className="workspaceMiniCard" key={key}>
                <strong>{label}</strong>
                <p className="muted">{payload[key] || '—'}</p>
              </article>
            ))}
            {flow === 'recognition' && recognitionMode === 'promotion' && promotionFields.map(([key, label]) => (
              <article className="workspaceMiniCard" key={key}>
                <strong>{label}</strong>
                <p className="muted">{payload[key] || '—'}</p>
              </article>
            ))}
            {flow === 'recognition' && recognitionMode === 'promotion' && (
              <article className="workspaceMiniCard">
                <strong>Promoção aprovada</strong>
                <p className="muted">{payload.promotionApproved ? 'Sim · aprovação formal confirmada' : 'Não'}</p>
              </article>
            )}
          </div>
        </details>

        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>2. Escuta opcional</strong><small>Perspectiva separada do colaborador antes da conversa.</small></span>
            <span className="badge">{participantSubmitted ? 'Recebida' : 'Opcional'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            {participantSubmitted ? (
              <div className="grid grid2">
                {feedbackParticipantFields.map(([key, label]) => {
                  const value = response[key];
                  if (!value && key === 'additionalNotes') return null;
                  return (
                    <article className="workspaceMiniCard" key={key}>
                      <strong>{label}</strong>
                      <p className="muted">{value || '—'}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="notice" style={{ marginBottom: 16 }}>Nenhuma perspectiva enviada. O link é opcional; o feedback pode seguir sem formulário se a escuta ocorrer diretamente na conversa.</div>
            )}

            {!readOnly && (
              <form action={generateParticipantLink}>
                <input type="hidden" name="recordId" value={record.id} />
                <button className="button buttonSecondary" type="submit">Gerar novo link</button>
              </form>
            )}

            {participantPath && (
              <div className="notice" style={{ marginTop: 14 }}>
                <strong>Link seguro gerado</strong>
                <p className="muted" style={{ margin: '8px 0' }}>O novo link revoga links anteriores e expira em 14 dias.</p>
                <CopyLink path={participantPath} />
              </div>
            )}
          </div>
        </details>

        <details className="workspaceAccordion" open={record.status === 'participant_submitted' || record.status === 'in_conversation'}>
          <summary className="workspaceSummary">
            <span><strong>3. Conversa e registro</strong><small>Escuta, compromissos proporcionais e síntese essencial.</small></span>
            <span className="badge">{payload.closingSavedAt ? 'Salvo' : 'Pendente'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            <form action={saveFeedbackClosing} className="grid" style={{ gap: 16 }}>
              <input type="hidden" name="recordId" value={record.id} />
              {!participantSubmitted && (
                <label className="checkboxRow">
                  <input type="checkbox" name="skipPerspective" defaultChecked={Boolean(payload.participantPerspectiveSkipped)} disabled={readOnly} />
                  <span><strong>Seguir sem formulário do colaborador</strong><br /><small className="muted">Confirmo que a escuta será ou foi feita na conversa e não há necessidade de resposta pelo link.</small></span>
                </label>
              )}

              <div className="grid grid2">
                {feedbackClosingFields.map(([key, label]) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}{['perceivedCare', 'collaboratorCommitment', 'managerCommitment', 'nextMoves', 'autonomySpace', 'followupReason'].includes(key) && <span className="muted"> (quando aplicável)</span>}</label>
                    <textarea
                      id={key}
                      name={key}
                      rows={4}
                      defaultValue={payload[key] ?? ''}
                      disabled={readOnly}
                      placeholder={key === 'essentialRecord' ? 'Resuma situação, leitura, escuta, decisão e acordo em poucas linhas.' : 'Registre somente o necessário para esta situação.'}
                    />
                  </div>
                ))}
              </div>

              {!readOnly && <div><button className="button buttonSecondary" type="submit">Salvar conversa e registro</button></div>}
            </form>
          </div>
        </details>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Fechamento</p>
        <h2 style={{ marginTop: 0 }}>Concluir Feedback</h2>
        {flow === 'orientation' ? (
          <p className="muted">Este registro permanece na trajetória profissional, mas não alimenta Talento em Evidência.</p>
        ) : (
          <p className="muted">Após a conclusão, este reconhecimento poderá alimentar Talento quando houver evidência profissional suficiente. Promoção confirmada exige aprovação formal.</p>
        )}

        {record.status === 'completed' ? (
          <span className="badge badgeAccent">Concluído</span>
        ) : payload.closingSavedAt ? (
          <form action={completeFeedback}>
            <input type="hidden" name="recordId" value={record.id} />
            <button className="button" type="submit">Concluir Feedback</button>
          </form>
        ) : (
          <span className="button buttonSecondary" aria-disabled="true" style={{ opacity: .65, cursor: 'default' }}>Aguardando registro da conversa</span>
        )}
      </section>
    </main>
  );
}
