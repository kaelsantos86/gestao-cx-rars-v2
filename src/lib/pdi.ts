export const pdiCycleTypes = [
  { value: 'first_pdi', label: 'Primeiro PDI', help: 'Depois da devolutiva de 90 dias.' },
  { value: 'role_consolidation', label: 'Consolidação no papel', help: 'Quando a pessoa ainda estrutura consistência e autonomia na função.' },
  { value: 'semiannual_evolution', label: 'Evolução semestral', help: 'Para renovar prioridades no ciclo regular.' },
  { value: 'extraordinary_review', label: 'Revisão extraordinária', help: 'Quando há mudança relevante de contexto, papel ou direção.' },
] as const;

export const pdiAxes = [
  { value: 'business_repertoire', label: 'Repertório e negócio', help: 'Contexto, repertório técnico e compreensão do negócio.' },
  { value: 'autonomy_decision', label: 'Autonomia e decisão', help: 'Segurança, responsabilidade e qualidade de decisão.' },
  { value: 'systemic_influence', label: 'Atuação sistêmica e influência', help: 'Visão do todo, articulação e influência sem hierarquia.' },
  { value: 'experience_data_innovation', label: 'Experiência, dados e inovação', help: 'Leitura do associado, jornadas, dados e melhorias.' },
  { value: 'communication_relationships_leadership', label: 'Comunicação, relações e liderança', help: 'Comunicação, vínculos, colaboração e presença.' },
  { value: 'maturity_trajectory', label: 'Maturidade e trajetória', help: 'Direção profissional, consistência e próximos desafios.' },
] as const;

export const relatedCompetencies = [
  'Cooperação',
  'Atuação Sistêmica',
  'Pessoas no Centro',
  'Desenvolvimento Local',
  'Evolução Constante',
  'Ética',
  'Transparência',
] as const;

export const pdiContextFields = [
  ['contextAndRole', 'Contexto da função e atuação'],
  ['currentMoment', 'Momento profissional atual'],
  ['strengthsToPreserve', 'Fortalezas a preservar'],
  ['aspiration', 'Aspiração e direção profissional'],
  ['developmentDirection', 'Direção de desenvolvimento'],
  ['notPriorityNow', 'O que não precisa virar prioridade agora'],
  ['sourceReadings', 'Leitura das fontes'],
] as const;

export const pdiAgreementFields = [
  ['collaboratorCommitment', 'Compromisso do colaborador'],
  ['managerCommitment', 'Compromisso do gestor'],
  ['autonomyAgreement', 'Acordo de autonomia'],
  ['sharedAgreements', 'Acordos compartilhados'],
  ['conversationSummary', 'Síntese da conversa'],
] as const;

export const pdiParticipantFields = [
  ['professionalMoment', 'Como você descreve seu momento profissional hoje?'],
  ['recognizedStrengths', 'Quais fortalezas você reconhece e quer preservar?'],
  ['aspirationDirection', 'Que direção ou aspiração profissional faz sentido agora?'],
  ['desiredDevelopment', 'O que você mais gostaria de desenvolver neste ciclo?'],
  ['practicalExperience', 'Que experiência prática ajudaria esse desenvolvimento?'],
  ['desiredAutonomy', 'Em que decisões ou situações você busca mais autonomia?'],
  ['managerSupport', 'Que apoio do gestor faria diferença?'],
  ['ownCommitment', 'Que compromisso você assume com seu desenvolvimento?'],
  ['observations', 'Há algo mais que deveria entrar na conversa?'],
] as const;

export const pdiReviewStatuses = [
  { value: 'advanced', label: 'Avançou' },
  { value: 'adjusted', label: 'Ajustado' },
  { value: 'continue', label: 'Continua no próximo ciclo' },
] as const;

export function pdiCycleTypeLabel(value: string) {
  return pdiCycleTypes.find((item) => item.value === value)?.label ?? value;
}

export function pdiAxisLabel(value: string) {
  return pdiAxes.find((item) => item.value === value)?.label ?? value;
}

export function defaultPdiCycleLabel(date = new Date()) {
  const semester = date.getMonth() < 6 ? '1º semestre' : '2º semestre';
  return `${semester} de ${date.getFullYear()}`;
}
