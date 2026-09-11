const cards = [
  ['Equipe', 'Acesse perfis, timeline e ciclos de desenvolvimento.'],
  ['Ações pendentes', 'Respostas recebidas, conversas e revisões próximas.'],
  ['Agenda de gestão', '90 dias, competências, PDI e retornos combinados.'],
  ['Atividade recente', 'Últimos registros e alterações da equipe.'],
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 32, fontFamily: 'Inter, system-ui' }}>
      <p style={{ margin: 0, opacity: .65 }}>GESTÃO CX RARS · V2.0</p>
      <h1 style={{ marginTop: 8 }}>Dashboard de gestão</h1>
      <p style={{ maxWidth: 760, lineHeight: 1.6 }}>
        A nova Home deixa de depender do navegador e passa a consolidar pessoas,
        registros, próximos marcos e histórico em uma única base.
      </p>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginTop: 28 }}>
        {cards.map(([title, text]) => (
          <article key={title} style={{ border: '1px solid #ddd', borderRadius: 16, padding: 20 }}>
            <h2 style={{ fontSize: 18 }}>{title}</h2>
            <p style={{ lineHeight: 1.5, opacity: .75 }}>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
