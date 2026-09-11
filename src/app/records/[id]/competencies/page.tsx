import { createHash, randomBytes } from 'node:crypto';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyLink } from '@/components/copy-link';
import { requireManager } from '@/lib/auth';
import { getCompetencyRecord } from '@/lib/data/records';
import {
  bandLabel,
  competencies,
  competencyBands,
  competencyConsolidationFields,
  competencyMoments,
  competencyRoleProfiles,
  isScoreValidForBand,
} from '@/lib/competencies';

function normalizeScore(value: FormDataEntryValue | null) {
  return Number(String(value ?? '').replace(',', '.'));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Preparação do gestor',
    awaiting_participant: 'Autoavaliação convidada',
    participant_submitted: 'Autoavaliação recebida',
    in_conversation: 'Consolidação registrada',
    completed: 'Concluída',
  };
  return labels[status] ?? status;
}

function comparisonLabel(managerBand: string | undefined, participantBand: string | undefined) {
  if (!participantBand) return 'Sem autoavaliação';
  if (managerBand === participantBand) return 'Convergência';
  return 'Explorar na conversa';
}

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

  const { data: record } = await auth.supabase
    .from('module_records')
    .select('status')
    .eq('id', recordId)
    .eq('module_type', 'competencies')
    .single();

  if (record?.status === 'draft') {
    await auth.supabase
      .from('module_records')
      .update({ status: 'awaiting_participant', updated_at: new Date().toISOString() })
      .eq('id', recordId);
  }

  redirect(`/records/${recordId}/competencies?invite=${encodeURIComponent(rawToken)}`);
}

async function saveConsolidation(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const [{ data: record, error: recordError }, { data: submitted, error: responseError }] = await Promise.all([
    auth.supabase
      .from('module_records')
      .select('payload')
      .eq('id', recordId)
      .eq('module_type', 'competencies')
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

  const skipSelfAssessment = formData.get('skipSelfAssessment') === 'on';
  if (!submitted && !skipSelfAssessment) {
    redirect(`/records/${recordId}/competencies?selfAssessment=decision`);
  }

  const finalAssessments = Object.fromEntries(
    competencies.map((competency) => {
      const band = String(formData.get(`final_${competency.key}_band`) ?? '');
      const score = normalizeScore(formData.get(`final_${competency.key}_score`));
      const evidence = String(formData.get(`final_${competency.key}_evidence`) ?? '').trim();
      const officialComment = String(formData.get(`final_${competency.key}_officialComment`) ?? '').trim();
      const nextStep = String(formData.get(`final_${competency.key}_nextStep`) ?? '').trim();
      if (!isScoreValidForBand(score, band) || !evidence || !officialComment) {
        throw new Error(`invalid_final_assessment_${competency.key}`);
      }
      return [competency.key, { band, score, evidence, officialComment, nextStep }];
    }),
  );

  const consolidation = Object.fromEntries(
    competencyConsolidationFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );
  const returnDate = String(formData.get('returnDate') ?? '');
  if (Object.values(consolidation).some((value) => !value) || !returnDate) {
    redirect(`/records/${recordId}/competencies?consolidation=required`);
  }

  const payload = {
    ...((record.payload ?? {}) as Record<string, unknown>),
    finalAssessments,
    ...consolidation,
    returnDate,
    selfAssessmentUsed: Boolean(submitted),
    selfAssessmentSkipped: !submitted,
    consolidationSavedAt: new Date().toISOString(),
  };

  const { error } = await auth.supabase
    .from('module_records')
    .update({ payload, status: 'in_conversation', updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'competencies');
  if (error) throw error;

  redirect(`/records/${recordId}/competencies?consolidation=saved`);
}

async function concludeCompetencies(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload')
    .eq('id', recordId)
    .eq('module_type', 'competencies')
    .single();
  if (error) throw error;

  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const finalAssessments = (payload.finalAssessments ?? {}) as Record<string, unknown>;
  if (!payload.consolidationSavedAt || competencies.some((competency) => !finalAssessments[competency.key])) {
    redirect(`/records/${recordId}/competencies?consolidation=required`);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({ status: 'completed', participant_locked_at: now, completed_at: now, updated_at: now })
    .eq('id', recordId)
    .eq('module_type', 'competencies');
  if (updateError) throw updateError;

  redirect(`/records/${recordId}/competencies?completed=1`);
}

export default async function CompetencyManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; completed?: string; consolidation?: string; selfAssessment?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getCompetencyRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const initialAssessments = (payload.initialAssessments ?? {}) as Record<string, any>;
  const finalAssessments = (payload.finalAssessments ?? initialAssessments) as Record<string, any>;
  const response = (record.latestResponse?.response_payload ?? {}) as Record<string, any>;
  const participantCompetencies = (response.competencies ?? {}) as Record<string, { band?: string; evidence?: string }>;
  const participantOverview = (response.overview ?? {}) as Record<string, string>;
  const participantSubmitted = Boolean(record.latestResponse?.is_submitted);
  const participantPath = query.invite ? `/participate/competencies/${query.invite}` : null;
  const completed = record.status === 'completed';
  const consolidationReady = Boolean(payload.consolidationSavedAt) && !completed;
  const roleLabel = competencyRoleProfiles.find((item) => item.value === payload.roleProfile)?.label ?? payload.roleProfile;
  const momentLabel = competencyMoments.find((item) => item.value === payload.momentInRole)?.label ?? payload.momentInRole;

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Competências · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{record.cycle_label} · {roleLabel} · {momentLabel}</p>
        </div>
        <span className="badge badgeAccent">{statusLabel(record.status)}</span>
      </section>

      {query.completed && <div className="notice" style={{ marginBottom: 18 }}>Avaliação concluída. O registro está bloqueado para novas edições do colaborador e pode alimentar o PDI.</div>}
      {query.consolidation === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Consolidação, notas finais e acordos salvos.</div>}
      {query.consolidation === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Complete as sete avaliações finais, a síntese e a data de retorno antes de concluir.</div>}
      {query.selfAssessment === 'decision' && <div className="notice" style={{ marginBottom: 18 }}>A autoavaliação é opcional. Se não será usada neste ciclo, confirme explicitamente essa decisão antes de consolidar.</div>}

      <section className="grid grid3">
        <article className="card">
          <p className="eyebrow">Contexto</p>
          <h2>Semestre</h2>
          <p className="muted">{String(payload.semesterContext ?? '—')}</p>
        </article>
        <article className="card">
          <p className="eyebrow">Oportunidades reais</p>
          <h2>Demonstração</h2>
          <p className="muted">{String(payload.demonstrationOpportunities ?? '—')}</p>
        </article>
        <article className="card">
          <p className="eyebrow">Acordos anteriores</p>
          <h2>Referências</h2>
          <p className="muted">{String(payload.priorAgreements ?? '—')}</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Comparação</p>
        <h2>Sete competências · gestor x colaborador</h2>
        <p className="muted">A autoavaliação é opcional e funciona como lente. A nota oficial continua sendo responsabilidade do gestor, ajustada somente quando a conversa trouxer fatos ou contexto relevantes.</p>
        <div className="grid" style={{ gap: 12 }}>
          {competencies.map((competency) => {
            const manager = initialAssessments[competency.key] ?? {};
            const participant = participantCompetencies[competency.key] ?? {};
            return (
              <article key={competency.key} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div><strong>{competency.label}</strong><div className="muted" style={{ fontSize: 13 }}>{competency.help}</div></div>
                  <span className="badge">{comparisonLabel(manager.band, participant.band)}</span>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                  <span><strong>Gestor:</strong> {bandLabel(manager.band)} · {typeof manager.score === 'number' ? manager.score.toFixed(2) : '—'}</span>
                  <span><strong>Colaborador:</strong> {participantSubmitted ? bandLabel(participant.band) : 'Autoavaliação não recebida'}</span>
                </div>
                {participantSubmitted && participant.evidence && <p className="muted" style={{ marginBottom: 0 }}><strong>Evidência trazida pela pessoa:</strong> {participant.evidence}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid grid2" style={{ marginTop: 18 }}>
        <article className="card">
          <p className="eyebrow">Leitura inicial do gestor</p>
          <h2>Evidências e comentários</h2>
          <div className="grid" style={{ gap: 14 }}>
            {competencies.map((competency) => {
              const assessment = initialAssessments[competency.key] ?? {};
              return (
                <div key={competency.key}>
                  <strong>{competency.label} · {bandLabel(assessment.band)} · {typeof assessment.score === 'number' ? assessment.score.toFixed(2) : '—'}</strong>
                  <div className="muted"><strong>Evidência:</strong> {assessment.evidence || '—'}</div>
                  <div className="muted"><strong>Comentário +Evolução:</strong> {assessment.officialComment || '—'}</div>
                  {assessment.nextStep && <div className="muted"><strong>Próximo passo:</strong> {assessment.nextStep}</div>}
                </div>
              );
            })}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Autoavaliação opcional</p>
          <h2>{participantSubmitted ? 'Perspectiva recebida' : 'Ainda não enviada'}</h2>
          {participantSubmitted ? (
            <div className="grid" style={{ gap: 14 }}>
              <div><strong>Principais contribuições</strong><div className="muted">{participantOverview.contributions || '—'}</div></div>
              <div><strong>Desafios de contexto</strong><div className="muted">{participantOverview.contextChallenges || '—'}</div></div>
              <div><strong>Desenvolvimento desejado</strong><div className="muted">{participantOverview.desiredDevelopment || '—'}</div></div>
              <div><strong>Apoio necessário</strong><div className="muted">{participantOverview.supportNeeded || '—'}</div></div>
              {participantOverview.additionalNotes && <div><strong>Observações adicionais</strong><div className="muted">{participantOverview.additionalNotes}</div></div>}
            </div>
          ) : <p className="muted">A avaliação pode ser consolidada sem autoavaliação, desde que essa decisão seja confirmada explicitamente no bloco de consolidação.</p>}
        </article>
      </section>

      {!completed && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">Link seguro · opcional</p>
          <h2>Convidar para autoavaliação</h2>
          <p className="muted">O novo link revoga links anteriores e expira em 14 dias. A pessoa pode salvar rascunhos e revisar a própria perspectiva até a conclusão.</p>
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
        <p className="eyebrow">Conversa e consolidação</p>
        <h2>Notas finais, comentários e ponte para o PDI</h2>
        <form action={saveConsolidation} className="grid" style={{ gap: 18 }}>
          <input type="hidden" name="recordId" value={record.id} />
          <fieldset disabled={completed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: completed ? .62 : 1 }}>
            {!participantSubmitted && !completed && (
              <label className="confirmationRow" style={{ marginBottom: 18 }}>
                <input type="checkbox" name="skipSelfAssessment" />
                <span><strong>Consolidar sem autoavaliação neste ciclo.</strong><small>A participação é opcional; esta confirmação evita que uma resposta pendente seja ignorada por engano.</small></span>
              </label>
            )}

            <div className="grid" style={{ gap: 18 }}>
              {competencies.map((competency) => {
                const assessment = finalAssessments[competency.key] ?? initialAssessments[competency.key] ?? {};
                return (
                  <article key={competency.key} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
                    <h3 style={{ marginTop: 0 }}>{competency.label}</h3>
                    <div className="grid grid2">
                      <div className="field">
                        <label htmlFor={`final_${competency.key}_band`}>Faixa final</label>
                        <select id={`final_${competency.key}_band`} name={`final_${competency.key}_band`} defaultValue={assessment.band ?? ''} required>
                          {competencyBands.map((band) => <option key={band.value} value={band.value}>{band.label} · {band.min.toFixed(2)}–{band.max.toFixed(2)}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`final_${competency.key}_score`}>Nota final</label>
                        <input id={`final_${competency.key}_score`} name={`final_${competency.key}_score`} type="number" min="0" max="1.2" step="0.01" inputMode="decimal" defaultValue={assessment.score ?? ''} required />
                      </div>
                      <div className="field">
                        <label htmlFor={`final_${competency.key}_evidence`}>Evidências observáveis</label>
                        <textarea id={`final_${competency.key}_evidence`} name={`final_${competency.key}_evidence`} rows={4} defaultValue={assessment.evidence ?? ''} required />
                      </div>
                      <div className="field">
                        <label htmlFor={`final_${competency.key}_officialComment`}>Comentário para o +Evolução</label>
                        <textarea id={`final_${competency.key}_officialComment`} name={`final_${competency.key}_officialComment`} rows={4} defaultValue={assessment.officialComment ?? ''} required />
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor={`final_${competency.key}_nextStep`}>Próximo passo ou acordo <span className="muted">(opcional)</span></label>
                      <textarea id={`final_${competency.key}_nextStep`} name={`final_${competency.key}_nextStep`} rows={3} defaultValue={assessment.nextStep ?? ''} />
                    </div>
                  </article>
                );
              })}

              <div className="grid grid2">
                {competencyConsolidationFields.map(([key, label]) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <textarea id={key} name={key} rows={4} defaultValue={String(payload[key] ?? '')} required />
                  </div>
                ))}
                <div className="field">
                  <label htmlFor="returnDate">Data de retorno</label>
                  <input id="returnDate" name="returnDate" type="date" defaultValue={String(payload.returnDate ?? '')} required />
                </div>
              </div>
              {!completed && <div><button className="button buttonSecondary" type="submit">Salvar consolidação</button></div>}
            </div>
          </fieldset>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Fechamento</p>
        <h2>Concluir Avaliação de Competências</h2>
        <p className="muted">A conclusão bloqueia novas edições da pessoa, revoga links públicos e transforma esta avaliação em fonte válida para o PDI. O registro oficial das competências continua no +Evolução.</p>
        {completed ? (
          <span className="badge badgeAccent">Avaliação concluída</span>
        ) : (
          <form action={concludeCompetencies}>
            <input type="hidden" name="recordId" value={record.id} />
            <button className="button" type="submit" disabled={!consolidationReady}>{consolidationReady ? 'Concluir Avaliação de Competências' : 'Aguardando consolidação'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
