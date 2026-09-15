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

// Mantido para leitura de registros V1/V2 anteriores. Na experiência atual o fechamento é automático e compacto.
export const competencyConsolidationFields = [
  ['recognizedStrengths', 'Forças reconhecidas'],
  ['developmentPriority', 'Prioridade de desenvolvimento'],
  ['employeeAgreements', 'Acordos com o colaborador'],
  ['managerSupport', 'Apoio do gestor'],
  ['pdiConnection', 'Conexão com o PDI'],
] as const;

export function bandForScore(score: number): CompetencyBand | null {
  if (!Number.isFinite(score) || score < 0 || score > 1.2) return null;
  // A nota é trabalhada em centésimos. A faixa é consequência da nota, nunca uma segunda escolha.
  if (score < 0.8) return 'not_meets';
  if (score < 1) return 'partial';
  if (score <= 1.1) return 'meets';
  return 'exceeds';
}

export function isScoreValidForBand(score: number, band: string) {
  return bandForScore(score) === band;
}

export function bandLabel(value: string | undefined | null) {
  return competencyBands.find((item) => item.value === value)?.label ?? '—';
}

export function bandHelp(value: string | undefined | null) {
  return competencyBands.find((item) => item.value === value)?.help ?? '';
}

export function scoreText(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function buildAutomaticOfficialComment(
  competencyLabel: string,
  score: number,
  evidence: string,
  nextStep?: string,
) {
  const band = bandForScore(score);
  if (!band || !evidence.trim()) return '';

  const opening: Record<CompetencyBand, string> = {
    not_meets: `Em ${competencyLabel}, os comportamentos observados ainda aparecem abaixo do esperado para o ciclo.`,
    partial: `Em ${competencyLabel}, há demonstrações da competência, ainda com oportunidade de maior consistência.`,
    meets: `Em ${competencyLabel}, demonstra os comportamentos esperados com consistência no ciclo.`,
    exceeds: `Em ${competencyLabel}, demonstra contribuição acima do esperado, sustentada pelos comportamentos e resultados observados.`,
  };

  const parts = [opening[band], sentence(evidence)];
  if (nextStep?.trim()) parts.push(`Próximo foco: ${sentence(nextStep)}`);
  return parts.join(' ');
}

export function defaultCompetencyCycleLabel(date = new Date()) {
  const semester = date.getMonth() < 6 ? '1º semestre' : '2º semestre';
  return `${semester} de ${date.getFullYear()}`;
}
