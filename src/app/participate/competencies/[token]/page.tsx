import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParticipantCompetencies } from '@/lib/data/records';
import { competencies, competencyBands } from '@/lib/competencies';

async function saveResponse(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const mode = String(formData.get('mode') ?? 'draft');

  const competencyResponses = Object.fromEntries(
    competencies.map((competency) => [competency.key, {
      band: String(formData.get(`band_${competency.key}`) ?? ''),
      evidence: String(formData.get(`evidence_${competency.key}`) ?? '').trim(),
    }]),
  );

  const overview = {
    contributions: String(formData.get('contributions') ?? '').trim(),
    contextChallenges: String(formData.get('contextChallenges') ?? '').trim(),
    desiredDevelopment: String(formData.get('desiredDevelopment') ?? '').trim(),
    supportNeeded: String(formData.get('supportNeeded') ?? '').trim(),
    additionalNotes: String(formData.get('additionalNotes') ?? '').trim(),
  };

  if (mode === 'submit') {
    const validBands = competencies.every((competency) =>
      competencyBands.some((band) => band.value === competencyResponses[competency.key].band),
    );
    const completeEvidence = competencies.every((competency) => competencyResponses[competency.key].evidence.length > 0);
    if (!validBands || !completeEvidence || !overview.contributions || !overview.contextChallenges || !overview.desiredDevelopment || !overview.supportNeeded) {
      redirect(`/participate/competencies/${token}?incomplete=1`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_participant_response', {
    raw_token: token,
    response: { competencies: competencyResponses, overview },
    submit_response: mode === 'submit',
  });

  if (error) redirect(`/participate/competencies/${token}?error=1`);
  redirect(`/participate/competencies/${token}?${mode === 'submit' ? 'submitted=1' : 'saved=1'}`);
}

export default async function CompetencyParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string; incomplete?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const data = await getParticipantCompetencies(token);
  if (!data) notFound();

  const latest = data.latest_response ?? {};
  const latestCompetencies = (latest.competencies ?? {}) as Record<string, { band?: string; evidence?: string }>;
  const latestOverview = (latest.overview ?? {}) as Record<string, string>;

  return (
    <main className="page" style={{ maxWidth: 920 }}>
      <p className="eyebrow">Competências · Sua perspectiva</p>
      <h1 className="pageTitle">{data.employee_name}</h1>
      <p className="lead">Esta autoavaliação é uma lente para a conversa. Ela não define a nota oficial do gestor. Registre fatos, contexto e exemplos do semestre.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        A régua vai de Não atende a Supera a expectativa. Considere as oportunidades reais que você teve para demonstrar cada competência — ausência de oportunidade não significa ausência de capacidade.
      </div>
      {query.saved && <div className="notice" style={{ marginBottom: 18 }}>Rascunho salvo. Você pode continuar pelo mesmo link.</div>}
      {query.submitted && <div className="notice" style={{ marginBottom: 18 }}>Autoavaliação enviada. Ela seguirá disponível para revisão até a conclusão do ciclo pelo gestor.</div>}
      {query.incomplete && <div className="notice" style={{ marginBottom: 18 }}>Para enviar, complete as sete faixas, as evidências e os campos gerais. Rascunhos podem ficar incompletos.</div>}
      {query.error && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível salvar esta versão. Tente novamente pelo link original.</div>}
      {data.locked && <div className="notice" style={{ marginBottom: 18 }}>Este ciclo foi concluído. Sua resposta está em modo somente leitura.</div>}

      <form action={saveResponse} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="token" value={token} />

        <section className="card">
          <p className="eyebrow">1. Contexto do semestre</p>
          <div className="grid grid2">
            <div className="field">
              <label htmlFor="contributions">Principais contribuições do semestre</label>
              <textarea id="contributions" name="contributions" rows={4} disabled={data.locked} defaultValue={latestOverview.contributions ?? ''} placeholder="Descreva entregas, comportamentos ou contribuições que melhor representam seu semestre." />
            </div>
            <div className="field">
              <label htmlFor="contextChallenges">Desafios de contexto</label>
              <textarea id="contextChallenges" name="contextChallenges" rows={4} disabled={data.locked} defaultValue={latestOverview.contextChallenges ?? ''} placeholder="Registre limites de contexto, exposição, recursos ou dependências que influenciaram suas oportunidades de demonstrar competências." />
            </div>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">2. Sete competências</p>
          <h2>Faixa percebida + evidência</h2>
          <div className="grid" style={{ gap: 18 }}>
            {competencies.map((competency) => (
              <article key={competency.key} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>{competency.label}</h3>
                <p className="muted" style={{ marginTop: -4 }}><strong>{competency.tagline}</strong> {competency.help}</p>
                <div className="field">
                  <label htmlFor={`band_${competency.key}`}>Faixa percebida</label>
                  <select id={`band_${competency.key}`} name={`band_${competency.key}`} defaultValue={latestCompetencies[competency.key]?.band ?? ''} disabled={data.locked}>
                    <option value="">Selecione</option>
                    {competencyBands.map((band) => <option key={band.value} value={band.value}>{band.label}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor={`evidence_${competency.key}`}>Exemplo ou evidência</label>
                  <textarea id={`evidence_${competency.key}`} name={`evidence_${competency.key}`} rows={4} disabled={data.locked} defaultValue={latestCompetencies[competency.key]?.evidence ?? ''} placeholder="Use uma situação concreta: o que aconteceu, o que você fez e qual efeito isso gerou." />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">3. Próximo desenvolvimento</p>
          <div className="grid grid2">
            <div className="field">
              <label htmlFor="desiredDevelopment">Próximo desenvolvimento desejado</label>
              <textarea id="desiredDevelopment" name="desiredDevelopment" rows={4} disabled={data.locked} defaultValue={latestOverview.desiredDevelopment ?? ''} placeholder="Qual competência ou comportamento faria mais diferença no próximo ciclo?" />
            </div>
            <div className="field">
              <label htmlFor="supportNeeded">Apoio necessário</label>
              <textarea id="supportNeeded" name="supportNeeded" rows={4} disabled={data.locked} defaultValue={latestOverview.supportNeeded ?? ''} placeholder="Que contexto, exposição, feedback, decisão ou acompanhamento do gestor ajudaria?" />
            </div>
            <div className="field">
              <label htmlFor="additionalNotes">Observações adicionais <span className="muted">(opcional)</span></label>
              <textarea id="additionalNotes" name="additionalNotes" rows={4} disabled={data.locked} defaultValue={latestOverview.additionalNotes ?? ''} placeholder="Inclua apenas informações profissionais relevantes para a conversa." />
            </div>
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
