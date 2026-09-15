import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PrintButton } from '@/components/print-button';
import { getTalentRecord } from '@/lib/data/records';
import { getTalentSourcesByIds } from '@/lib/data/talent';
import { talentPurposeLabel, talentSourceLabel } from '@/lib/talent';

export default async function TalentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getTalentRecord(id);
  if (!record || !record.employee) notFound();
  if (record.status !== 'completed') redirect(`/records/${id}/talent`);

  const payload = (record.payload ?? {}) as Record<string, any>;
  const executive = (payload.executive ?? {}) as Record<string, string>;
  const sourceIds = Array.isArray(payload.sourceIds)
    ? payload.sourceIds.map(String)
    : record.dependencies.map((item) => item.source_record_id);
  const sources = await getTalentSourcesByIds(record.employee.id, sourceIds);
  const deliveries = [executive.delivery1, executive.delivery2, executive.delivery3].filter(Boolean);
  const indicators = [executive.indicator1, executive.indicator2, executive.indicator3].filter(Boolean);

  return (
    <main className="page talentPrintPage">
      <style>{`
        .talentPrintPage { max-width: 900px; }
        .talentPrintHeader { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; margin-bottom:28px; }
        .talentPrintSection { margin-top:24px; padding-top:20px; border-top:1px solid var(--line); }
        .talentPrintList { margin:10px 0 0; padding-left:22px; display:grid; gap:8px; }
        .talentPrintSources { display:flex; flex-wrap:wrap; gap:8px; }
        @media print {
          .topbar, .printActions { display:none !important; }
          html, body { background:#fff !important; }
          .page { padding:0 !important; max-width:none !important; }
          .talentPrintPage { color:#111; }
          .talentPrintSection { break-inside:avoid; }
        }
      `}</style>

      <div className="printActions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <Link className="button buttonSecondary" href={`/records/${record.id}/talent`}>← Voltar</Link>
        <PrintButton />
      </div>

      <header className="talentPrintHeader">
        <div>
          <p className="eyebrow">Gestão CX RARS · Talento em Evidência</p>
          <h1 className="pageTitle">{record.employee.display_name}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>{record.employee.role_title ?? 'Função não informada'} · {record.employee.current_squad ?? 'Frente não informada'}</p>
        </div>
        <span className="badge badgeAccent">{talentPurposeLabel(String(payload.purpose ?? 'executive_view'))}</span>
      </header>

      <section className="talentPrintSection">
        <p className="eyebrow">Mensagem principal</p>
        <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>{executive.headline}</h2>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{executive.summary}</p>
      </section>

      <section className="talentPrintSection">
        <p className="eyebrow">Entregas e contribuições</p>
        <ul className="talentPrintList">
          {deliveries.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </section>

      {indicators.length > 0 && (
        <section className="talentPrintSection">
          <p className="eyebrow">Indicadores e evidências objetivas</p>
          <ul className="talentPrintList">
            {indicators.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </section>
      )}

      <section className="talentPrintSection">
        <p className="eyebrow">Fortalezas e competências</p>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{executive.strengths}</p>
      </section>

      <section className="talentPrintSection">
        <p className="eyebrow">Conclusão gerencial</p>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{executive.managerConclusion}</p>
      </section>

      <section className="talentPrintSection">
        <p className="eyebrow">Fontes formais utilizadas</p>
        <div className="talentPrintSources">
          {sources.map((source) => (
            <span className="badge" key={source.id}>{talentSourceLabel(source.module_type)} · {source.cycle_label ?? 'Registro formal'}</span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Documento gerencial descritivo. A plataforma organiza fontes e evidências; a leitura final é de autoria do gestor.
        </p>
      </section>
    </main>
  );
}
