export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 32, fontFamily: 'Inter, system-ui' }}>
      <p style={{ margin: 0, opacity: .65 }}>PERFIL DO COLABORADOR</p>
      <h1>Colaborador</h1>
      <p>ID persistente: <code>{id}</code></p>
      <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24 }}>
        {['Visão geral', 'Timeline', 'Desenvolvimento', 'Competências', 'Feedbacks', 'Documentos', 'Talento'].map((item) => (
          <span key={item} style={{ border: '1px solid #ddd', borderRadius: 999, padding: '8px 12px' }}>{item}</span>
        ))}
      </nav>
    </main>
  );
}
