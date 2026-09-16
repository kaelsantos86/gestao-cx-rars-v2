import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getNinetyDayRecord } from '@/lib/data/records';
import {
  ninetyDayDimensions,
  ninetyDayDirections,
  ninetyDayManagerPreparationFields,
  ninetyDayReflectionQuestions,
} from '@/lib/ninety-days';
import { buildNinetyDaySummary } from '@/lib/workflow-automation';

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

  redirect(`/records/${recordId}/ninety-days?invite=${encodeURIComponent(rawToken)}`);
}

async function saveConversation(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: fetchError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload')
      .eq('id', recordId)
      .eq('module_type', 'ninety_days')
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

  if (fetchError) throw fetchError;
  if (responseError) throw responseError;
  if (!submitted) redirect(`/records/${recordId}/ninety-days?needsParticipant=1`);

  const existingPayload = (record.payload ?? {}) as Record<string, any>;
  const agreedDirection = String(formData.get('agreedDirection') ?? '').trim();
  if (!agreedDirection || !ninetyDayDirections.some((item) => item.value === agreedDirection)) {
    redirect(`/records/${recordId}/ninety-days?conversation=required`);
  }

  const conversationAdjustment = String(formData.get('conversationAdjustment') ?? '').trim();
  const mainAgreement = String(formData.get('mainAgreement') ?? '').trim();
  const managerSupport = String(formData.get('managerSupport') ?? '').trim();
  const directionLabel = ninetyDayDirections.find((item) => item.value === agreedDirection)?.label ?? agreedDirection;
  const ninetyDaySummary = buildNinetyDaySummary(
    existingPayload,
    submitted.response_payload,
    directionLabel,
    conversationAdjustment,
    mainAgreement,
  );

  const payload = {
    ...existingPayload,
    agreedDirection,
    conversationAdjustment,
    mainAgreement,
    managerSupport,
    ninetyDaySummary,
    workAgreements: mainAgreement || existingPayload.workAgreements || '',
    managerCommitments: managerSupport || existingPayload.managerCommitments || '',
    nextFollowUp: String(formData.get('nextFollowUp') ?? ''),
    conversationSavedAt: new Date().toISOString(),
  };

  const { error } = await auth.supabase
    .from('module_records')
    .update({ payload, status: 'in_conversation', updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'ninety_days');
  if (error) throw error;

  redirect(`/records/${recordId}/ninety-days?conversation=saved`);
}

async function concludeNinetyDay(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload')
      .eq('id', recordId)
      .eq('module_type', 'ninety_days')
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
  if (!submitted) redirect(`/records/${recordId}/ninety-days?needsParticipant=1`);

  const payload = (record.payload ?? {}) as Record<string, unknown>;
  if (!payload.conversationSavedAt || !payload.ninetyDaySummary || !payload.agreedDirection) {
    redirect(`/records/${recordId}/ninety-days?conversation=required`);
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
    .eq('module_type', 'ninety_days');
  if (error) throw error;

  redirect(`/records/${recordId}/ninety-days?completed=1`);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_participant: 'Aguardando autoavaliação',
    participant_submitted: 'Autoavaliação recebida',
    in_conversation: 'Conversa registrada',
    completed: 'Concluída',
  };
  return labels[status] ?? status;
}

function comparisonSignal(manager: number, participant: number | undefined) {
  if (!participant) return 'Aguardando';
  const difference = Math.abs(manager - participant);
  if (difference === 0) return 'Convergência';
  if (difference === 1) return 'Diferença leve';
  return 'Explorar na conversa';
}

export default async function NinetyDayManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; completed?: string; conversation?: string; needsParticipant?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getNinetyDayRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const managerRatings = (payload.managerRatings ?? {}) as Record<string, number>;
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, any>;
  const participantRatings = (response.ratings ?? {}) as Record<string, number>;
  const reflections = (response.reflections ?? {}) as Record<string, string>;
  const participantSubmitted = Boolean(record.latestResponse?.is_submitted);
  const participantPath = query.invite ? `/participate/ninety-days/${query.invite}` : null;
  const completed = record.status === 'completed';
  const conversationReady = participantSubmitted && !completed;
  const conclusionReady = participantSubmitted && Boolean(payload.conversationSavedAt) && !completed;
  const directionLabel = ninetyDayDirections.find((item) => item.value === payload.agreedDirection)?.label;
  const summaryPreview = buildNinetyDaySummary(
    payload,
    response,
    directionLabel,
    payload.conversationAdjustment,
    payload.mainAgreement,
  );

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Avaliação de 90 dias · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{record.employee.role_title ?? 'Função não informada'} · {record.employee.current_squad ?? 'Frente não informada'}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Avaliação concluída. O registro agora pode alimentar o primeiro PDI e o Talento em Evidência.</div>}
      {query.conversation === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Conversa registrada e síntese gerada automaticamente.</div>}
      {query.conversation === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Selecione a direção acordada para registrar a conversa.</div>}
      {query.needsParticipant && <div className="notice" style={{ marginBottom: 18 }}>A autoavaliação precisa ser enviada antes do fechamento.</div>}

      <section className="card">
        <p className="eyebrow">Base da avaliação</p>
        <h2 style={{ marginTop: 0 }}>{payload.entryBasis === 'completed_marco_zero' ? 'Marco Zero concluído' : 'Devolutiva inicial confirmada'}</h2>
        <p className="muted">{payload.entryBasis === 'completed_marco_zero'
          ? 'O Marco Zero está vinculado como fonte desta avaliação.'
          : 'A pessoa entrou na V2 em consolidação; o alinhamento inicial foi confirmado sem recriar artificialmente um Marco Zero.'}</p>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Comparação</p>
        <h2>5 dimensões · gestor x colaborador</h2>
        <p className="muted">A comparação serve para orientar perguntas. Diferença de percepção não gera correção automática.</p>
        <div className="grid" style={{ gap: 12 }}>
          {ninetyDayDimensions.map((dimension) => {
            const manager = Number(managerRatings[dimension.key] ?? 0);
            const participant = participantRatings[dimension.key];
            return (
              <div key={dimension.key} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div><strong>{dimension.label}</strong><div className="muted" style={{ fontSize: 13 }}>{dimension.help}</div></div>
                  <span className="badge">{comparisonSignal(manager, participant)}</span>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                  <span><strong>Gestor:</strong> {manager || '—'}</span>
                  <span><strong>Colaborador:</strong> {participant || '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid2" style={{ marginTop: 18 }}>
        <article className="card">
          <p className="eyebrow">Preparação do gestor</p>
          <h2>Fatos e leitura</h2>
          <div className="grid" style={{ gap: 14 }}>
            {ninetyDayManagerPreparationFields.map(([key, label]) => (
              <div key={key}><strong style={{ display: 'block', fontSize: 13 }}>{label}</strong><div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{String(payload[key] ?? '—')}</div></div>
            ))}
          </div>
        </article>
        <article className="card">
          <p className="eyebrow">Perspectiva do colaborador</p>
          <h2>Reflexões para a conversa</h2>
          {record.latestResponse ? (
            <div className="grid" style={{ gap: 14 }}>
              {ninetyDayReflectionQuestions.map((question) => (
                <div key={question.key}><strong style={{ display: 'block', fontSize: 13 }}>{question.label}</strong><div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{reflections[question.key] || '—'}</div></div>
              ))}
            </div>
          ) : <p className="muted">Nenhuma autoavaliação recebida ainda.</p>}
        </article>
      </section>

      {!completed && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">Link seguro</p>
          <h2>Convidar para autoavaliação</h2>
          <p className="muted">O novo link revoga links anteriores e expira em 14 dias.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <form action={generateParticipantLink}>
              <input type="hidden" name="recordId" value={record.id} />
              <button className="button" type="submit">Gerar novo link</button>
            </form>
            {participantPath && <CopyLink path={participantPath} />}
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Conversa e fechamento</p>
        <h2>Confirmar direção — o resumo é automático</h2>
        <p className="muted">A avaliação já contém notas, fatos e a perspectiva da pessoa. No fechamento, registre apenas o que mudou ou foi acordado; a síntese para registro oficial é montada a partir do conteúdo existente.</p>
        {!participantSubmitted && !completed && <div className="notice" style={{ marginBottom: 18 }}>Esta etapa será liberada após a autoavaliação.</div>}

        <form action={saveConversation} className="grid" style={{ gap: 16 }}>
          <input type="hidden" name="recordId" value={record.id} />
          <fieldset disabled={!conversationReady} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: conversationReady ? 1 : .58 }}>
            <div className="grid grid2">
              <div className="field">
                <label htmlFor="agreedDirection">Direção acordada</label>
                <select id="agreedDirection" name="agreedDirection" defaultValue={String(payload.agreedDirection ?? '')} required>
                  <option value="" disabled>Selecione</option>
                  {ninetyDayDirections.map((direction) => <option key={direction.value} value={direction.value}>{direction.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="nextFollowUp">Próximo acompanhamento <span className="muted">(opcional)</span></label>
                <input id="nextFollowUp" name="nextFollowUp" type="date" defaultValue={String(payload.nextFollowUp ?? '')} />
              </div>
              <div className="field">
                <label htmlFor="conversationAdjustment">O que mudou após a conversa? <span className="muted">(opcional)</span></label>
                <textarea id="conversationAdjustment" name="conversationAdjustment" rows={3} defaultValue={String(payload.conversationAdjustment ?? '')} placeholder="Registre somente novo contexto ou ajuste relevante." />
              </div>
              <div className="field">
                <label htmlFor="mainAgreement">Acordo principal do próximo ciclo <span className="muted">(opcional)</span></label>
                <textarea id="mainAgreement" name="mainAgreement" rows={3} defaultValue={String(payload.mainAgreement ?? payload.workAgreements ?? '')} placeholder="Um acordo central é suficiente quando não houver necessidade de detalhamento adicional." />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="managerSupport">Apoio do gestor <span className="muted">(opcional)</span></label>
                <textarea id="managerSupport" name="managerSupport" rows={3} defaultValue={String(payload.managerSupport ?? payload.managerCommitments ?? '')} placeholder="Registre apenas apoio específico que realmente tenha sido combinado." />
              </div>
            </div>
            {!completed && <div style={{ marginTop: 14 }}><button className="button buttonSecondary" type="submit">Registrar conversa e gerar síntese</button></div>}
          </fieldset>
        </form>

        {(payload.ninetyDaySummary || summaryPreview) && (
          <div className="notice" style={{ marginTop: 18 }}>
            <strong>Síntese automática</strong>
            <p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{payload.ninetyDaySummary || summaryPreview}</p>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Fechamento</p>
        <h2>Concluir avaliação</h2>
        <p className="muted">A conclusão bloqueia novas edições e transforma esta avaliação em fonte válida para o PDI.</p>
        <form action={concludeNinetyDay}>
          <input type="hidden" name="recordId" value={record.id} />
          <button className="button" type="submit" disabled={completed || !conclusionReady} style={{ opacity: completed || !conclusionReady ? .5 : 1 }}>
            {completed ? 'Avaliação concluída' : !participantSubmitted ? 'Aguardando autoavaliação' : !payload.conversationSavedAt ? 'Registre a conversa para concluir' : 'Concluir Avaliação de 90 dias'}
          </button>
        </form>
      </section>
    </main>
  );
}
