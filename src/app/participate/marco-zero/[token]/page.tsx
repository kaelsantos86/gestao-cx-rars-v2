import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParticipantMarcoZero } from '@/lib/data/records';
import { marcoZeroQuestions } from '@/lib/marco-zero';

async function saveResponse(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const mode = String(formData.get('mode') ?? 'draft');
  const response = Object.fromEntries(
    marcoZeroQuestions.map((question) => [question.key, String(formData.get(question.key) ?? '')]),
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_participant_response', {
    raw_token: token,
    response,
    submit_response: mode === 'submit',
  });

  if (error) redirect(`/participate/marco-zero/${token}?error=1`);
  redirect(`/participate/marco-zero/${token}?${mode === 'submit' ? 'submitted=1' : 'saved=1'}`);
}

export default async function MarcoZeroParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const data = await getParticipantMarcoZero(token);
  if (!data) notFound();

  const latest = data.latest_response ?? {};
  const contextEntries = [
    ['Propósito do trabalho', data.shared_context?.purpose],
    ['Contribuição esperada', data.shared_context?.expectedContribution],
    ['Critérios de sucesso', data.shared_context?.qualityCriteria],
    ['Primeiros 30 dias', data.shared_context?.first30Days],
    ['Autonomia combinada', data.shared_context?.autonomy],
    ['Como vamos trabalhar', data.shared_context?.waysOfWorking],
  ].filter(([, value]) => value);

  return (
    <main className="page" style={{ maxWidth: 920 }}>
      <p className="eyebrow">Marco Zero · Sua preparação</p>
      <h1 className="pageTitle">{data.employee_name}</h1>
      <p className="lead">Este espaço registra a sua perspectiva antes da conversa. Não existe resposta “certa”; use fatos, expectativas e apoios que ajudem a construir acordos claros.</p>

      {query.saved && <div className="notice" style={{ marginBottom: 18 }}>Rascunho salvo. Você pode continuar e voltar por este mesmo link enquanto o Marco Zero não for concluído.</div>}
      {query.submitted && <div className="notice" style={{ marginBottom: 18 }}>Preparação enviada. Você ainda poderá revisar pelo mesmo link até o gestor concluir o Marco Zero.</div>}
      {query.error && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível salvar esta versão. Tente novamente pelo link original.</div>}
      {data.locked && <div className="notice" style={{ marginBottom: 18 }}>Este Marco Zero foi concluído e as respostas estão agora em modo somente leitura.</div>}

      {contextEntries.length > 0 && (
        <section className="card" style={{ marginBottom: 18 }}>
          <p className="eyebrow">Contexto compartilhado pelo gestor</p>
          <div className="grid grid2">
            {contextEntries.map(([label, value]) => (
              <div key={label}>
                <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{label}</strong>
                <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <form action={saveResponse} className="card">
        <input type="hidden" name="token" value={token} />
        <div className="grid" style={{ gap: 18 }}>
          {marcoZeroQuestions.map((question, index) => (
            <div className="field" key={question.key}>
              <label htmlFor={question.key}>{index + 1}. {question.label}</label>
              <textarea
                id={question.key}
                name={question.key}
                rows={4}
                defaultValue={latest[question.key] ?? ''}
                disabled={data.locked}
                placeholder="Escreva com suas palavras. Você pode salvar como rascunho antes de enviar."
              />
            </div>
          ))}
        </div>

        {!data.locked && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="button buttonSecondary" name="mode" value="draft" type="submit">Salvar rascunho</button>
            <button className="button" name="mode" value="submit" type="submit">Enviar preparação</button>
          </div>
        )}
      </form>
    </main>
  );
}
