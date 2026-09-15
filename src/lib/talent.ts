export const talentPurposes = [
  { value: 'executive_view', label: 'Visão executiva' },
  { value: 'recognition', label: 'Reconhecimento' },
  { value: 'career_context', label: 'Contexto de carreira' },
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
