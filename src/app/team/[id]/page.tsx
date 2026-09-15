import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEmployee, getEmployeeTimeline } from '@/lib/data/team';
import { getEligibleTalentSources } from '@/lib/data/talent';
import type { EmployeeSummary } from '@/lib/demo-data';

const journey = [
  { key: 'marco_zero', label: 'Marco Zero' },
  { key: 'ninety_days', label: '90 dias' },
  { key: 'competencies', label: 'Competências' },
  { key: 'pdi', label: 'PDI Evolutivo' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'talent', label: 'Talento' },
] as const;

function stepStatus(key: string, entryModule: string, timelineModules: Set<string>) {
  if (timelineModules.has(key)) return 'Com registro';
  if (key === 'feedback' || key === 'talent') return 'Quando aplicável';

  const core = ['marco_zero', 'ninety_days', 'competencies', 'pdi'];
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

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employee, timeline, talentSources] = await Promise.all([
    getEmployee(id),
    getEmployeeTimeline(id),
    getEligibleTalentSources(id),
  ]);

  if (!employee) notFound();

  const timelineModules = new Set(timeline.map((item) => item.module));
  const action = actionFor(employee);
  const hasTalentSources = talentSources.length > 0;

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
          {['Visão geral', 'Timeline', 'Desenvolvimento', 'Competências', 'Feedbacks', 'Documentos', 'Talento'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </nav>
      </section>

      <section className="grid grid3" style={{ marginTop: 18 }}>
        <article className="card">
          <p className="eyebrow">Momento profissional</p>
          <h2 style={{ marginBottom: 8 }}>{employee.stage}</h2>
          <p className="muted">{employee.journeyNote}</p>
        </article>
        <article className="card">
          <p className="eyebrow">Próximo movimento na V2</p>
          <h2 style={{ marginBottom: 8 }}>{employee.nextMilestone}</h2>
          <p className="muted">Módulos anteriores não são recriados artificialmente. Registros reais da V1 poderão ser migrados depois como histórico.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Identidade persistente</p>
          <h2 style={{ marginBottom: 8 }}>Histórico único</h2>
          <p className="muted">Todos os ciclos e documentos ficam ligados ao mesmo <code>employee_id</code>, preservando a trajetória ao longo do tempo.</p>
        </article>
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
                    <span
                      className="button buttonSecondary"
                      aria-disabled="true"
                      title="Disponível quando existir pelo menos uma fonte formal elegível"
                      style={{ marginTop: 12, opacity: .45, cursor: 'not-allowed', pointerEvents: 'none' }}
                    >
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
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <p className="eyebrow">Timeline</p>
            <h2 style={{ margin: 0, fontSize: 27 }}>Trajetória profissional</h2>
          </div>
          {action ? (
            <Link className="button" href={action.href}>{action.label}</Link>
          ) : (
            <span className="button buttonSecondary" aria-disabled="true" style={{ opacity: .65, cursor: 'default' }}>
              Próximo: {employee.nextMilestone}
            </span>
          )}
        </div>

        {timeline.length === 0 ? (
          <div className="card empty">Ainda não há registros nesta trajetória. Isso não significa que o colaborador deva começar pelo Marco Zero: o ponto de entrada acima define o ciclo correto, enquanto a migração da V1 preservará apenas fontes que realmente existirem.</div>
        ) : (
          <div className="timeline">
            {timeline.map((item) => (
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
                  {item.module === 'ninety_days' && (
                    <Link className="button buttonSecondary" href={`/records/${item.id}/ninety-days`} style={{ marginTop: 8 }}>Abrir avaliação</Link>
                  )}
                  {item.module === 'marco_zero' && (
                    <Link className="button buttonSecondary" href={`/records/${item.id}/marco-zero`} style={{ marginTop: 8 }}>Abrir Marco Zero</Link>
                  )}
                  {item.module === 'competencies' && (
                    <Link className="button buttonSecondary" href={`/records/${item.id}/competencies`} style={{ marginTop: 8 }}>Abrir Competências</Link>
                  )}
                  {item.module === 'pdi' && (
                    <Link className="button buttonSecondary" href={`/records/${item.id}/pdi`} style={{ marginTop: 8 }}>Abrir PDI</Link>
                  )}
                  {item.module === 'feedback' && (
                    <Link className="button buttonSecondary" href={`/records/${item.id}/feedback`} style={{ marginTop: 8 }}>Abrir Feedback</Link>
                  )}
                  {item.module === 'talent' && (
                    <Link className="button buttonSecondary" href={`/records/${item.id}/talent`} style={{ marginTop: 8 }}>Abrir Talento</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
