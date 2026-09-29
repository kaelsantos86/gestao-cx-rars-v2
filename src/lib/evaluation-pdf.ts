import PDFDocument from 'pdfkit';
import { buildOfficialSummary } from '@/lib/official-summary';
import {
  averageScore,
  bandForScore,
  bandLabel,
  buildCompetencyOfficialSummaries,
  competencies,
  hasNumericScore,
  scoreText,
} from '@/lib/competencies';
import { ninetyDayDimensions, ninetyDayManagerPreparationFields, ninetyDayReflectionQuestions } from '@/lib/ninety-days';
import { buildCompetencyFinalSummary } from '@/lib/workflow-automation';

type JsonObject = Record<string, any>;

export type EvaluationPdfInput = {
  record: {
    module_type: string;
    status: string;
    cycle_label?: string | null;
    occurred_on?: string | null;
    completed_at?: string | null;
    payload?: unknown;
  };
  employee: {
    display_name: string;
    role_title?: string | null;
    current_squad?: string | null;
  };
  response?: unknown;
};

const moduleNames: Record<string, string> = {
  marco_zero: 'Marco Zero',
  ninety_days: 'Avaliação de 90 dias',
  competencies: 'Avaliação de Competências',
  pdi: 'Plano de Desenvolvimento Individual',
  feedback: 'Feedback',
  talent: 'Talento em Evidência',
};

const colors = {
  ink: '#172A3A',
  muted: '#5E6B75',
  green: '#17735D',
  pale: '#EEF7F4',
  line: '#D9E2E5',
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function dateText(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date);
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.green).text(title.toUpperCase(), { characterSpacing: 0.6 });
  doc.moveDown(0.35);
}

function addCopyText(doc: PDFKit.PDFDocument, text: string) {
  doc.font('Helvetica').fontSize(10.5).fillColor(colors.ink).text(text, {
    lineGap: 3,
    paragraphGap: 7,
    align: 'left',
  });
}

function addScoreLine(
  doc: PDFKit.PDFDocument,
  label: string,
  manager: string,
  participant: string,
  average: string,
) {
  if (doc.y > 735) doc.addPage();
  const y = doc.y;
  doc.roundedRect(42, y, 511, 52, 7).fillAndStroke(colors.pale, colors.line);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.ink).text(label, 52, y + 9, { width: 491 });
  doc.font('Helvetica').fontSize(8.8).fillColor(colors.muted).text(
    `Gestor: ${manager}   |   Colaborador: ${participant}   |   Média: ${average}`,
    52,
    y + 29,
    { width: 491 },
  );
  doc.y = y + 60;
}

function addCompetencyContent(doc: PDFKit.PDFDocument, payload: JsonObject, response: JsonObject) {
  const assessments = (payload.finalAssessments ?? payload.initialAssessments ?? {}) as JsonObject;
  const participantCompetencies = (response.competencies ?? {}) as JsonObject;
  const summaries = new Map(buildCompetencyOfficialSummaries(payload, response).map((item) => [item.key, item.summary]));

  addSectionTitle(doc, 'Notas e médias por competência');
  for (const competency of competencies) {
    const manager = (assessments[competency.key] ?? {}) as JsonObject;
    const participant = (participantCompetencies[competency.key] ?? {}) as JsonObject;
    const managerScore = Number(manager.score);
    const participantScore = Number(participant.score);
    const average = averageScore(manager.score, participant.score);
    const managerBand = bandForScore(managerScore) ?? clean(manager.band);
    const participantBand = clean(participant.band);
    addScoreLine(
      doc,
      competency.label,
      Number.isFinite(managerScore) ? `${scoreText(managerScore)} · ${bandLabel(managerBand)}` : bandLabel(managerBand),
      hasNumericScore(participant.score) ? `${scoreText(participantScore)} · ${bandLabel(participantBand)}` : participantBand ? `${bandLabel(participantBand)} · nota não registrada` : 'Não enviada',
      average === null ? 'Indisponível' : scoreText(average),
    );
  }

  if (summaries.size) {
    addSectionTitle(doc, 'Textos por competência para copiar');
    for (const competency of competencies) {
      const summary = summaries.get(competency.key);
      if (!summary) continue;
      if (doc.y > 680) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(colors.ink).text(competency.label);
      doc.moveDown(0.25);
      addCopyText(doc, summary);
      doc.moveDown(0.35);
    }
  }
}

function addNinetyDayContent(doc: PDFKit.PDFDocument, payload: JsonObject, response: JsonObject) {
  const managerRatings = (payload.managerRatings ?? {}) as JsonObject;
  const participantRatings = (response.ratings ?? {}) as JsonObject;

  addSectionTitle(doc, 'Notas e médias por dimensão');
  for (const dimension of ninetyDayDimensions) {
    const manager = Number(managerRatings[dimension.key]);
    const participant = Number(participantRatings[dimension.key]);
    const hasManager = Number.isFinite(manager) && manager > 0;
    const hasParticipant = Number.isFinite(participant) && participant > 0;
    const average = hasManager && hasParticipant ? (manager + participant) / 2 : null;
    addScoreLine(
      doc,
      dimension.label,
      hasManager ? manager.toLocaleString('pt-BR') : '—',
      hasParticipant ? participant.toLocaleString('pt-BR') : 'Não enviada',
      average === null ? 'Indisponível' : average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
    );
  }

  const preparation = ninetyDayManagerPreparationFields
    .map(([key, label]) => ({ label, value: clean(payload[key]) }))
    .filter((item) => item.value);
  if (preparation.length) {
    addSectionTitle(doc, 'Preparação do gestor');
    for (const item of preparation) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.ink).text(item.label);
      addCopyText(doc, item.value);
    }
  }

  const reflections = (response.reflections ?? {}) as JsonObject;
  const participantText = ninetyDayReflectionQuestions
    .map((question) => ({ label: question.label, value: clean(reflections[question.key]) }))
    .filter((item) => item.value);
  if (participantText.length) {
    addSectionTitle(doc, 'Perspectiva do colaborador');
    for (const item of participantText) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.ink).text(item.label);
      addCopyText(doc, item.value);
    }
  }
}

export async function createEvaluationPdf(input: EvaluationPdfInput) {
  const payload = (input.record.payload ?? {}) as JsonObject;
  const response = (input.response ?? {}) as JsonObject;
  const summary = input.record.module_type === 'competencies'
    ? [
        clean(input.record.cycle_label) ? `Ciclo: ${clean(input.record.cycle_label).replace(/\s*·\s*histórico\s+V1\s*/gi, '')}` : '',
        buildCompetencyFinalSummary(payload) ? `Síntese final: ${buildCompetencyFinalSummary(payload)}` : '',
      ].filter(Boolean).join('\n\n')
    : buildOfficialSummary(
        input.record.module_type,
        payload,
        response,
        input.record.cycle_label,
      );

  const doc = new PDFDocument({ size: 'A4', margins: { top: 42, right: 42, bottom: 48, left: 42 }, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.rect(0, 0, 595.28, 116).fill(colors.green);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('GESTÃO CX RARS', 42, 35, { characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(22).text(moduleNames[input.record.module_type] ?? 'Avaliação', 42, 55, { width: 510 });
  doc.font('Helvetica').fontSize(10).fillColor('#D9F0E9').text('PDF operacional · textos selecionáveis para copiar e colar', 42, 86);
  doc.y = 137;

  doc.font('Helvetica-Bold').fontSize(17).fillColor(colors.ink).text(input.employee.display_name);
  const role = [clean(input.employee.role_title), clean(input.employee.current_squad)].filter(Boolean).join(' · ');
  if (role) doc.font('Helvetica').fontSize(10).fillColor(colors.muted).text(role);
  const metadata = [
    clean(input.record.cycle_label) ? `Ciclo: ${clean(input.record.cycle_label).replace(/\s*·\s*histórico\s+V1\s*/gi, '')}` : '',
    dateText(input.record.completed_at || input.record.occurred_on) ? `Data: ${dateText(input.record.completed_at || input.record.occurred_on)}` : '',
  ].filter(Boolean).join('   |   ');
  if (metadata) doc.moveDown(0.35).font('Helvetica').fontSize(9.5).fillColor(colors.muted).text(metadata);

  if (input.record.module_type === 'competencies') addCompetencyContent(doc, payload, response);
  if (input.record.module_type === 'ninety_days') addNinetyDayContent(doc, payload, response);

  if (summary) {
    addSectionTitle(doc, 'Resumo para registro oficial');
    addCopyText(doc, summary);
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text(
      `Gestão CX RARS · ${input.employee.display_name} · página ${index + 1} de ${range.count}`,
      42,
      805,
      { width: 511, align: 'center', lineBreak: false },
    );
  }

  doc.end();
  return finished;
}

export function evaluationPdfFilename(employeeName: string, moduleType: string, cycleLabel?: string | null) {
  const slug = [employeeName, moduleNames[moduleType] ?? moduleType, cycleLabel ?? '']
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `gestao-cx-rars-${slug || 'avaliacao'}.pdf`;
}
