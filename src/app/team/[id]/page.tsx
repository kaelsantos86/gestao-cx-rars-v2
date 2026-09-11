import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEmployee, getEmployeeTimeline } from '@/lib/data/team';

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employee, timeline] = await Promise.all([
    getEmployee(id),
    getEmployeeTimeline(id),
  ]);

  if (!employee) notFound();

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
          <p className="eyebrow">Próximo movimento</p>
          <h2 style={{ marginBottom: 8 }}>{employee.nextMilestone}</h2>
          <p className="muted">O aplicativo usará esta referência para organizar a agenda de gestão sem transformar acompanhamento em microgestão.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Identidade persistente</p>
          <h2 style={{ marginBottom: 8 }}>Histórico único</h2>
          <p className="muted">Todos os ciclos e documentos ficam ligados ao mesmo <code>employee_id</code>, preservando a trajetória ao longo do tempo.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Módulos</p>
          <h2 style={{ marginBottom: 8 }}>6 integrados</h2>
          <p className="muted">Marco Zero, 90 dias, Competências, PDI, Feedback e Talento compartilham fontes com regras explícitas.</p>
        </article>
      </section>

      <section style={{ marginTop: 28 }}>
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <p className="eyebrow">Timeline</p>
            <h2 style={{ margin: 0, fontSize: 27 }}>Trajetória profissional</h2>
          </div>
          <Link className="button" href={`/team/${employee.id}/marco-zero/new`}>
            Novo Marco Zero
          </Link>
        </div>

        {timeline.length === 0 ? (
          <div className="card empty">Ainda não há registros nesta trajetória. A migração da V1 será feita sem substituir ou apagar as fontes antigas.</div>
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
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
