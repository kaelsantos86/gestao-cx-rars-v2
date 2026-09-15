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

  // Os campos antigos são preservados silenciosamente para não perder respostas de versões anteriores.
  const overview = {
    contributions: String(formData.get('legacyContributions') ?? '').trim(),
    contextChallenges: String(formData.get('legacyContextChallenges') ?? '').trim(),
    supportNeeded: String(formData.get('legacySupportNeeded') ?? '').trim(),
    desiredDevelopment: String(formData.get('desiredDevelopment') ?? '').trim(),
    additionalNotes: String(formData.get('additionalNotes') ?? '').trim(),
  };

  if (mode === 'submit') {
    const validBands = competencies.every((competency) =>
      competencyBands.some((band) => band.value === competencyResponses[competency.key].band),
    );
    const completeEvidence = competencies.every((competency) => competencyResponses[competency.key].evidence.length > 0);
    if (!validBands || !completeEvidence) {
      redirect(`/participate/competencies/${token}?incomplete=1`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_participant_response', {
    raw_token: token,
    response: { competencies: competencyResponses, overview, competencyUxVersion: 2 },
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
      <p className="eyebrow">Autoavaliação de Competências</p>
      <h1 className="pageTitle">{data.employee_name}</h1>
      <p className="lead">Avalie sua percepção sobre cada uma das sete competências do Sicredi. Sua resposta ficará separada da avaliação do gestor e será usada para comparação na conversa.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        Para cada competência, escolha a faixa que melhor representa seu semestre e registre um exemplo concreto. Não tente adivinhar a avaliação do gestor: o valor deste formulário é justamente comparar as duas leituras.
      </div>
      {query.saved && <div className="notice" style={{ marginBottom: 18 }}>Rascunho salvo. Você pode continuar pelo mesmo link.</div>}
      {query.submitted && <div className="notice" style={{ marginBottom: 18 }}>Autoavaliação enviada. Sua leitura já está disponível para comparação com o gestor.</div>}
      {query.incomplete && <div className="notice" style={{ marginBottom: 18 }}>Para enviar, avalie as sete competências e inclua um exemplo/evidência em cada uma.</div>}
      {query.error && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível salvar esta versão. Tente novamente pelo link original.</div>}
      {data.locked && <div className="notice" style={{ marginBottom: 18 }}>Este ciclo foi concluído. Sua autoavaliação está em modo somente leitura.</div>}

      <form action={saveResponse} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="legacyContributions" value={latestOverview.contributions ?? ''} />
        <input type="hidden" name="legacyContextChallenges" value={latestOverview.contextChallenges ?? ''} />
        <input type="hidden" name="legacySupportNeeded" value={latestOverview.supportNeeded ?? ''} />

        <section className="card">
          <p className="eyebrow">Sete competências</p>
          <h2>Sua leitura do semestre</h2>
          <p className="muted">A faixa é qualitativa. O gestor trabalha com a nota oficial e a plataforma fará o comparativo entre as duas perspectivas.</p>

          <div className="grid" style={{ gap: 14 }}>
            {competencies.map((competency, index) => (
              <article key={competency.key} className="workspaceMiniCard">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge">{index + 1} de 7</span>
                    <h3 style={{ margin: '10px 0 4px' }}>{competency.label}</h3>
                    <p className="muted" style={{ margin: 0 }}><strong>{competency.tagline}</strong> {competency.help}</p>
                  </div>
                </div>

                <div className="grid grid2" style={{ marginTop: 16 }}>
                  <div className="field">
                    <label htmlFor={`band_${competency.key}`}>Como você se avalia nesta competência?</label>
                    <select
                      id={`band_${competency.key}`}
                      name={`band_${competency.key}`}
                      defaultValue={latestCompetencies[competency.key]?.band ?? ''}
                      disabled={data.locked}
                      required
                    >
                      <option value="">Selecione sua faixa</option>
                      {competencyBands.map((band) => (
                        <option key={band.value} value={band.value}>{band.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`evidence_${competency.key}`}>Exemplo ou evidência do semestre</label>
                    <textarea
                      id={`evidence_${competency.key}`}
                      name={`evidence_${competency.key}`}
                      rows={4}
                      disabled={data.locked}
                      required
                      defaultValue={latestCompetencies[competency.key]?.evidence ?? ''}
                      placeholder="Conte uma situação concreta: o que aconteceu, o que você fez e qual efeito gerou."
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Fechamento opcional</p>
          <h2>Um olhar para o próximo ciclo</h2>
          <div className="grid grid2">
            <div className="field">
              <label htmlFor="desiredDevelopment">Qual competência ou comportamento você mais gostaria de desenvolver? <span className="muted">(opcional)</span></label>
              <textarea id="desiredDevelopment" name="desiredDevelopment" rows={3} disabled={data.locked} defaultValue={latestOverview.desiredDevelopment ?? ''} />
            </div>
            <div className="field">
              <label htmlFor="additionalNotes">Algo importante para a conversa? <span className="muted">(opcional)</span></label>
              <textarea id="additionalNotes" name="additionalNotes" rows={3} disabled={data.locked} defaultValue={latestOverview.additionalNotes ?? ''} />
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
