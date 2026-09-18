import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getFeedbackRecord } from '@/lib/data/records';
import {
  feedbackFlowLabel,
  feedbackParticipantFields,
  orientationPreparationFields,
  promotionFields,
  recognitionModeLabel,
  recognitionPreparationFields,
} from '@/lib/feedback';
import { buildFeedbackConversationGuide, buildFeedbackEssentialRecord } from '@/lib/workflow-automation';

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
  await auth.supabase.from('participant_access_tokens').update({ revoked_at: new Date().toISOString() }).eq('record_id', recordId).is('revoked_at', null);
  const { error } = await auth.supabase.from('participant_access_tokens').insert({ record_id: recordId, token_hash: tokenHash, expires_at: expiresAt });
  if (error) throw error;
  const { data: record } = await auth.supabase.from('module_records').select('status').eq('id', recordId).eq('module_type', 'feedback').single();
  if (record?.status === 'draft') {
    await auth.supabase.from('module_records').update({ status: 'awaiting_participant', updated_at: new Date().toISOString() }).eq('id', recordId);
  }
  redirect(`/records/${recordId}/feedback?invite=${encodeURIComponent(rawToken)}`);
}

async function saveFeedbackClosing(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');
  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase.from('module_records').select('payload, status').eq('id', recordId).eq('module_type', 'feedback').single(),
    auth.supabase.from('participant_responses').select('response_payload').eq('record_id', recordId).eq('is_submitted', true).order('version', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (recordError) throw recordError;
  if (responseError) throw responseError;
  if (['completed', 'archived', 'cancelled'].includes(String(record.status))) redirect(`/records/${recordId}/feedback`);

  const skipPerspective = formData.get('skipPerspective') === 'on';
  if (!submitted && !skipPerspective) redirect(`/records/${recordId}/feedback?perspective=decision`);

  const existingPayload = (record.payload ?? {}) as Record<string, any>;
  const response = (submitted?.response_payload ?? {}) as Record<string, any>;
  const conversationAdjustment = String(formData.get('conversationAdjustment') ?? '').trim();
  const mainAgreement = String(formData.get('mainAgreement') ?? '').trim();
  const managerCommitment = String(formData.get('managerCommitment') ?? '').trim();
  const futureDirection = String(formData.get('futureDirection') ?? '').trim() || existingPayload.expectedDirection || existingPayload.futureDirection || '';
  const autoRecord = buildFeedbackEssentialRecord(existingPayload, response, conversationAdjustment);
  const essentialRecordOverride = String(formData.get('essentialRecordOverride') ?? '').trim();
  const essentialRecord = essentialRecordOverride || autoRecord;
  if (!essentialRecord) redirect(`/records/${recordId}/feedback?closing=required`);

  const recognitionEvidenceReady = existingPayload.feedbackFlow === 'recognition'
    && Boolean(existingPayload.concreteContribution)
    && Boolean(existingPayload.generatedImpact)
    && Boolean(existingPayload.recognizedStrengths)
    && Boolean(existingPayload.competenciesValues);

  const payload = {
    ...existingPayload,
    conversationAdjustment,
    mainAgreement,
    managerCommitment,
    nextMoves: mainAgreement || existingPayload.nextMoves || '',
    futureDirection,
    essentialRecord,
    essentialRecordManuallyAdjusted: Boolean(essentialRecordOverride),
    participantPerspectiveUsed: Boolean(submitted),
    participantPerspectiveSkipped: !submitted,
    recognitionEvidenceReady,
    closingSavedAt: new Date().toISOString(),
  };
  const { error } = await auth.supabase.from('module_records').update({ payload, status: 'in_conversation', updated_at: new Date().toISOString() }).eq('id', recordId).eq('module_type', 'feedback');
  if (error) throw error;
  redirect(`/records/${recordId}/feedback?closing=saved`);
}

async function completeFeedback(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');
  const { data: record, error } = await auth.supabase.from('module_records').select('payload, status').eq('id', recordId).eq('module_type', 'feedback').single();
  if (error) throw error;
  const payload = (record.payload ?? {}) as Record<string, any>;
  if (record.status !== 'in_conversation' || !payload.closingSavedAt || !payload.essentialRecord) redirect(`/records/${recordId}/feedback?closing=required`);
  if (payload.feedbackFlow === 'recognition' && payload.recognitionMode === 'promotion' && !payload.promotionApproved) redirect(`/records/${recordId}/feedback?promotion=approval`);
  const talentEligible = payload.feedbackFlow === 'recognition' && Boolean(payload.recognitionEvidenceReady);
  const now = new Date().toISOString();
  const nextPayload = { ...payload, talentEligible, completedWithEvidence: talentEligible };
  const { error: updateError } = await auth.supabase.from('module_records').update({ payload: nextPayload, status: 'completed', completed_at: now, participant_locked_at: now, updated_at: now }).eq('id', recordId).eq('module_type', 'feedback');
  if (updateError) throw updateError;
  await auth.supabase.from('participant_access_tokens').update({ revoked_at: now }).eq('record_id', recordId).is('revoked_at', null);
  redirect(`/records/${recordId}/feedback?completed=1`);
}

export default async function FeedbackManagerPage({ params, searchParams }: {
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
  const autoRecord = buildFeedbackEssentialRecord(payload, response, payload.conversationAdjustment);
  const conversationGuide = buildFeedbackConversationGuide(payload, response, record.employee.display_name);
  const displayedRecord = payload.essentialRecordManuallyAdjusted ? payload.essentialRecord : autoRecord;

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <section className="hero" style={{ marginTop: 16 }}>
        <div><p className="eyebrow">Feedback pontual · Gestor</p><h1 className="pageTitle">{record.employee.display_name}</h1><p className="lead">{feedbackFlowLabel(flow)}{flow === 'recognition' ? ` · ${recognitionModeLabel(recognitionMode)}` : ''}</p></div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.closing === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Conversa registrada e resumo essencial gerado automaticamente.</div>}
      {query.closing === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível gerar o registro essencial; revise a preparação.</div>}
      {query.perspective === 'decision' && <div className="notice" style={{ marginBottom: 18 }}>Use a escuta do colaborador ou confirme que a conversa seguirá sem formulário.</div>}
      {query.promotion === 'approval' && <div className="notice" style={{ marginBottom: 18 }}>Promoção não pode ser concluída sem aprovação formal registrada.</div>}
      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Feedback concluído e preservado na trajetória.</div>}

      <div className="workspaceStack">
        <details className="workspaceAccordion" open>
          <summary className="workspaceSummary"><span><strong>1. Preparação do gestor</strong><small>Fatos e intenção já registrados.</small></span><span className="badge">{flow === 'orientation' ? 'Orientação' : recognitionModeLabel(recognitionMode)}</span><span className="competencyChevron" aria-hidden="true">⌄</span></summary>
          <div className="workspaceBody grid grid2">
            {preparationFields.map(([key, label]) => <article className="workspaceMiniCard" key={key}><strong>{label}</strong><p className="muted">{payload[key] || '—'}</p></article>)}
            {flow === 'recognition' && recognitionMode === 'promotion' && promotionFields.map(([key, label]) => <article className="workspaceMiniCard" key={key}><strong>{label}</strong><p className="muted">{payload[key] || '—'}</p></article>)}
          </div>
        </details>

        <details className="workspaceAccordion" open={participantSubmitted || Boolean(participantPath)}>
          <summary className="workspaceSummary"><span><strong>2. Escuta opcional</strong><small>Perspectiva separada da pessoa antes da conversa.</small></span><span className={`badge ${participantSubmitted ? 'badgeAccent' : ''}`}>{participantSubmitted ? 'Recebida' : 'Opcional'}</span><span className="competencyChevron" aria-hidden="true">⌄</span></summary>
          <div className="workspaceBody">
            {participantSubmitted ? <div className="grid grid2">{feedbackParticipantFields.filter(([key]) => Boolean(response[key]?.trim())).map(([key, label]) => <article className="workspaceMiniCard" key={key}><strong>{label}</strong><p className="muted">{response[key]}</p></article>)}</div> : <div className="notice" style={{ marginBottom: 16 }}>O link é opcional; a escuta pode ocorrer diretamente na conversa.</div>}
            {!readOnly && <form action={generateParticipantLink}><input type="hidden" name="recordId" value={record.id} /><button className="button buttonSecondary" type="submit">Gerar link de perspectiva</button></form>}
            {participantPath && <div className="notice" style={{ marginTop: 14 }}><CopyLink path={participantPath} /></div>}
          </div>
        </details>

        {!readOnly && (
          <details className="workspaceAccordion" open={participantSubmitted}>
            <summary className="workspaceSummary"><span><strong>3. Orientação da conversa · Gestor</strong><small>Use fatos, perspectiva e intenção para conduzir a conversa.</small></span><span className="badge">Roteiro</span><span className="competencyChevron" aria-hidden="true">⌄</span></summary>
            <div className="workspaceBody">
              <div className="notice" style={{ marginBottom: 14 }}><strong>Objetivo da conversa</strong><p className="muted" style={{ marginBottom: 0 }}>{conversationGuide.objective}</p></div>
              <div className="grid grid2">
                <article className="workspaceMiniCard"><strong>Pontos para reconhecer ou contextualizar</strong>{conversationGuide.recognition.length ? <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.recognition.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul> : <p className="muted">Use os fatos já registrados na preparação.</p>}</article>
                <article className="workspaceMiniCard"><strong>Perguntas-chave</strong>{conversationGuide.questions.length ? <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.questions.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul> : <p className="muted">Escute a perspectiva antes de consolidar a direção.</p>}</article>
                <article className="workspaceMiniCard"><strong>Direcionamento</strong><ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.managerDirections.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul></article>
                <article className="workspaceMiniCard"><strong>Cuidados de condução</strong><ul style={{ marginBottom: 0, paddingLeft: 20 }}>{conversationGuide.watchouts.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}</ul></article>
              </div>
            </div>
          </details>
        )}

        <details className="workspaceAccordion" open={!readOnly && (participantSubmitted || record.status === 'in_conversation')}>
          <summary className="workspaceSummary"><span><strong>4. Conversa e fechamento</strong><small>Registre somente o que a conversa acrescentou; o resumo é automático.</small></span><span className={`badge ${payload.closingSavedAt ? 'badgeAccent' : ''}`}>{payload.closingSavedAt ? 'Salvo' : 'Pendente'}</span><span className="competencyChevron" aria-hidden="true">⌄</span></summary>
          <div className="workspaceBody">
            {!readOnly && (
              <form action={saveFeedbackClosing} className="grid" style={{ gap: 16 }}>
                <input type="hidden" name="recordId" value={record.id} />
                {!participantSubmitted && <label className="checkboxRow"><input type="checkbox" name="skipPerspective" defaultChecked={Boolean(payload.participantPerspectiveSkipped)} /><span>Confirmo que a escuta foi ou será feita diretamente na conversa, sem formulário.</span></label>}
                <div className="grid grid2">
                  <div className="field"><label htmlFor="conversationAdjustment">O que mudou ou foi esclarecido na conversa? <span className="muted">(opcional)</span></label><textarea id="conversationAdjustment" name="conversationAdjustment" rows={3} defaultValue={payload.conversationAdjustment || ''} /></div>
                  <div className="field"><label htmlFor="mainAgreement">Acordo principal / próximo movimento <span className="muted">(opcional)</span></label><textarea id="mainAgreement" name="mainAgreement" rows={3} defaultValue={payload.mainAgreement || payload.nextMoves || ''} /></div>
                  <div className="field"><label htmlFor="managerCommitment">Apoio do gestor <span className="muted">(opcional)</span></label><textarea id="managerCommitment" name="managerCommitment" rows={3} defaultValue={payload.managerCommitment || ''} /></div>
                  <div className="field"><label htmlFor="futureDirection">Direção futura <span className="muted">(opcional)</span></label><textarea id="futureDirection" name="futureDirection" rows={3} defaultValue={payload.futureDirection || payload.expectedDirection || ''} /></div>
                </div>
                <details className="competencyAccordion"><summary className="competencySummary"><span><strong>Ajustar registro essencial</strong><small>Opcional. Deixe em branco para usar o texto automático abaixo.</small></span><span className="competencyChevron" aria-hidden="true">⌄</span></summary><div className="competencyAccordionBody field"><textarea name="essentialRecordOverride" rows={5} placeholder="Só use se precisar corrigir ou condensar o texto automático." /></div></details>
                <div><button className="button buttonSecondary" type="submit">Registrar conversa e gerar resumo</button></div>
              </form>
            )}
            {displayedRecord && <div className="notice" style={{ marginTop: 14 }}><strong>Síntese final do feedback</strong><p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{displayedRecord}</p></div>}
          </div>
        </details>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Fechamento</p><h2 style={{ marginTop: 0 }}>Concluir Feedback</h2>
        {flow === 'orientation' ? <p className="muted">Orientação/correção permanece na trajetória, mas não alimenta Talento em Evidência.</p> : <p className="muted">Reconhecimento concluído pode alimentar Talento quando houver evidência profissional. Promoção continua exigindo aprovação formal.</p>}
        {record.status === 'completed' ? <span className="badge badgeAccent">Concluído</span> : payload.closingSavedAt ? <form action={completeFeedback}><input type="hidden" name="recordId" value={record.id} /><button className="button" type="submit">Concluir Feedback</button></form> : <span className="badge">Registre a conversa para concluir</span>}
      </section>
    </main>
  );
}
