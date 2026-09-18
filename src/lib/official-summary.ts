import {
  buildCompetencyFinalSummary,
  buildFeedbackFinalSummary,
  buildMarcoZeroSummary,
  buildNinetyDaySummary,
  buildPdiFinalSummary,
} from '@/lib/workflow-automation';

type JsonObject = Record<string, any>;

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function cleanCycleLabel(value?: string | null) {
  return text(value)
    .replace(/\s*·\s*histórico\s+V1\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const directionNames: Record<string, string> = {
  maintain: 'Manter',
  adjust: 'Ajustar',
  accelerate: 'Acelerar',
  recalibrate: 'Recalibrar',
};

export function buildOfficialSummary(
  moduleType: string,
  payloadInput: unknown,
  responseInput?: unknown,
  cycleLabel?: string | null,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const cleanedCycle = cleanCycleLabel(cycleLabel);

  let synthesis = '';

  if (moduleType === 'marco_zero') {
    synthesis = buildMarcoZeroSummary(payload, response);
  }

  if (moduleType === 'ninety_days') {
    const direction = directionNames[text(payload.agreedDirection)] ?? text(payload.agreedDirection);
    synthesis = buildNinetyDaySummary(
      payload,
      response,
      direction,
      text(payload.conversationAdjustment),
      text(payload.mainAgreement || payload.workAgreements),
    );
  }

  if (moduleType === 'competencies') {
    synthesis = buildCompetencyFinalSummary(payload);
  }

  if (moduleType === 'pdi') {
    synthesis = buildPdiFinalSummary(payload, response);
  }

  if (moduleType === 'feedback') {
    synthesis = buildFeedbackFinalSummary(payload, response);
  }

  if (moduleType === 'talent') {
    const executive = (payload.executive ?? {}) as JsonObject;
    const parts = [
      text(executive.headline || payload.headline),
      text(executive.summary || payload.executiveSummary || payload.summary),
      text(executive.strengths || payload.strengths),
      text(executive.managerConclusion || payload.recommendationThesis),
    ].filter(Boolean);

    synthesis = parts.join('\n\n');
  }

  const parts = [
    cleanedCycle ? `Ciclo: ${cleanedCycle}` : '',
    synthesis ? `Síntese final: ${synthesis}` : '',
  ].filter(Boolean);

  return parts.length ? parts.join('\n\n') : null;
}
