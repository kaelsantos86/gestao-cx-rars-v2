import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getNinetyDayRecord } from '@/lib/data/records';
import {
  ninetyDayConclusionFields,
  ninetyDayDimensions,
  ninetyDayDirections,
  ninetyDayManagerPreparationFields,
  ninetyDayReflectionQuestions,
} from '@/lib/ninety-days';

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
      .select('id')
      .eq('record_id', recordId)
      .eq('is_submitted', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (fetchError) throw fetchError;
  if (responseError) throw responseError;
  if (!submitted) redirect(`/records/${recordId}/ninety-days?needsParticipant=1`);

  const priorities = [1, 2, 3]
    .map((index) => ({
      result: String(formData.get(`priority${index}Result`) ?? '').trim(),
      evidence: String(formData.get(`priority${index}Evidence`) ?? '').trim(),
      date: String(formData.get(`priority${index}Date`) ?? ''),
      support: String(formData.get(`priority${index}Support`) ?? '').trim(),
    }))
    .filter((priority) => priority.result || priority.evidence || priority.date || priority.support);

  const conversation = Object.fromEntries(
    ninetyDayConclusionFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );

  const agreedDirection = String(formData.get('agreedDirection') ?? '');
  if (!agreedDirection || !conversation.ninetyDaySummary || !conversation.workAgreements || !conversation.employeeCommitments || !conversation.managerCommitments) {
    redirect(`/records/${recordId}/ninety-days?conversation=required`);
  }

  const payload = {
    ...((record.payload ?? {}) as Record<string, unknown>),
    agreedDirection,
    ...conversation,
    priorities,
    nextFollowUp: String(formData.get('nextFollowUp') ?? ''),
    nextCycleReview: String(formData.get('nextCycleReview') ?? ''),
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
  const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];

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

      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Avaliação concluída. As respostas foram bloqueadas e o registro agora pode alimentar o primeiro PDI e o Talento em Evidência.</div>}
      {query.conversation === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Conversa, acordos e próximo ciclo salvos.</div>}
      {query.conversation === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Registre direção, síntese e compromissos da conversa antes de concluir.</div>}
      {query.needsParticipant && <div className="notice" style={{ marginBottom: 18 }}>A autoavaliação do colaborador precisa ser enviada antes da conversa e da conclusão.</div>}

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
        <p className="muted">Diferença maior que 1 ponto é um convite para explorar fatos e contexto, não uma correção automática.</p>
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
          <p className="eyebrow">Reflexões do colaborador</p>
          <h2>9 perguntas</h2>
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
          <p className="muted">O novo link revoga links anteriores e expira em 14 dias. As respostas ficam versionadas e a pessoa pode revisar até a conclusão.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <form action={generateParticipantLink}>
              <input type="hidden" name="recordId" value={record.id} />
              <button className="button" type="submit">Gerar novo link</button>
            </form>
            {participantPath && <CopyLink path={participantPath} />}
          </div>
          {participantPath && <code style={{ display: 'block', marginTop: 14, overflowWrap: 'anywhere' }}>{participantPath}</code>}
        </section>
      )}

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Conversa e próximo ciclo</p>
        <h2>Registrar síntese e acordos</h2>
        {!participantSubmitted && !completed && (
          <div className="notice" style={{ marginBottom: 18 }}>
            Esta etapa será liberada após o envio da autoavaliação. Assim, a leitura do colaborador permanece independente antes da conversa conjunta.
          </div>
        )}
        <form action={saveConversation} className="grid" style={{ gap: 18 }}>
          <input type="hidden" name="recordId" value={record.id} />
          <fieldset disabled={!conversationReady} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: conversationReady ? 1 : .58 }}>
            <div className="grid" style={{ gap: 18 }}>
              <div className="field">
                <label htmlFor="agreedDirection">Direção acordada</label>
                <select id="agreedDirection" name="agreedDirection" defaultValue={String(payload.agreedDirection ?? '')} required>
                  <option value="" disabled>Selecione</option>
                  {ninetyDayDirections.map((direction) => <option key={direction.value} value={direction.value}>{direction.label}</option>)}
                </select>
              </div>

              <div className="grid grid2">
                {ninetyDayConclusionFields.map(([key, label]) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <textarea id={key} name={key} rows={4} defaultValue={String(payload[key] ?? '')} required />
                  </div>
                ))}
              </div>

              <div>
                <p className="eyebrow">Até 3 prioridades</p>
                <h3>Resultado, evidência, data e apoio</h3>
                <div className="grid" style={{ gap: 14 }}>
                  {[1, 2, 3].map((index) => {
                    const priority = priorities[index - 1] ?? {};
                    return (
                      <div key={index} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
                        <strong>Prioridade {index}</strong>
                        <div className="grid grid2" style={{ marginTop: 10 }}>
                          <div className="field"><label>Resultado esperado</label><textarea name={`priority${index}Result`} rows={3} defaultValue={priority.result ?? ''} /></div>
                          <div className="field"><label>Evidência de evolução</label><textarea name={`priority${index}Evidence`} rows={3} defaultValue={priority.evidence ?? ''} /></div>
                          <div className="field"><label>Data</label><input name={`priority${index}Date`} type="date" defaultValue={priority.date ?? ''} /></div>
                          <div className="field"><label>Apoio necessário</label><textarea name={`priority${index}Support`} rows={3} defaultValue={priority.support ?? ''} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid2">
                <div className="field"><label htmlFor="nextFollowUp">Próximo acompanhamento</label><input id="nextFollowUp" name="nextFollowUp" type="date" defaultValue={String(payload.nextFollowUp ?? '')} /></div>
                <div className="field"><label htmlFor="nextCycleReview">Próxima revisão de ciclo</label><input id="nextCycleReview" name="nextCycleReview" type="date" defaultValue={String(payload.nextCycleReview ?? '')} /></div>
              </div>

              {!completed && <div><button className="button buttonSecondary" type="submit">Salvar conversa e próximo ciclo</button></div>}
            </div>
          </fieldset>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Fechamento</p>
        <h2>Concluir avaliação</h2>
        <p className="muted">A conclusão bloqueia novas edições do colaborador e transforma esta avaliação em fonte válida para o primeiro PDI.</p>
        <p className="muted"><strong>Autoavaliação:</strong> {participantSubmitted ? 'enviada' : 'ainda não enviada'} · <strong>Conversa:</strong> {payload.conversationSavedAt ? 'registrada' : 'a registrar'}</p>
        <form action={concludeNinetyDay}>
          <input type="hidden" name="recordId" value={record.id} />
          <button className="button" type="submit" disabled={completed || !conclusionReady} style={{ opacity: completed || !conclusionReady ? .5 : 1 }}>
            {completed
              ? 'Avaliação concluída'
              : !participantSubmitted
                ? 'Aguardando autoavaliação'
                : !payload.conversationSavedAt
                  ? 'Registre a conversa para concluir'
                  : 'Concluir Avaliação de 90 dias'}
          </button>
        </form>
      </section>
    </main>
  );
}
