import { CopySummary } from '@/components/copy-summary';

export function OfficialSummaryCard({ summary }: { summary: string | null }) {
  if (!summary) return null;

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <p className="eyebrow">Resumo para registro oficial</p>
      <h2 style={{ marginTop: 0 }}>Síntese da etapa</h2>
      <p className="muted">Gerado somente com informações já registradas neste ciclo. Revise antes de copiar para a ferramenta oficial.</p>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--surface-soft)', marginBottom: 14 }}>
        {summary}
      </div>
      <CopySummary text={summary} />
    </section>
  );
}
