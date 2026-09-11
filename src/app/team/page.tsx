import Link from 'next/link';
import { getTeam } from '@/lib/data/team';

export default async function TeamPage() {
  const team = await getTeam();

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Minha Equipe</p>
          <h1 className="pageTitle">Pessoas e ciclos</h1>
          <p className="lead">Cada colaborador possui uma identidade única e uma trajetória própria. Os módulos passam a ser registros dessa timeline, e não páginas isoladas por link.</p>
        </div>
      </section>

      {team.length === 0 ? (
        <div className="card empty">Nenhum colaborador disponível para este gestor.</div>
      ) : (
        <section className="teamList">
          {team.map((person) => (
            <Link key={person.id} href={`/team/${person.id}`} className="employeeRow">
              <div className="employeeIdentity">
                <span className="avatar">{person.displayName.slice(0, 2).toUpperCase()}</span>
                <div>
                  <div className="employeeName">{person.displayName}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{person.currentRole}</div>
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Frente / squad</div>
                <div>{person.currentSquad}</div>
              </div>
              <div>
                <span className="badge badgeAccent">{person.stage}</span>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Próximo: {person.nextMilestone}</div>
              </div>
              <span className="button buttonSecondary">Abrir perfil</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
