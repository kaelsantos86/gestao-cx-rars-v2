import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParticipantFeedback } from '@/lib/data/records';
import { feedbackFlowLabel, feedbackParticipantFields, recognitionModeLabel } from '@/lib/feedback';

async function savePerspective(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const intent = String(formData.get('intent') ?? 'draft');
  const submit = intent === 'submit';

  const response = Object.fromEntries(
    feedbackParticipantFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );

  if (submit) {
    const required = feedbackParticipantFields.filter(([key]) => key !== 'additionalNotes');
    if (required.some(([key]) => !response[key])) {
      redirect(`/participate/feedback/${encodeURIComponent(token)}?required=1`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_participant_response', {
    raw_token: token,
    response,
    submit_response: submit,
  });
  if (error) throw error;

  redirect(`/participate/feedback/${encodeURIComponent(token)}?${submit ? 'submitted=1' : 'saved=1'}`);
}

export default async function FeedbackParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string; required?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const record = await getParticipantFeedback(token);
  if (!record) notFound();

  const shared = (record.shared_context ?? {}) as Record<string, string | null>;
  const latest = (record.latest_response ?? {}) as Record<string, string>;
  const locked = Boolean(record.locked) || ['completed', 'archived', 'cancelled'].includes(record.status);
  const flow = String(shared.feedbackFlow ?? 'orientation');
  const recognitionMode = String(shared.recognitionMode ?? 'recognition');

  return (
    <main className="page">
      <p className="eyebrow">Feedback · Sua perspectiva</p>
      <h1 className="pageTitle">{record.employee_name}</h1>
      <p className="lead">
        {feedbackFlowLabel(flow)}{flow === 'recognition' ? ` · ${recognitionModeLabel(recognitionMode)}` : ''}
      </p>

      {shared.shareableContext && (
        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Contexto compartilhado</p>
          <p className="muted" style={{ marginBottom: 0 }}>{shared.shareableContext}</p>
        </section>
      )}

      {query.saved && <div className="notice" style={{ marginBottom: 18 }}>Rascunho salvo. Você pode voltar pelo mesmo link enquanto o feedback não for concluído.</div>}
      {query.submitted && <div className="notice" style={{ marginBottom: 18 }}>Perspectiva enviada. O gestor poderá usá-la como base para a conversa sem alterar seu texto original.</div>}
      {query.required && <div className="notice" style={{ marginBottom: 18 }}>Preencha os campos principais antes de enviar.</div>}
      {locked && <div className="notice" style={{ marginBottom: 18 }}>Este feedback já foi concluído. Sua perspectiva está preservada e não pode mais ser alterada.</div>}

      <form action={savePerspective} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="token" value={token} />
        <section className="card">
          <p className="eyebrow">Escuta</p>
          <h2 style={{ marginTop: 0 }}>Sua leitura antes da conversa</h2>
          <p className="muted">Não há resposta certa. Use fatos, contexto e o que você considera importante para uma conversa clara.</p>
          <div className="grid grid2">
            {feedbackParticipantFields.map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}{key === 'additionalNotes' && <span className="muted"> (opcional)</span>}</label>
                <textarea
                  id={key}
                  name={key}
                  rows={4}
                  defaultValue={latest[key] ?? ''}
                  disabled={locked}
                  placeholder="Use fatos, exemplos e contexto profissional."
                />
              </div>
            ))}
          </div>
        </section>

        {!locked && (
          <div className="actionsRow">
            <button className="button buttonSecondary" type="submit" name="intent" value="draft">Salvar rascunho</button>
            <button className="button" type="submit" name="intent" value="submit">Enviar perspectiva</button>
          </div>
        )}
      </form>
    </main>
  );
}
