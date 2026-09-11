import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParticipantNinetyDay } from '@/lib/data/records';
import { ninetyDayDimensions, ninetyDayReflectionQuestions } from '@/lib/ninety-days';

async function saveResponse(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const mode = String(formData.get('mode') ?? 'draft');

  const ratings = Object.fromEntries(
    ninetyDayDimensions.map((dimension) => [dimension.key, Number(formData.get(`rating_${dimension.key}`) ?? 0)]),
  );
  const reflections = Object.fromEntries(
    ninetyDayReflectionQuestions.map((question) => [question.key, String(formData.get(question.key) ?? '').trim()]),
  );

  if (mode === 'submit') {
    const validRatings = Object.values(ratings).every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
    const completeReflections = ninetyDayReflectionQuestions.every((question) => reflections[question.key].length > 0);
    if (!validRatings || !completeReflections) {
      redirect(`/participate/ninety-days/${token}?incomplete=1`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_participant_response', {
    raw_token: token,
    response: { ratings, reflections },
    submit_response: mode === 'submit',
  });

  if (error) redirect(`/participate/ninety-days/${token}?error=1`);
  redirect(`/participate/ninety-days/${token}?${mode === 'submit' ? 'submitted=1' : 'saved=1'}`);
}

export default async function NinetyDayParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string; incomplete?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const data = await getParticipantNinetyDay(token);
  if (!data) notFound();

  const latest = data.latest_response ?? {};
  const latestRatings = (latest.ratings ?? {}) as Record<string, number>;
  const latestReflections = (latest.reflections ?? {}) as Record<string, string>;

  return (
    <main className="page" style={{ maxWidth: 920 }}>
      <p className="eyebrow">Avaliação de 90 dias · Sua perspectiva</p>
      <h1 className="pageTitle">{data.employee_name}</h1>
      <p className="lead">Faça sua leitura do ciclo antes da conversa com o gestor. As notas ajudam a comparar percepções; os textos trazem os fatos e o contexto que dão sentido à avaliação.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        Régua: 1 = muito abaixo do necessário hoje; 3 = adequado para o momento; 5 = acima do esperado para o ciclo. A nota considera sua etapa profissional atual.
      </div>
      {query.saved && <div className="notice" style={{ marginBottom: 18 }}>Rascunho salvo. Você pode continuar por este mesmo link.</div>}
      {query.submitted && <div className="notice" style={{ marginBottom: 18 }}>Autoavaliação enviada. Você ainda pode revisar pelo mesmo link enquanto o gestor não concluir a avaliação.</div>}
      {query.incomplete && <div className="notice" style={{ marginBottom: 18 }}>Para enviar, preencha as 5 notas e as 9 reflexões. Você pode salvar rascunhos incompletos.</div>}
      {query.error && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível salvar esta versão. Tente novamente pelo link original.</div>}
      {data.locked && <div className="notice" style={{ marginBottom: 18 }}>A avaliação foi concluída e suas respostas estão agora em modo somente leitura.</div>}

      <form action={saveResponse} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="token" value={token} />

        <section className="card">
          <p className="eyebrow">1. Autoavaliação</p>
          <h2>5 dimensões</h2>
          <div className="grid" style={{ gap: 16 }}>
            {ninetyDayDimensions.map((dimension) => (
              <div className="field" key={dimension.key}>
                <label htmlFor={`rating_${dimension.key}`}>{dimension.label}</label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{dimension.help}</div>
                <select
                  id={`rating_${dimension.key}`}
                  name={`rating_${dimension.key}`}
                  defaultValue={latestRatings[dimension.key] ? String(latestRatings[dimension.key]) : ''}
                  disabled={data.locked}
                >
                  <option value="">Selecione</option>
                  {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">2. Reflexões</p>
          <h2>9 perguntas para a conversa</h2>
          <div className="grid" style={{ gap: 18 }}>
            {ninetyDayReflectionQuestions.map((question, index) => (
              <div className="field" key={question.key}>
                <label htmlFor={question.key}>{index + 1}. {question.label}</label>
                <textarea
                  id={question.key}
                  name={question.key}
                  rows={4}
                  defaultValue={latestReflections[question.key] ?? ''}
                  disabled={data.locked}
                  placeholder="Use fatos, exemplos e contexto profissional."
                />
              </div>
            ))}
          </div>
        </section>

        {!data.locked && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="button buttonSecondary" name="mode" value="draft" type="submit">Salvar rascunho</button>
            <button className="button" name="mode" value="submit" type="submit">Enviar autoavaliação</button>
          </div>
        )}
      </form>
    </main>
  );
}
