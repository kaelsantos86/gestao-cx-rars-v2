export const talentPurposes = [
  { value: 'executive_view', label: 'Visão executiva' },
  { value: 'recognition', label: 'Reconhecimento' },
  { value: 'career_context', label: 'Contexto de carreira' },
] as const;

export const talentExecutiveFields = [
  ['headline', 'Mensagem executiva principal'],
  ['summary', 'Síntese executiva'],
  ['strengths', 'Fortalezas e competências em evidência'],
  ['managerConclusion', 'Conclusão gerencial'],
] as const;

export const talentDeliveryFields = [
  ['delivery1', 'Entrega / contribuição 1'],
  ['delivery2', 'Entrega / contribuição 2'],
  ['delivery3', 'Entrega / contribuição 3'],
] as const;

export const talentIndicatorFields = [
  ['indicator1', 'Indicador / evidência objetiva 1'],
  ['indicator2', 'Indicador / evidência objetiva 2'],
  ['indicator3', 'Indicador / evidência objetiva 3'],
] as const;

export function talentPurposeLabel(value: string) {
  return talentPurposes.find((item) => item.value === value)?.label ?? value;
}

export function talentSourceLabel(moduleType: string) {
  const labels: Record<string, string> = {
    marco_zero: 'Marco Zero',
    ninety_days: 'Avaliação de 90 dias',
    competencies: 'Competências',
    pdi: 'PDI Evolutivo',
    feedback: 'Feedback de reconhecimento',
  };
  return labels[moduleType] ?? moduleType;
}

export type TalentSourceRow = {
  id: string;
  module_type: string;
  status: string;
  cycle_label: string | null;
  occurred_on: string | null;
  completed_at: string | null;
  created_at: string;
  payload: Record<string, any> | null;
};

export type TalentSourceSnapshot = {
  id: string;
  moduleType: string;
  moduleLabel: string;
  cycleLabel: string;
  status: string;
  referenceDate: string;
  signals: string[];
};

export function isTalentSourceEligible(record: TalentSourceRow) {
  if (record.module_type === 'pdi') {
    return ['active', 'in_review', 'completed', 'archived'].includes(record.status);
  }

  if (record.module_type === 'feedback') {
    const payload = record.payload ?? {};
    return record.status === 'completed'
      && payload.feedbackFlow === 'recognition'
      && payload.talentEligible === true
      && payload.recognitionEvidenceReady === true;
  }

  return ['marco_zero', 'ninety_days', 'competencies'].includes(record.module_type)
    && ['completed', 'archived'].includes(record.status);
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function extractTalentSignals(record: TalentSourceRow): string[] {
  const payload = record.payload ?? {};
  const signals: string[] = [];

  const push = (value: unknown) => {
    const text = asText(value);
    if (text && !signals.includes(text)) signals.push(text);
  };

  if (record.module_type === 'marco_zero') {
    push(payload.rolePurpose);
    push(payload.first30DaysPriorities);
    push(payload.successSignals);
    push(payload.autonomyBoundaries);
  }

  if (record.module_type === 'ninety_days') {
    push(payload.observableAdvances);
    push(payload.strengths);
    push(payload.ninetyDaySummary);
    const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
    priorities.forEach((item: any) => push(item?.result));
  }

  if (record.module_type === 'competencies') {
    const assessments = (payload.finalAssessments ?? payload.initialAssessments ?? {}) as Record<string, any>;
    Object.values(assessments)
      .sort((a: any, b: any) => Number(b?.score ?? 0) - Number(a?.score ?? 0))
      .slice(0, 3)
      .forEach((item: any) => {
        push(item?.officialComment);
        push(item?.evidence);
      });
    push(payload.strengthSummary);
    push(payload.developmentPriority);
  }

  if (record.module_type === 'pdi') {
    const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
    priorities.slice(0, 3).forEach((item: any) => {
      push(item?.title);
      push(item?.desiredState);
      push(item?.evidence);
    });
    push(payload.strengthsToPreserve);
    push(payload.developmentDirection);
    push(payload.review?.cycleSummary);
  }

  if (record.module_type === 'feedback') {
    push(payload.concreteContribution);
    push(payload.generatedImpact);
    push(payload.recognizedStrengths);
    push(payload.competenciesValues);
    push(payload.essentialRecord);
  }

  return signals.slice(0, 5);
}

export function buildTalentSourceSnapshot(records: TalentSourceRow[]): TalentSourceSnapshot[] {
  return records.map((record) => ({
    id: record.id,
    moduleType: record.module_type,
    moduleLabel: talentSourceLabel(record.module_type),
    cycleLabel: record.cycle_label ?? 'Registro formal',
    status: record.status,
    referenceDate: String(record.completed_at ?? record.occurred_on ?? record.created_at).slice(0, 10),
    signals: extractTalentSignals(record),
  }));
}
