import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getMarcoZeroRecord } from '@/lib/data/records';
import { marcoZeroManagerFields, marcoZeroQuestions } from '@/lib/marco-zero';
import { buildMarcoZeroConversationGuide, buildMarcoZeroSummary } from '@/lib/workflow-automation';

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

  redirect(`/records/${recordId}/marco-zero?invite=${encodeURIComponent(rawToken)}`);
}

async function saveMarcoZeroConversation(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload, status')
      .eq('id', recordId)
      .eq('module_type', 'marco_zero')
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
  if (record.status === 'completed') redirect(`/records/${recordId}/marco-zero`);
  if (!submitted) redirect(`/records/${recordId}/marco-zero?needsParticipant=1`);

  const mainAgreement = String(formData.get('mainAgreement') ?? '').trim();
  if (!mainAgreement) redirect(`/records/${recordId}/marco-zero?conversation=required`);

  const existingPayload = (record.payload ?? {}) as Record<string, any>;
  const conversationAdjustment = String(formData.get('conversationAdjustment') ?? '').trim();
  const managerSupport = String(formData.get('managerSupport') ?? '').trim();
  const nextFollowUp = String(formData.get('nextFollowUp') ?? '').trim();

  const nextPayload = {
    ...existingPayload,
    conversationAdjustment,
    mainAgreement,
    managerSupport,
    nextFollowUp,
    conversationSavedAt: new Date().toISOString(),
  };
  const marcoZeroSummary = buildMarcoZeroSummary(nextPayload, submitted.response_payload);

  const { error } = await auth.supabase
    .from('module_records')
    .update({
      payload: { ...nextPayload, marcoZeroSummary },
      status: 'in_conversation',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('module_type', 'marco_zero');
  if (error) throw error;

  redirect(`/records/${recordId}/marco-zero?conversation=saved`);
}

async function concludeMarcoZero(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload, status')
      .eq('id', recordId)
      .eq('module_type', 'marco_zero')
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
  if (record.status === 'completed') redirect(`/records/${recordId}/marco-zero`);
  if (!submitted) redirect(`/records/${recordId}/marco-zero?needsParticipant=1`);

  const payload = (record.payload ?? {}) as Record<string, any>;
  if (!payload.conversationSavedAt || !payload.mainAgreement) {
    redirect(`/records/${recordId}/marco-zero?conversation=required`);
  }

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from('module_records')
    .update({
      status: 'completed',
      participant_locked_at: now,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', recordId)
    .eq('module_type', 'marco_zero');

  if (error) throw error;

  await auth.supabase
    .from('participant_access_tokens')
    .update({ revoked_at: now })
    .eq('record_id', recordId)
    .is('revoked_at', null);

  redirect(`/records/${recordId}/marco-zero?completed=1`);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_participant: 'Aguardando respostas',
    participant_submitted: 'Respostas recebidas',
    in_conversation: 'Conversa registrada',
    completed: 'Concluído',
  };
  return labels[status] ?? status;
}

export default async function MarcoZeroManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; completed?: string; conversation?: string; needsParticipant?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getMarcoZeroRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, string>;
  const participantSubmitted = Boolean(record.latestResponse?.is_submitted);
  const participantPath = query.invite ? `/participate/marco-zero/${query.invite}` : null;
  const completed = record.status === 'completed';
  const conversationGuide = buildMarcoZeroConversationGuide(payload, response, record.employee.display_name);
  const summaryPreview = buildMarcoZeroSummary(payload, response);

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>

      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Marco Zero · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{record.employee.role_title ?? 'Função não informada'} · {record.employee.current_squad ?? 'Frente não informada'}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Marco Zero concluído. A síntese final já pode ser usada no registro oficial e na trajetória.</div>}
      {query.conversation === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Conversa registrada e síntese final atualizada.</div>}
      {query.conversation === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Registre o acordo principal da conversa antes de concluir.</div>}
      {query.needsParticipant && <div className="notice" style={{ marginBottom: 18 }}>A preparação do colaborador precisa ser enviada antes do fechamento.</div>}

      <section className="grid grid2">
        <article className="card">
          <p className="eyebrow">1. Avaliação do gestor</p>
          <h2>Contexto e direção</h2>
          <div className="grid" style={{ gap: 14 }}>
            {marcoZeroManagerFields.map(([key, label]) => (
              <div key={key}>
                <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{label}</strong>
                <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{String(payload[key] || '—')}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">2. Perspectiva do colaborador</p>
          <h2>Preparação para a conversa</h2>
          {record.latestResponse ? (
            <div className="grid" style={{ gap: 14 }}>
              {marcoZeroQuestions.map((question) => (
                <div key={question.key}>
                  <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{question.label}</strong>
                  <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{response[question.key] || '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Nenhuma resposta recebida ainda.</p>
          )}
        </article>
      </section>

      {!completed && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">Participação</p>
          <h2>Convidar para preparação</h2>
          <p className="muted">Gerar um novo link revoga links anteriores. O link expira em 14 dias.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <form action={generateParticipantLink}>
              <input type="hidden" name="recordId" value={record.id} />
              <button className="button buttonSecondary" type="submit">Gerar novo link</button>
            </form>
            {participantPath && <CopyLink path={participantPath} />}
          </div>
        </section>
      )}

      {participantSubmitted && !completed && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">3. Orientação da conversa · Gestor</p>
          <h2>Roteiro sugerido a partir deste Marco Zero</h2>
          <p className="muted">O roteiro cruza sua preparação e a perspectiva da pessoa. A lente do Chat Matriz orienta apenas a condução; não cria fatos nem substitui sua leitura.</p>

          <div className="notice" style={{ marginBottom: 16 }}>
            <strong>Objetivo da conversa</strong>
            <p className="muted" style={{ marginBottom: 0 }}>{conversationGuide.objective}</p>
          </div>

          <div className="grid grid2">
            <article className="workspaceMiniCard">
              <strong>Comece reconhecendo</strong>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                {conversationGuide.recognition.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}
              </ul>
            </article>
            <article className="workspaceMiniCard">
              <strong>Perguntas-chave</strong>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                {conversationGuide.questions.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}
              </ul>
            </article>
            <article className="workspaceMiniCard">
              <strong>Direcionamento do gestor</strong>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                {conversationGuide.managerDirections.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}
              </ul>
            </article>
            <article className="workspaceMiniCard">
              <strong>Cuidados de condução</strong>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                {conversationGuide.watchouts.map((item, index) => <li key={index} className="muted" style={{ marginTop: 8 }}>{item}</li>)}
              </ul>
            </article>
          </div>
        </section>
      )}

      {!completed && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">4. Decisão e acordos</p>
          <h2>Registrar somente o que a conversa definiu</h2>
          <p className="muted">Não repita os campos anteriores. Registre apenas ajuste relevante, acordo central e apoio específico.</p>

          <form action={saveMarcoZeroConversation} className="grid" style={{ gap: 16 }}>
            <input type="hidden" name="recordId" value={record.id} />
            <fieldset disabled={!participantSubmitted} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: participantSubmitted ? 1 : .58 }}>
              <div className="grid grid2">
                <div className="field">
                  <label htmlFor="conversationAdjustment">O que mudou ou ficou mais claro? <span className="muted">(opcional)</span></label>
                  <textarea id="conversationAdjustment" name="conversationAdjustment" rows={3} defaultValue={String(payload.conversationAdjustment ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="mainAgreement">Acordo principal</label>
                  <textarea id="mainAgreement" name="mainAgreement" rows={3} defaultValue={String(payload.mainAgreement ?? '')} required placeholder="Registre o acordo central que orientará o início do ciclo." />
                </div>
                <div className="field">
                  <label htmlFor="managerSupport">Apoio do gestor <span className="muted">(opcional)</span></label>
                  <textarea id="managerSupport" name="managerSupport" rows={3} defaultValue={String(payload.managerSupport ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="nextFollowUp">Próximo acompanhamento <span className="muted">(opcional)</span></label>
                  <input id="nextFollowUp" name="nextFollowUp" type="date" defaultValue={String(payload.nextFollowUp ?? '')} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="button buttonSecondary" type="submit">Registrar conversa e gerar síntese</button>
              </div>
            </fieldset>
          </form>

          {summaryPreview && (
            <div className="notice" style={{ marginTop: 18 }}>
              <strong>Síntese final do ciclo</strong>
              <p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{summaryPreview}</p>
            </div>
          )}
        </section>
      )}

      {completed && summaryPreview && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">Síntese final do ciclo</p>
          <p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{summaryPreview}</p>
        </section>
      )}

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">5. Fechamento</p>
        <h2>Concluir Marco Zero</h2>
        <p className="muted">A conclusão preserva as duas perspectivas, os acordos da conversa e a síntese final como histórico do ciclo.</p>
        <form action={concludeMarcoZero}>
          <input type="hidden" name="recordId" value={record.id} />
          <button
            className="button"
            type="submit"
            disabled={completed || !participantSubmitted || !payload.conversationSavedAt}
            style={{ opacity: completed || !participantSubmitted || !payload.conversationSavedAt ? .5 : 1 }}
          >
            {completed ? 'Marco Zero concluído' : !participantSubmitted ? 'Aguardando participação' : !payload.conversationSavedAt ? 'Registre a conversa para concluir' : 'Concluir Marco Zero'}
          </button>
        </form>
      </section>
    </main>
  );
}
