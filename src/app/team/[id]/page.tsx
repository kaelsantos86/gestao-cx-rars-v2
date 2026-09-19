import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopySummary } from '@/components/copy-summary';
import { getEmployee, getEmployeeTimeline } from '@/lib/data/team';
import { getEligibleTalentSources } from '@/lib/data/talent';
import { getEmployeeDocuments } from '@/lib/data/documents';
import type { EmployeeSummary } from '@/lib/demo-data';

const journey = [
  { key: 'marco_zero', label: 'Marco Zero' },
  { key: 'ninety_days', label: '90 dias' },
  { key: 'pdi', label: 'PDI Evolutivo' },
  { key: 'competencies', label: 'Competências' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'talent', label: 'Talento' },
] as const;

const profileTabs = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'development', label: 'Desenvolvimento' },
  { key: 'competencies', label: 'Competências' },
  { key: 'feedbacks', label: 'Feedbacks' },
  { key: 'documents', label: 'Documentos' },
  { key: 'talent', label: 'Talento' },
] as const;

type ProfileView = (typeof profileTabs)[number]['key'];
type Timeline = Awaited<ReturnType<typeof getEmployeeTimeline>>;
type TimelineItem = Timeline[number];

function stepStatus(key: string, entryModule: string, timelineModules: Set<string>) {
  if (timelineModules.has(key)) return 'Com registro';
  if (key === 'feedback' || key === 'talent') return 'Quando aplicável';

  const core = ['marco_zero', 'ninety_days', 'pdi', 'competencies'];
  const keyIndex = core.indexOf(key);
  const entryIndex = core.indexOf(entryModule);

  if (keyIndex < entryIndex) return 'Não exigido na entrada V2';
  if (keyIndex === entryIndex) return 'Ponto de entrada';
  return 'Etapa futura';
}

function actionFor(employee: EmployeeSummary) {
  if (employee.openRecordId && employee.openRecordModule) {
    const labels = {
      marco_zero: 'Continuar Marco Zero',
      ninety_days: 'Continuar Avaliação de 90 dias',
      competencies: 'Continuar Avaliação de Competências',
      pdi: ['active', 'in_review'].includes(employee.openRecordStatus ?? '')
        ? 'Abrir PDI ativo'
        : 'Continuar PDI Evolutivo',
    };

    return {
      href: `/records/${employee.openRecordId}/${employee.openRecordModule.replace('_', '-')}`,
      label: labels[employee.openRecordModule],
    };
  }

  if (employee.nextMilestone === 'Marco Zero') {
    return { href: `/team/${employee.id}/marco-zero/new`, label: 'Iniciar Marco Zero' };
  }
  if (employee.nextMilestone === 'Avaliação de 90 dias') {
    return { href: `/team/${employee.id}/ninety-days/new`, label: 'Iniciar Avaliação de 90 dias' };
  }
  if (employee.nextMilestone === 'Competências') {
    return { href: `/team/${employee.id}/competencies/new`, label: 'Iniciar Avaliação de Competências' };
  }
  if (employee.nextMilestone === 'PDI Evolutivo') {
    return { href: `/team/${employee.id}/pdi/new`, label: 'Iniciar PDI Evolutivo' };
  }
  return null;
}

function recordHref(item: TimelineItem) {
  const routes: Record<string, string> = {
    marco_zero: 'marco-zero',
    ninety_days: 'ninety-days',
    competencies: 'competencies',
    pdi: 'pdi',
    feedback: 'feedback',
    talent: 'talent',
  };
  const route = routes[item.module];
  return route ? `/records/${item.id}/${route}` : null;
}

function recordLabel(item: TimelineItem) {
  const labels: Record<string, string> = {
    marco_zero: 'Abrir Marco Zero',
    ninety_days: 'Abrir avaliação',
    competencies: 'Abrir Competências',
    pdi: 'Abrir PDI',
    feedback: 'Abrir Feedback',
    talent: 'Abrir Talento',
  };
  return labels[item.module] ?? 'Abrir registro';
}

function TimelineList({ items, emptyText }: { items: Timeline; emptyText: string }) {
  if (items.length === 0) return <div className="card empty">{emptyText}</div>;

  return (
    <div className="timeline">
      {items.map((item) => {
        const href = recordHref(item);
        return (
          <article className="timelineItem" key={item.id}>
            <div className="timelineDate">{item.date}</div>
            <div className="timelineCard">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <span className="badge">{item.module}</span>
                  <h3 style={{ margin: '10px 0 6px' }}>{item.title}</h3>
                </div>
                <span className="badge badgeAccent">{item.status}</span>
              </div>
              <p className="muted">{item.description}</p>

              {item.officialSummary && (
                <details style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', background: 'var(--surface-soft)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Ver resumo para registro oficial</summary>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, margin: '14px 0' }}>{item.officialSummary}</div>
                  <CopySummary text={item.officialSummary} />
                </details>
              )}

              {href && <Link className="button buttonSecondary" href={href} style={{ marginTop: 12 }}>{recordLabel(item)}</Link>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="hero" style={{ marginBottom: 14 }}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 style={{ margin: 0, fontSize: 27 }}>{title}</h2>
        {description && <p className="muted" style={{ marginBottom: 0 }}>{description}</p>}
      </div>
    </div>
  );
}

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requestedView = query.view as ProfileView | undefined;
  const activeView: ProfileView = profileTabs.some((tab) => tab.key === requestedView) ? requestedView! : 'overview';

  const [employee, timeline, talentSources, documents] = await Promise.all([
    getEmployee(id),
    getEmployeeTimeline(id),
    getEligibleTalentSources(id),
    getEmployeeDocuments(id),
  ]);

  if (!employee) notFound();

  const timelineModules = new Set(timeline.map((item) => item.module));
  const action = actionFor(employee);
  const hasTalentSources = talentSources.length > 0;
  const developmentRecords = timeline.filter((item) => item.module === 'ninety_days' || item.module === 'pdi');
  const competencyRecords = timeline.filter((item) => item.module === 'competencies');
  const feedbackRecords = timeline.filter((item) => item.module === 'feedback');
  const talentRecords = timeline.filter((item) => item.module === 'talent');
  const developmentActionVisible = employee.openRecordModule === 'ninety_days'
    || employee.openRecordModule === 'pdi'
    || employee.nextMilestone === 'Avaliação de 90 dias'
    || employee.nextMilestone === 'PDI Evolutivo';
  const competencyAction = employee.openRecordModule === 'competencies' && employee.openRecordId
    ? { href: `/records/${employee.openRecordId}/competencies`, label: 'Continuar Avaliação de Competências' }
    : { href: `/team/${employee.id}/competencies/new`, label: 'Iniciar Avaliação de Competências' };

  return (
    <main className="page">
      <Link href="/team" className="muted" style={{ fontSize: 13 }}>← Voltar para Minha Equipe</Link>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="profileHeader">
          <span className="avatar profileAvatar">{employee.displayName.slice(0, 2).toUpperCase()}</span>
          <div style={{ flex: 1 }}>
            <p className="eyebrow">Perfil do colaborador</p>
            <h1 style={{ margin: 0, fontSize: 32 }}>{employee.displayName}</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>{employee.currentRole} · {employee.currentSquad}</p>
          </div>
          <span className="badge badgeAccent">{employee.stage}</span>
        </div>

        <nav className="tabs" aria-label="Áreas do perfil">
          {profileTabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/team/${employee.id}?view=${tab.key}`}
              className={activeView === tab.key ? 'active' : undefined}
              aria-current={activeView === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </section>

      {activeView === 'overview' && (
        <>
          <section className="grid grid3" style={{ marginTop: 18 }}>
            <article className="card">
              <p className="eyebrow">Momento profissional</p>
              <h2 style={{ marginBottom: 8 }}>{employee.stage}</h2>
              <p className="muted">{employee.journeyNote}</p>
            </article>
            <article className="card">
              <p className="eyebrow">Próximo movimento na V2</p>
              <h2 style={{ marginBottom: 8 }}>{employee.nextMilestone}</h2>
              <p className="muted">A plataforma respeita o ponto real da trajetória e não recria etapas anteriores apenas para completar uma sequência.</p>
            </article>
            <article className="card">
              <p className="eyebrow">Histórico centralizado</p>
              <h2 style={{ marginBottom: 8 }}>{timeline.length} registro{timeline.length === 1 ? '' : 's'}</h2>
              <p className="muted">Ciclos, feedbacks e evidências permanecem ligados à mesma identidade ao longo do tempo.</p>
            </article>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <p className="eyebrow">Próximas ações disponíveis</p>
            <h2 style={{ marginTop: 0 }}>Continue a jornada sem perder o contexto dos 90 dias</h2>
            <p className="muted">O primeiro PDI é a continuidade principal. Competências permanece disponível para o ciclo semestral e Feedback para uma situação pontual que mereça registro.</p>
            <div className="grid grid3" style={{ marginTop: 18 }}>
              <article style={{ border: '1px solid var(--accent)', borderRadius: 14, padding: 16 }}>
                <span className="badge badgeAccent">Próximo movimento</span>
                <h3 style={{ marginBottom: 8 }}>PDI Evolutivo</h3>
                <p className="muted">Transforme a avaliação concluída em prioridades e acordos de desenvolvimento.</p>
                {action && developmentActionVisible
                  ? <Link className="button" href={action.href}>{action.label}</Link>
                  : <Link className="button" href={`/team/${employee.id}/pdi/new`}>Iniciar PDI Evolutivo</Link>}
              </article>
              <article style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
                <span className="badge">Ciclo semestral</span>
                <h3 style={{ marginBottom: 8 }}>Competências</h3>
                <p className="muted">Use quando o ciclo semestral estiver aberto; o resultado poderá alimentar o PDI.</p>
                <Link className="button buttonSecondary" href={competencyAction.href}>{competencyAction.label}</Link>
              </article>
              <article style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
                <span className="badge">Quando aplicável</span>
                <h3 style={{ marginBottom: 8 }}>Feedback</h3>
                <p className="muted">Registre orientação, correção de rota, reconhecimento ou promoção quando houver um fato concreto.</p>
                <Link className="button buttonSecondary" href={`/team/${employee.id}/feedback/new`}>Registrar Feedback</Link>
              </article>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <p className="eyebrow">Jornada integrada</p>
            <h2 style={{ marginTop: 0 }}>Fluxo aplicável a este colaborador</h2>
            <div className="grid grid3">
              {journey.map((step, index) => {
                const status = step.key === employee.openRecordModule
                  ? 'Em andamento'
                  : step.key === 'talent' && !hasTalentSources
                    ? 'Sem fontes válidas'
                    : stepStatus(step.key, employee.v2EntryModule, timelineModules);

                return (
                  <div key={step.key} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className="avatar" style={{ width: 30, height: 30, borderRadius: 10, fontSize: 12 }}>{index + 1}</span>
                      <strong>{step.label}</strong>
                    </div>
                    <div style={{ marginTop: 10 }}><span className="badge">{status}</span></div>
                    {step.key === 'feedback' && (
                      <Link className="button buttonSecondary" href={`/team/${employee.id}/feedback/new`} style={{ marginTop: 12 }}>
                        Registrar Feedback
                      </Link>
                    )}
                    {step.key === 'talent' && (
                      hasTalentSources ? (
                        <Link className="button buttonSecondary" href={`/team/${employee.id}/talent/new`} style={{ marginTop: 12 }}>
                          Preparar Talento
                        </Link>
                      ) : (
                        <span className="button buttonSecondary" aria-disabled="true" title="Disponível quando existir pelo menos uma fonte formal elegível" style={{ marginTop: 12, opacity: .45, cursor: 'not-allowed', pointerEvents: 'none' }}>
                          Preparar Talento
                        </span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ marginTop: 28 }}>
            <SectionTitle eyebrow="Últimos registros" title="Trajetória recente" description="Os três registros mais recentes deste colaborador." />
            <TimelineList items={timeline.slice(0, 3)} emptyText="Ainda não há registros nesta trajetória." />
          </section>
        </>
      )}

      {activeView === 'timeline' && (
        <section style={{ marginTop: 28 }}>
          <div className="hero" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Timeline</p>
              <h2 style={{ margin: 0, fontSize: 27 }}>Trajetória profissional completa</h2>
            </div>
            {action ? (
              <Link className="button" href={action.href}>{action.label}</Link>
            ) : (
              <span className="button buttonSecondary" aria-disabled="true" style={{ opacity: .65, cursor: 'default' }}>Próximo: {employee.nextMilestone}</span>
            )}
          </div>
          <TimelineList items={timeline} emptyText="Ainda não há registros nesta trajetória. O ponto de entrada definido no perfil determina o ciclo correto." />
        </section>
      )}

      {activeView === 'development' && (
        <section style={{ marginTop: 28 }}>
          <div className="hero" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Desenvolvimento</p>
              <h2 style={{ margin: 0, fontSize: 27 }}>90 dias e PDI Evolutivo</h2>
              <p className="muted" style={{ marginBottom: 0 }}>Concentre aqui os ciclos formais de desenvolvimento, sem transformar o acompanhamento em microgestão.</p>
            </div>
            {action && developmentActionVisible && <Link className="button" href={action.href}>{action.label}</Link>}
          </div>
          <TimelineList items={developmentRecords} emptyText="Ainda não há Avaliação de 90 dias ou PDI registrado para esta trajetória." />
        </section>
      )}

      {activeView === 'competencies' && (
        <section style={{ marginTop: 28 }}>
          <div className="hero" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Competências</p>
              <h2 style={{ margin: 0, fontSize: 27 }}>Histórico semestral</h2>
              <p className="muted" style={{ marginBottom: 0 }}>As sete competências oficiais permanecem organizadas por ciclo e preservadas na timeline.</p>
            </div>
            <Link className="button" href={competencyAction.href}>{competencyAction.label}</Link>
          </div>
          <TimelineList items={competencyRecords} emptyText="Ainda não há avaliação de competências registrada para este colaborador." />
        </section>
      )}

      {activeView === 'feedbacks' && (
        <section style={{ marginTop: 28 }}>
          <div className="hero" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Feedbacks</p>
              <h2 style={{ margin: 0, fontSize: 27 }}>Registros pontuais</h2>
              <p className="muted" style={{ marginBottom: 0 }}>Use apenas quando houver uma situação que justifique registro formal de orientação, reconhecimento ou promoção.</p>
            </div>
            <Link className="button" href={`/team/${employee.id}/feedback/new`}>Registrar Feedback</Link>
          </div>
          <TimelineList items={feedbackRecords} emptyText="Nenhum feedback formal registrado. Ajustes cotidianos não precisam virar registro." />
        </section>
      )}

      {activeView === 'documents' && (
        <section style={{ marginTop: 28 }}>
          <SectionTitle eyebrow="Documentos" title="Fontes e anexos" description="Materiais vinculados à identidade do colaborador, incluindo fontes legadas quando forem migradas." />
          {documents.length === 0 ? (
            <div className="card empty">Nenhum documento ou fonte legada vinculada a este colaborador ainda.</div>
          ) : (
            <div className="grid grid2">
              {documents.map((document) => (
                <article className="card" key={`${document.source}-${document.id}`}>
                  <span className="badge">{document.source === 'legacy' ? 'Legado V1' : 'Anexo'}</span>
                  <h3 style={{ margin: '12px 0 6px', overflowWrap: 'anywhere' }}>{document.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>{document.kind} · {document.date}</p>
                  {document.visibility && <p className="muted" style={{ marginBottom: 0 }}>Visibilidade: {document.visibility}</p>}
                  {document.integrity && <p className="muted" style={{ marginBottom: 0 }}>Integridade: {document.integrity}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === 'talent' && (
        <section style={{ marginTop: 28 }}>
          <div className="hero" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">Talento em Evidência</p>
              <h2 style={{ margin: 0, fontSize: 27 }}>Visões executivas</h2>
              <p className="muted" style={{ marginBottom: 0 }}>{talentSources.length} fonte{talentSources.length === 1 ? '' : 's'} formal{talentSources.length === 1 ? '' : 'is'} elegível{talentSources.length === 1 ? '' : 'eis'} neste momento.</p>
            </div>
            {hasTalentSources ? (
              <Link className="button" href={`/team/${employee.id}/talent/new`}>Preparar Talento</Link>
            ) : (
              <span className="button" aria-disabled="true" title="Disponível quando existir pelo menos uma fonte formal elegível" style={{ opacity: .45, cursor: 'not-allowed', pointerEvents: 'none' }}>Preparar Talento</span>
            )}
          </div>
          <TimelineList items={talentRecords} emptyText="Ainda não há Talento em Evidência criado para este colaborador." />
        </section>
      )}
    </main>
  );
}
