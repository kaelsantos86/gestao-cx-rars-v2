import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getTalentRecord } from '@/lib/data/records';
import { getEligibleTalentSources, getTalentSourcesByIds } from '@/lib/data/talent';
import {
  extractTalentSignals,
  talentDeliveryFields,
  talentExecutiveFields,
  talentIndicatorFields,
  talentPurposeLabel,
  talentSourceLabel,
} from '@/lib/talent';

async function refreshSources(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('employee_id, status, payload')
    .eq('id', recordId)
    .eq('module_type', 'talent')
    .single();
  if (error) throw error;
  if (record.status === 'completed') redirect(`/records/${recordId}/talent`);

  const sources = await getEligibleTalentSources(record.employee_id);
  const sourceIds = sources.map((source) => source.id);

  const { data: existing, error: dependencyError } = await auth.supabase
    .from('record_dependencies')
    .select('source_record_id')
    .eq('target_record_id', recordId);
  if (dependencyError) throw dependencyError;

  const existingIds = new Set((existing ?? []).map((item) => item.source_record_id));
  const missing = sourceIds.filter((sourceId) => !existingIds.has(sourceId));
  if (missing.length > 0) {
    const { error: insertError } = await auth.supabase.from('record_dependencies').insert(
      missing.map((sourceId) => ({
        source_record_id: sourceId,
        target_record_id: recordId,
        relation_type: 'evidence_for',
      })),
    );
    if (insertError) throw insertError;
  }

  const payload = {
    ...((record.payload ?? {}) as Record<string, unknown>),
    sourceIds,
    sourceSnapshotAt: new Date().toISOString(),
  };

  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'talent');
  if (updateError) throw updateError;

  redirect(`/records/${recordId}/talent?refreshed=1`);
}

async function saveExecutiveView(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload, status')
    .eq('id', recordId)
    .eq('module_type', 'talent')
    .single();
  if (error) throw error;
  if (record.status === 'completed') redirect(`/records/${recordId}/talent`);

  const executive = Object.fromEntries([
    ...talentExecutiveFields,
    ...talentDeliveryFields,
    ...talentIndicatorFields,
  ].map(([key]) => [key, String(formData.get(key) ?? '').trim()]));

  if (!executive.headline || !executive.summary || !executive.strengths || !executive.managerConclusion || !executive.delivery1) {
    redirect(`/records/${recordId}/talent?executive=required`);
  }

  const payload = {
    ...((record.payload ?? {}) as Record<string, unknown>),
    executive,
    executiveSavedAt: new Date().toISOString(),
  };

  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('module_type', 'talent');
  if (updateError) throw updateError;

  redirect(`/records/${recordId}/talent?executive=saved`);
}

async function markReady(formData: FormData) {
  'use server';
  const recordId = String(formData.get('recordId') ?? '');
  const sourcesReviewed = formData.get('sourcesReviewed') === 'on';
  const authorshipConfirmed = formData.get('authorshipConfirmed') === 'on';
  const auth = await requireManager();
  if (!auth) redirect('/login');

  if (!sourcesReviewed || !authorshipConfirmed) {
    redirect(`/records/${recordId}/talent?ready=confirm`);
  }

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .select('payload, status')
    .eq('id', recordId)
    .eq('module_type', 'talent')
    .single();
  if (error) throw error;
  if (record.status === 'completed') redirect(`/records/${recordId}/talent`);

  const payload = (record.payload ?? {}) as Record<string, any>;
  if (!payload.executiveSavedAt || !payload.executive?.headline || !payload.executive?.delivery1) {
    redirect(`/records/${recordId}/talent?executive=required`);
  }

  const now = new Date().toISOString();
  const nextPayload = {
    ...payload,
    ready: true,
    readyAt: now,
    sourcesReviewed: true,
    managerAuthorshipConfirmed: true,
  };

  const { error: updateError } = await auth.supabase
    .from('module_records')
    .update({
      payload: nextPayload,
      status: 'completed',
      completed_at: now,
      updated_at: now,
    })
    .eq('id', recordId)
    .eq('module_type', 'talent');
  if (updateError) throw updateError;

  redirect(`/records/${recordId}/talent?ready=1`);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return String(value).slice(0, 10).split('-').reverse().join('/');
}

export default async function TalentManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ refreshed?: string; executive?: string; ready?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getTalentRecord(id);
  if (!record || !record.employee) notFound();

  const payload = (record.payload ?? {}) as Record<string, any>;
  const sourceIds = Array.isArray(payload.sourceIds)
    ? payload.sourceIds.map(String)
    : record.dependencies.map((item) => item.source_record_id);
  const sources = await getTalentSourcesByIds(record.employee.id, sourceIds);
  const executive = (payload.executive ?? {}) as Record<string, string>;
  const completed = record.status === 'completed';

  return (
    <main className="page">
      <Link href={`/team/${record.employee.id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>

      <section className="hero" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Talento em Evidência · Gestor</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead">{talentPurposeLabel(String(payload.purpose ?? 'executive_view'))} · {record.employee.role_title ?? 'Função não informada'}</p>
        </div>
        <span className={`badge ${completed ? 'badgeAccent' : ''}`}>{completed ? 'Pronto para apresentar' : 'Em construção'}</span>
      </section>

      {query.refreshed && <div className="notice" style={{ marginBottom: 18 }}>Fontes atualizadas. Os textos já escritos pelo gestor foram preservados.</div>}
      {query.executive === 'saved' && <div className="notice" style={{ marginBottom: 18 }}>Síntese executiva salva.</div>}
      {query.executive === 'required' && <div className="notice" style={{ marginBottom: 18 }}>Preencha a mensagem principal, síntese, fortalezas, conclusão gerencial e pelo menos uma entrega.</div>}
      {query.ready === 'confirm' && <div className="notice" style={{ marginBottom: 18 }}>Confirme a revisão das fontes e a autoria gerencial antes de finalizar.</div>}
      {query.ready === '1' && <div className="notice" style={{ marginBottom: 18 }}>Visão executiva concluída e preservada como fotografia daquele momento.</div>}

      <div className="workspaceStack">
        <details className="workspaceAccordion">
          <summary className="workspaceSummary">
            <span><strong>1. Fontes da trajetória</strong><small>Registros formais autorizados e realmente existentes.</small></span>
            <span className="badge">{sources.length} fontes</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            {sources.length === 0 ? (
              <div className="empty">Nenhuma fonte válida encontrada.</div>
            ) : (
              <div className="workspaceStack">
                {sources.map((source) => (
                  <article className="workspaceMiniCard" key={source.id}>
                    <strong>{talentSourceLabel(source.module_type)} · {source.cycle_label ?? 'Registro formal'}</strong>
                    <small className="muted" style={{ display: 'block', marginTop: 4 }}>{source.completed_at ? `Concluído em ${formatDate(source.completed_at)}` : `Status: ${source.status}`}</small>
                    {extractTalentSignals(source).slice(0, 3).map((signal, index) => (
                      <p className="muted" key={index} style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{signal}</p>
                    ))}
                  </article>
                ))}
              </div>
            )}

            {!completed && (
              <form action={refreshSources} style={{ marginTop: 14 }}>
                <input type="hidden" name="recordId" value={record.id} />
                <button className="button buttonSecondary" type="submit">Atualizar fontes</button>
              </form>
            )}
          </div>
        </details>

        <details className="workspaceAccordion" open={!completed}>
          <summary className="workspaceSummary">
            <span><strong>2. Síntese executiva</strong><small>Texto curto, factual e editável pelo gestor.</small></span>
            <span className="badge">{payload.executiveSavedAt ? 'Salva' : 'Pendente'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            <form action={saveExecutiveView} className="grid" style={{ gap: 18 }}>
              <input type="hidden" name="recordId" value={record.id} />

              <div className="grid grid2">
                {talentExecutiveFields.map(([key, label]) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <textarea id={key} name={key} rows={key === 'headline' ? 3 : 5} defaultValue={executive[key] ?? ''} disabled={completed} placeholder="Use fatos profissionais, impacto e contexto verificável." />
                  </div>
                ))}
              </div>

              <div>
                <p className="eyebrow">Até 3 entregas</p>
                <div className="grid grid3">
                  {talentDeliveryFields.map(([key, label], index) => (
                    <div className="field" key={key}>
                      <label htmlFor={key}>{label}{index > 0 && <span className="muted"> (opcional)</span>}</label>
                      <textarea id={key} name={key} rows={4} defaultValue={executive[key] ?? ''} disabled={completed} placeholder="Entrega, contribuição e efeito observado." />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow">Até 3 indicadores</p>
                <p className="muted">Registre apenas números ou evidências objetivas que já existam. Não estime valores ausentes.</p>
                <div className="grid grid3">
                  {talentIndicatorFields.map(([key, label]) => (
                    <div className="field" key={key}>
                      <label htmlFor={key}>{label} <span className="muted">(opcional)</span></label>
                      <textarea id={key} name={key} rows={4} defaultValue={executive[key] ?? ''} disabled={completed} placeholder="Ex.: indicador + resultado + período/fonte." />
                    </div>
                  ))}
                </div>
              </div>

              {!completed && <div><button className="button buttonSecondary" type="submit">Salvar síntese executiva</button></div>}
            </form>
          </div>
        </details>

        <details className="workspaceAccordion" open={completed}>
          <summary className="workspaceSummary">
            <span><strong>3. Governança e apresentação</strong><small>Revisão humana e responsabilidade pela leitura final.</small></span>
            <span className={`badge ${completed ? 'badgeAccent' : ''}`}>{completed ? 'Pronto' : 'Pendente'}</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspaceBody">
            {completed ? (
              <div className="grid grid2">
                <article className="workspaceMiniCard"><strong>Fontes revisadas</strong><p className="muted">Confirmado pelo gestor</p></article>
                <article className="workspaceMiniCard"><strong>Autoria da conclusão</strong><p className="muted">Leitura final registrada pelo gestor</p></article>
              </div>
            ) : (
              <form action={markReady} className="grid" style={{ gap: 14 }}>
                <input type="hidden" name="recordId" value={record.id} />
                <label className="confirmationRow">
                  <input type="checkbox" name="sourcesReviewed" />
                  <span><strong>Revisei as fontes utilizadas</strong><small>Confirmo que o resumo se apoia em registros profissionais existentes e adequados ao contexto.</small></span>
                </label>
                <label className="confirmationRow">
                  <input type="checkbox" name="authorshipConfirmed" />
                  <span><strong>Assumo a autoria da leitura gerencial</strong><small>A plataforma organizou evidências; a conclusão executiva foi escrita e validada por mim.</small></span>
                </label>
                <div><button className="button" type="submit">Marcar como pronto para apresentar</button></div>
              </form>
            )}
          </div>
        </details>
      </div>

      {completed && (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">Versão executiva</p>
          <h2 style={{ marginTop: 0 }}>Apresentação e PDF</h2>
          <p className="muted">Abra a versão limpa para apresentação ou impressão em PDF. Esta fotografia permanece vinculada às fontes usadas neste momento.</p>
          <Link className="button" href={`/records/${record.id}/talent/print`}>Abrir versão executiva</Link>
        </section>
      )}
    </main>
  );
}
