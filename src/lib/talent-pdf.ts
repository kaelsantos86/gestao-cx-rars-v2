import PDFDocument from 'pdfkit';
import { talentPurposeLabel, type TalentSourceSnapshot } from '@/lib/talent';

export type TalentPdfInput = {
  employee: {
    display_name: string;
    role_title?: string | null;
    current_squad?: string | null;
  };
  record: {
    cycle_label?: string | null;
    completed_at?: string | null;
    occurred_on?: string | null;
    payload?: unknown;
  };
};

const accent = '#146B45';
const ink = '#18211B';
const muted = '#657069';
const line = '#DCE5DF';
const margin = 45;
const contentWidth = 505;

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDate(value: unknown) {
  if (!value || typeof value !== 'string') return '';
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : '';
}

function section(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > 720) doc.addPage();
  doc.moveDown(0.65);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(accent)
    .text(title.toUpperCase(), margin, doc.y, { width: contentWidth, characterSpacing: 0.7 });
  doc.moveDown(0.4);
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  if (!text) return;
  doc.font('Helvetica').fontSize(10.5).fillColor(ink)
    .text(text.replace(/\r\n/g, '\n'), margin, doc.y, {
      width: contentWidth,
      lineGap: 4,
      paragraphGap: 7,
    });
  doc.moveDown(0.3);
}

function numberedItems(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item, index) => {
    if (doc.y > 760) doc.addPage();
    const currentY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(accent)
      .text(String(index + 1).padStart(2, '0'), margin, currentY, { width: 30, lineBreak: false });
    doc.font('Helvetica').fontSize(10.5).fillColor(ink)
      .text(item, margin + 34, currentY, {
        width: contentWidth - 34,
        lineGap: 4,
        paragraphGap: 6,
      });
    doc.moveDown(0.4);
  });
}

export async function createTalentPdf(input: TalentPdfInput): Promise<Buffer> {
  const payload = (input.record.payload ?? {}) as Record<string, any>;
  const executive = (payload.executive ?? {}) as Record<string, unknown>;
  const sources = Array.isArray(payload.sourceSnapshot)
    ? payload.sourceSnapshot as TalentSourceSnapshot[]
    : [];
  const deliveries = [executive.delivery1, executive.delivery2, executive.delivery3]
    .map(clean).filter(Boolean);
  const indicators = [executive.indicator1, executive.indicator2, executive.indicator3]
    .map(clean).filter(Boolean);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 45, right: margin, bottom: 57, left: margin },
    bufferPages: true,
    info: { Title: 'Talento em Evidência - ' + input.employee.display_name, Creator: 'Gestão CX RARS' },
  });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.rect(0, 0, 595.28, 126).fill(accent);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#D6F0E2')
    .text('GESTÃO CX RARS', margin, 30, { characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(23).fillColor('#FFFFFF')
    .text('Talento em Evidência', margin, 53, { width: contentWidth });
  doc.font('Helvetica').fontSize(10).fillColor('#D6F0E2')
    .text(talentPurposeLabel(clean(payload.purpose) || 'executive_view'), margin, 91);
  doc.y = 151;

  doc.font('Helvetica-Bold').fontSize(20).fillColor(ink)
    .text(input.employee.display_name, margin, doc.y, { width: contentWidth });
  const role = [clean(input.employee.role_title), clean(input.employee.current_squad)]
    .filter(Boolean).join(' · ');
  if (role) {
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor(muted).text(role, margin, doc.y, { width: contentWidth });
  }
  const date = formatDate(input.record.completed_at ?? input.record.occurred_on);
  if (date) {
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(muted).text('Apresentação concluída em ' + date);
  }

  const headline = clean(executive.headline);
  if (headline) {
    section(doc, 'Mensagem principal');
    doc.font('Helvetica-Bold').fontSize(16);
    const height = doc.heightOfString(headline, { width: contentWidth - 26, lineGap: 3 }) + 28;
    if (doc.y + height > 785) doc.addPage();
    const y = doc.y;
    doc.roundedRect(margin, y, contentWidth, height, 10).fill('#EEF7F2');
    doc.font('Helvetica-Bold').fontSize(16).fillColor(ink)
      .text(headline, margin + 13, y + 13, { width: contentWidth - 26, lineGap: 3 });
    doc.y = y + height + 7;
  }

  const summary = clean(executive.summary);
  if (summary) {
    section(doc, 'Síntese executiva');
    paragraph(doc, summary);
  }
  if (deliveries.length) {
    section(doc, 'Entregas e contribuições');
    numberedItems(doc, deliveries);
  }
  if (indicators.length) {
    section(doc, 'Indicadores e evidências objetivas');
    numberedItems(doc, indicators);
  }
  const strengths = clean(executive.strengths);
  if (strengths) {
    section(doc, 'Fortalezas e competências');
    paragraph(doc, strengths);
  }
  const conclusion = clean(executive.managerConclusion);
  if (conclusion) {
    section(doc, 'Conclusão gerencial');
    paragraph(doc, conclusion);
  }
  if (sources.length) {
    section(doc, 'Fontes formais utilizadas');
    sources.forEach((source) => {
      const sourceLabel = [clean(source.moduleLabel), clean(source.cycleLabel)].filter(Boolean).join(' · ');
      if (sourceLabel) {
        doc.font('Helvetica').fontSize(8.7).fillColor(muted)
          .text('• ' + sourceLabel, margin, doc.y, { width: contentWidth, lineGap: 3 });
        doc.moveDown(0.2);
      }
    });
  }
  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(8.5).fillColor(muted)
    .text('Documento gerencial descritivo. A leitura e a conclusão são de autoria do gestor.', margin, doc.y, {
      width: contentWidth,
      lineGap: 3,
    });

  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(margin, 796).lineTo(595.28 - margin, 796).lineWidth(0.5).strokeColor(line).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(muted)
      .text('Gestão CX RARS  ·  ' + input.employee.display_name + '  ·  Página ' + (i + 1) + ' de ' + pages.count,
        margin, 808, { width: contentWidth, align: 'center', lineBreak: false });
  }

  doc.end();
  return finished;
}

export function talentPdfFilename(employeeName: string) {
  const slug = employeeName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return 'gestao-cx-talento-' + (slug || 'colaborador') + '.pdf';
}
