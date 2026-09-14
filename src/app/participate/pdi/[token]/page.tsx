import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParticipantPdi } from '@/lib/data/records';
import { pdiAxes, pdiAxisLabel, pdiParticipantFields } from '@/lib/pdi';

async function savePerspective(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const intent = String(formData.get('intent') ?? 'draft');
  const submit = intent === 'submit';

  const overview = Object.fromEntries(
    pdiParticipantFields.map(([key]) => [key, String(formData.get(key) ?? '').trim()]),
  );
  const axes = pdiAxes
    .filter((axis) => formData.get(`axis_${axis.value}`) === 'on')
    .map((axis) => axis.value);

  if (submit) {
    const required = pdiParticipantFields.filter(([key]) => key !== 'observations');
    if (required.some(([key]) => !overview[key]) || axes.length === 0) {
      redirect(`/participate/pdi/${encodeURIComponent(token)}?required=1`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_participant_response', {
    raw_token: token,
    response: { overview, axes },
    submit_response: submit,
  });
  if (error) throw error;

  redirect(`/participate/pdi/${encodeURIComponent(token)}?${submit ? 'submitted=1' : 'saved=1'}`);
}

export default async function PdiParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string; required?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const record = await getParticipantPdi(token);
  if (!record) notFound();

  const shared = (record.shared_context ?? {}) as Record<string, any>;
  const latest = (record.latest_response ?? {}) as Record<string, any>;
  const overview = (latest.overview ?? {}) as Record<string, string>;
  const axes = Array.isArray(latest.axes) ? latest.axes as string[] : [];
  const priorities = Array.isArray(shared.priorities) ? shared.priorities : [];
  const locked = Boolean(record.locked) || ['active', 'in_review', 'completed', 'archived'].includes(record.status);

  return (
    <main className="page">
      <p className="eyebrow">PDI Evolutivo · Sua perspectiva</p>
      <h1 className="pageTitle">{record.employee_name}</h1>
      <p className="lead">Antes da conversa, registre como você enxerga seu momento, sua direção profissional e as experiências que podem apoiar seu desenvolvimento.</p>

      {query.saved && <div className="notice" style={{ marginBottom: 18 }}>Rascunho salvo. Você pode voltar pelo mesmo link e continuar enquanto o PDI não for ativado.</div>}
      {query.submitted && <div className="notice" style={{ marginBottom: 18 }}>Perspectiva enviada. Ela ficará disponível ao gestor para a construção compartilhada do PDI.</div>}
      {query.required && <div className="notice" style={{ marginBottom: 18 }}>Preencha os campos principais e selecione ao menos um eixo de interesse antes de enviar.</div>}
      {locked && <div className="notice" style={{ marginBottom: 18 }}>Este PDI já foi ativado ou encerrado. Sua perspectiva original está preservada e não pode mais ser alterada.</div>}

      <details className="workspaceAccordion" open>
        <summary className="workspaceSummary">
          <span><strong>Contexto compartilhado</strong><small>Direção registrada pelo gestor antes da conversa.</small></span>
          <span className="competencyChevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="workspaceBody grid grid2">
          <div><strong>Contexto da função</strong><p className="muted">{String(shared.contextAndRole ?? '—')}</p></div>
          <div><strong>Momento atual</strong><p className="muted">{String(shared.currentMoment ?? '—')}</p></div>
          <div><strong>Fortalezas a preservar</strong><p className="muted">{String(shared.strengthsToPreserve ?? '—')}</p></div>
          <div><strong>Aspiração registrada</strong><p className="muted">{String(shared.aspiration ?? '—')}</p></div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Direção de desenvolvimento</strong><p className="muted">{String(shared.developmentDirection ?? '—')}</p></div>
        </div>
      </details>

      <details className="workspaceAccordion" style={{ marginTop: 14 }}>
        <summary className="workspaceSummary">
          <span><strong>Prioridades preparadas</strong><small>Hipóteses para a conversa, ainda ajustáveis com você.</small></span>
          <span className="badge">{priorities.length}</span>
          <span className="competencyChevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="workspaceBody grid" style={{ gap: 10 }}>
          {priorities.map((priority: any, index: number) => (
            <div className="workspaceMiniCard" key={priority.id ?? index}>
              <strong>{priority.title}</strong>
              <p className="muted" style={{ marginBottom: 4 }}>{pdiAxisLabel(String(priority.axis ?? ''))}</p>
              <small className="muted">Prática proposta: {priority.practice || '—'}</small>
            </div>
          ))}
        </div>
      </details>

      <form action={savePerspective} className="grid" style={{ gap: 18, marginTop: 18 }}>
        <input type="hidden" name="token" value={token} />

        <section className="card">
          <p className="eyebrow">1. Sua leitura</p>
          <h2>Momento, direção e desenvolvimento</h2>
          <div className="grid grid2">
            {pdiParticipantFields.map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}{key === 'observations' && <span className="muted"> (opcional)</span>}</label>
                <textarea
                  id={key}
                  name={key}
                  rows={4}
                  defaultValue={overview[key] ?? ''}
                  disabled={locked}
                  placeholder="Use fatos, exemplos e contexto profissional."
                />
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">2. Eixos de maior interesse</p>
          <h2>Onde você quer concentrar energia</h2>
          <p className="muted">Selecione os eixos que mais dialogam com seu próximo ciclo. Isso não cria prioridades automaticamente; serve para a conversa.</p>
          <div className="grid grid2">
            {pdiAxes.map((axis) => (
              <label className="checkboxRow" key={axis.value}>
                <input type="checkbox" name={`axis_${axis.value}`} defaultChecked={axes.includes(axis.value)} disabled={locked} />
                <span><strong>{axis.label}</strong><br /><small className="muted">{axis.help}</small></span>
              </label>
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
