import Link from 'next/link';
import { hasSupabaseEnv } from '@/lib/env';
import { getTeam } from '@/lib/data/team';

export default async function HomePage() {
  const team = await getTeam();
  const connected = hasSupabaseEnv();
  const entry = team.filter((person) => person.stage === 'Entrada').length;
  const consolidation = team.filter((person) => person.stage === 'Consolidação').length;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Gestão CX RARS · V2.0</p>
          <h1 className="pageTitle">Painel de gestão</h1>
          <p className="lead">Uma visão única da equipe, dos ciclos de desenvolvimento e dos próximos marcos — preservando histórico, autoria e a relação entre os seis módulos.</p>
        </div>
        <Link className="button" href="/team">Abrir minha equipe</Link>
      </section>

      {!connected && (
        <div className="notice" style={{ marginBottom: 20 }}>
          Modo demonstração ativo. A interface está operacional com dados locais seguros; o banco real será ativado quando o projeto Supabase for conectado.
        </div>
      )}

      <section className="grid grid4" aria-label="Resumo da equipe">
        <article className="card"><div className="metric">{team.length}</div><div className="muted">Pessoas na equipe</div></article>
        <article className="card"><div className="metric">{entry}</div><div className="muted">Em etapa de entrada</div></article>
        <article className="card"><div className="metric">{consolidation}</div><div className="muted">Em consolidação</div></article>
        <article className="card"><div className="metric">6</div><div className="muted">Módulos integrados</div></article>
      </section>

      <section className="grid grid2" style={{ marginTop: 20 }}>
        <article className="card">
          <p className="eyebrow">Próximos movimentos</p>
          <h2>Agenda de desenvolvimento</h2>
          <div className="teamList">
            {team.slice(-4).reverse().map((person) => (
              <Link key={person.id} href={`/team/${person.id}`} className="employeeIdentity" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="avatar">{person.displayName.slice(0, 2).toUpperCase()}</span>
                <span style={{ flex: 1 }}>
                  <span className="employeeName" style={{ display: 'block' }}>{person.displayName}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{person.nextMilestone}</span>
                </span>
                <span className="badge badgeAccent">{person.stage}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Arquitetura V2</p>
          <h2>Jornada integrada</h2>
          <div className="grid" style={{ gap: 10 }}>
            {['Marco Zero', '90 dias', 'Competências', 'PDI Evolutivo', 'Feedback', 'Talento em Evidência'].map((module, index) => (
              <div key={module} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="avatar" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12 }}>{index + 1}</span>
                <span>{module}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
