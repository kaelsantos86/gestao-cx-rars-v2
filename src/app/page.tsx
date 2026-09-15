import Link from 'next/link';
import { hasSupabaseEnv } from '@/lib/env';
import { getTeam } from '@/lib/data/team';

const stageOrder = ['Entrada', 'Consolidação', 'Estabilizado', 'Transição'] as const;
const milestoneOrder = ['Marco Zero', 'Avaliação de 90 dias', 'Competências', 'PDI Evolutivo', 'PDI ativo'] as const;

const moduleFlow = [
  ['01', 'Marco Zero'],
  ['02', '90 dias'],
  ['03', 'Competências'],
  ['04', 'PDI'],
  ['05', 'Feedback'],
  ['06', 'Talento'],
] as const;

export default async function HomePage() {
  const team = await getTeam();
  const connected = hasSupabaseEnv();

  const openCycles = team.filter((person) => person.openRecordId);
  const awaitingParticipant = openCycles.filter((person) => person.openRecordStatus === 'awaiting_participant');
  const activePdis = openCycles.filter(
    (person) => person.openRecordModule === 'pdi' && ['active', 'in_review'].includes(person.openRecordStatus ?? ''),
  );
  const readyForConversation = openCycles.filter((person) => ['participant_submitted', 'in_conversation'].includes(person.openRecordStatus ?? ''));

  const stageCounts = stageOrder.map((stage) => ({
    stage,
    count: team.filter((person) => person.stage === stage).length,
  }));

  const milestoneGroups = milestoneOrder
    .map((milestone) => ({
      milestone,
      people: team.filter((person) => person.nextMilestone === milestone),
    }))
    .filter((group) => group.people.length > 0);

  const focusPeople = openCycles.length > 0
    ? openCycles.slice(0, 5)
    : team.slice(0, 5);

  return (
    <main className="page dashboardPage">
      <section className="dashboardHero">
        <div className="dashboardHeroContent">
          <p className="dashboardEyebrow">Gestão CX RARS · V2.0</p>
          <h1>Visão da equipe</h1>
          <p>
            Acompanhe prioridades, ciclos e próximos movimentos em um único painel — com foco no que realmente pede sua atenção agora.
          </p>
          <div className="dashboardHeroActions">
            <Link className="dashboardPrimaryAction" href="/team">Abrir minha equipe</Link>
            <span className="dashboardLiveBadge">
              <span className="dashboardLiveDot" />
              {connected ? 'Base conectada' : 'Modo demonstração'}
            </span>
          </div>
        </div>

        <div className="dashboardNowCard" aria-label="Resumo imediato">
          <span className="dashboardNowLabel">Agora</span>
          <strong>{openCycles.length}</strong>
          <span>ciclo{openCycles.length === 1 ? '' : 's'} em andamento</span>
          <div className="dashboardNowDivider" />
          <div className="dashboardNowLine">
            <span>Aguardando colaborador</span>
            <b>{awaitingParticipant.length}</b>
          </div>
          <div className="dashboardNowLine">
            <span>Prontos para conversa</span>
            <b>{readyForConversation.length}</b>
          </div>
        </div>
      </section>

      {!connected && (
        <div className="notice" style={{ marginBottom: 20 }}>
          Modo demonstração ativo. O painel usa dados locais até o Supabase ser conectado.
        </div>
      )}

      <section className="dashboardMetrics" aria-label="Indicadores principais">
        <article className="dashboardMetricCard">
          <span className="dashboardMetricLabel">Equipe</span>
          <div className="dashboardMetricValue">{team.length}</div>
          <p>Pessoas ativas</p>
        </article>
        <article className="dashboardMetricCard">
          <span className="dashboardMetricLabel">Em andamento</span>
          <div className="dashboardMetricValue">{openCycles.length}</div>
          <p>Ciclos abertos</p>
        </article>
        <article className="dashboardMetricCard">
          <span className="dashboardMetricLabel">Retorno</span>
          <div className="dashboardMetricValue">{awaitingParticipant.length}</div>
          <p>Aguardando colaborador</p>
        </article>
        <article className="dashboardMetricCard dashboardMetricAccent">
          <span className="dashboardMetricLabel">Desenvolvimento</span>
          <div className="dashboardMetricValue">{activePdis.length}</div>
          <p>PDIs ativos</p>
        </article>
      </section>

      <section className="dashboardMainGrid">
        <article className="dashboardPanel dashboardPriorityPanel">
          <div className="dashboardPanelHeader">
            <div>
              <p className="eyebrow">Foco de gestão</p>
              <h2>{openCycles.length > 0 ? 'O que pede atenção' : 'Próximos movimentos'}</h2>
            </div>
            <Link href="/team" className="dashboardTextLink">Ver equipe →</Link>
          </div>

          <div className="dashboardPeopleList">
            {focusPeople.map((person) => (
              <Link key={person.id} href={`/team/${person.id}`} className="dashboardPersonRow">
                <span className="avatar dashboardAvatar">{person.displayName.slice(0, 2).toUpperCase()}</span>
                <span className="dashboardPersonMain">
                  <strong>{person.displayName}</strong>
                  <span>{person.openRecordId ? person.nextMilestone : `Próximo: ${person.nextMilestone}`}</span>
                </span>
                <span className="dashboardPersonStage">{person.stage}</span>
              </Link>
            ))}
          </div>

          {team.length > focusPeople.length && (
            <Link href="/team" className="dashboardListFooter">+ {team.length - focusPeople.length} pessoa{team.length - focusPeople.length === 1 ? '' : 's'} na equipe</Link>
          )}
        </article>

        <article className="dashboardPanel">
          <div className="dashboardPanelHeader">
            <div>
              <p className="eyebrow">Mapa da equipe</p>
              <h2>Momento profissional</h2>
            </div>
            <span className="dashboardPanelTotal">{team.length}</span>
          </div>

          <div className="dashboardStageList">
            {stageCounts.map(({ stage, count }) => {
              const percent = team.length > 0 ? Math.round((count / team.length) * 100) : 0;
              return (
                <div className="dashboardStageRow" key={stage}>
                  <div className="dashboardStageTopline">
                    <span>{stage}</span>
                    <b>{count}</b>
                  </div>
                  <div className="dashboardStageTrack" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="dashboardPanel dashboardMilestonesPanel">
        <div className="dashboardPanelHeader">
          <div>
            <p className="eyebrow">Agenda de desenvolvimento</p>
            <h2>Próximo movimento por pessoa</h2>
          </div>
          <span className="dashboardPanelHint">Visão por etapa</span>
        </div>

        <div className="dashboardMilestoneGrid">
          {milestoneGroups.map((group) => (
            <div className="dashboardMilestoneCard" key={group.milestone}>
              <div className="dashboardMilestoneTop">
                <span>{group.milestone}</span>
                <b>{group.people.length}</b>
              </div>
              <div className="dashboardMilestonePeople">
                {group.people.map((person) => (
                  <Link key={person.id} href={`/team/${person.id}`} title={person.displayName}>
                    <span className="dashboardMiniAvatar">{person.displayName.slice(0, 2).toUpperCase()}</span>
                    <span>{person.displayName}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboardFlowSection">
        <div>
          <p className="eyebrow">Jornada integrada</p>
          <h2>Seis módulos, uma trajetória</h2>
          <p className="muted">A Home mostra o momento atual. O detalhe e o histórico permanecem no perfil de cada colaborador.</p>
        </div>
        <div className="dashboardFlow">
          {moduleFlow.map(([number, label]) => (
            <div className="dashboardFlowStep" key={number}>
              <span>{number}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
