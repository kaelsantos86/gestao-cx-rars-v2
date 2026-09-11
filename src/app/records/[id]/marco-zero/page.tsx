import { createHash, randomBytes } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getMarcoZeroRecord } from '@/lib/data/records';
import { marcoZeroManagerFields, marcoZeroQuestions } from '@/lib/marco-zero';

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

async function concludeMarcoZero(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

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
  redirect(`/records/${recordId}/marco-zero?completed=1`);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_participant: 'Aguardando respostas',
    participant_submitted: 'Respostas recebidas',
    in_conversation: 'Em conversa',
    completed: 'Concluído',
  };
  return labels[status] ?? status;
}

export default async function MarcoZeroManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; completed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getMarcoZeroRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, string>;
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, string>;
  const participantPath = query.invite ? `/participate/marco-zero/${query.invite}` : null;
  const completed = record.status === 'completed';

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Marco Zero · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{record.employee.role_title ?? 'Função não informada'} · {record.employee.current_squad ?? 'Frente não informada'}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Marco Zero concluído. A participação do colaborador está bloqueada e o registro já pode compor a timeline.</div>}

      <section className="grid grid2">
        <article className="card">
          <p className="eyebrow">Preparação do gestor</p>
          <h2>Contexto e direção</h2>
          <div className="grid" style={{ gap: 14 }}>
            {marcoZeroManagerFields.map(([key, label]) => (
              <div key={key}>
                <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{label}</strong>
                <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{payload[key] || '—'}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Participação</p>
          <h2>Preparação do colaborador</h2>
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
          <p className="eyebrow">Link seguro</p>
          <h2>Convidar para preparação</h2>
          <p className="muted">Gerar um novo link revoga links anteriores. O token bruto aparece somente nesta sessão e expira em 14 dias.</p>
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
        <p className="eyebrow">Fechamento</p>
        <h2>Conversa e conclusão</h2>
        <p className="muted">Conclua somente depois da conversa e da confirmação dos acordos essenciais. Após concluir, o colaborador não poderá mais editar as respostas.</p>
        <form action={concludeMarcoZero}>
          <input type="hidden" name="recordId" value={record.id} />
          <button className="button" type="submit" disabled={completed} style={{ opacity: completed ? .5 : 1 }}>
            {completed ? 'Marco Zero concluído' : 'Concluir Marco Zero'}
          </button>
        </form>
      </section>
    </main>
  );
}
