export const competencyBands = [
  { value: 'not_meets', label: 'Não atende', min: 0, max: 0.79, help: 'Comportamentos necessários ainda não aparecem de forma suficiente no contexto observado.' },
  { value: 'partial', label: 'Atende parcialmente', min: 0.8, max: 0.99, help: 'Há sinais, mas falta consistência, amplitude ou efeito esperado.' },
  { value: 'meets', label: 'Atende à expectativa', min: 1, max: 1.1, help: 'Comportamentos esperados aparecem com consistência adequada.' },
  { value: 'exceeds', label: 'Supera a expectativa', min: 1.11, max: 1.2, help: 'Há contribuição acima do esperado, sustentada por fatos e efeito relevante.' },
] as const;

export type CompetencyBand = typeof competencyBands[number]['value'];

export const competencies = [
  { key: 'cooperation', label: 'Cooperação', tagline: 'Gente com quem contar.', help: 'Trabalho em equipe, objetivo comum e atitude cooperativa.' },
  { key: 'systemic_action', label: 'Atuação Sistêmica', tagline: 'Gente que faz junto.', help: 'Visão do todo, articulação e responsabilidade compartilhada.' },
  { key: 'people_centered', label: 'Pessoas no Centro', tagline: 'Gente que entende de gente.', help: 'Escuta, necessidade real e qualidade da experiência.' },
  { key: 'local_development', label: 'Desenvolvimento Local', tagline: 'Gente que gera prosperidade.', help: 'Valor para comunidade, associado e território.' },
  { key: 'constant_evolution', label: 'Evolução Constante', tagline: 'Gente que evolui.', help: 'Aprendizado, melhoria, dados e adaptação.' },
  { key: 'ethics', label: 'Ética', tagline: 'Gente que faz o certo.', help: 'Integridade, responsabilidade e coerência.' },
  { key: 'transparency', label: 'Transparência', tagline: 'Gente que gera confiança.', help: 'Clareza, verdade, rastreabilidade e comunicação responsável.' },
] as const;

export const competencyRoleProfiles = [
  { value: 'collaborator_advisor', label: 'Colaborador / assessor' },
  { value: 'leadership', label: 'Liderança' },
] as const;

export const competencyMoments = [
  { value: 'entry', label: 'Entrada' },
  { value: 'consolidation', label: 'Consolidação' },
  { value: 'consistent_autonomy', label: 'Autonomia consistente' },
  { value: 'reference', label: 'Referência' },
] as const;

export const competencyContextFields = [
  ['semesterContext', 'Momento e principais entregas do semestre'],
  ['demonstrationOpportunities', 'Oportunidades reais de demonstrar'],
  ['priorAgreements', 'Acordos e expectativas já combinados'],
] as const;

export const competencyConsolidationFields = [
  ['recognizedStrengths', 'Forças reconhecidas'],
  ['developmentPriority', 'Prioridade de desenvolvimento'],
  ['employeeAgreements', 'Acordos com o colaborador'],
  ['managerSupport', 'Apoio do gestor'],
  ['pdiConnection', 'Conexão com o PDI'],
] as const;

export function bandForScore(score: number): CompetencyBand | null {
  const band = competencyBands.find((item) => score >= item.min && score <= item.max);
  return band?.value ?? null;
}

export function isScoreValidForBand(score: number, band: string) {
  const definition = competencyBands.find((item) => item.value === band);
  return Boolean(definition && Number.isFinite(score) && score >= definition.min && score <= definition.max);
}

export function bandLabel(value: string | undefined | null) {
  return competencyBands.find((item) => item.value === value)?.label ?? '—';
}

export function defaultCompetencyCycleLabel(date = new Date()) {
  const semester = date.getMonth() < 6 ? '1º semestre' : '2º semestre';
  return `${semester} de ${date.getFullYear()}`;
}
