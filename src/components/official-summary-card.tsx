import { CopySummary } from '@/components/copy-summary';
import { PdfDownloadButton } from '@/components/pdf-download-button';

export function OfficialSummaryCard({
  summary,
  preparedPdf,
}: {
  summary: string | null;
  preparedPdf: { base64: string; filename: string; bytes: number } | null;
}) {
  if (!summary) return null;

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <p className="eyebrow">Resumo para registro oficial</p>
      <h2 style={{ marginTop: 0 }}>Síntese da etapa</h2>
      <p className="muted">Gerado somente com informações já registradas neste ciclo. Revise antes de copiar para a ferramenta oficial.</p>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--surface-soft)', marginBottom: 14 }}>
        {summary}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <CopySummary text={summary} />
        <PdfDownloadButton preparedPdf={preparedPdf} />
      </div>
    </section>
  );
}
