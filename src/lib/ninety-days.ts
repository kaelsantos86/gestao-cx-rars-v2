export const ninetyDayDimensions = [
  { key: 'roleClarity', label: 'Clareza do papel', help: 'Responsabilidades, prioridades e critérios de sucesso.' },
  { key: 'deliveryQuality', label: 'Entregas e qualidade', help: 'Avanço nas prioridades e consistência dos resultados.' },
  { key: 'autonomyProtagonism', label: 'Autonomia e protagonismo', help: 'Iniciativa, decisão no espaço combinado e antecipação de riscos.' },
  { key: 'integrationCollaboration', label: 'Integração e colaboração', help: 'Relações, compartilhamento de contexto e contribuição ao time.' },
  { key: 'conditionsSupport', label: 'Condições e apoio', help: 'Acesso a contexto, recursos, decisões e acompanhamento adequados.' },
] as const;

export const ninetyDayManagerPreparationFields = [
  ['observableAdvances', 'Avanços e contribuições observáveis'],
  ['strengths', 'Forças que já aparecem'],
  ['developmentPriorities', 'Pontos prioritários de desenvolvimento'],
  ['possibleRouteAdjustment', 'Possível ajuste de rota'],
] as const;

export const ninetyDayReflectionQuestions = [
  { key: 'advancesLearning', label: 'Principais avanços ou aprendizados' },
  { key: 'proudContribution', label: 'Contribuição de maior orgulho' },
  { key: 'expectationVsReality', label: 'Expectativa inicial x realidade' },
  { key: 'obstaclesDependencies', label: 'Obstáculos, dúvidas ou dependências' },
  { key: 'feedbackApplied', label: 'Feedback recebido e aplicado' },
  { key: 'supportDifference', label: 'Apoio que faria diferença' },
  { key: 'continueStartAdjustStop', label: 'Continuar, começar, ajustar ou parar' },
  { key: 'nextCyclePriority', label: 'Principal prioridade do próximo ciclo' },
  { key: 'additionalConversation', label: 'Algo mais para a conversa' },
] as const;

export const ninetyDayDirections = [
  { value: 'maintain', label: 'Manter' },
  { value: 'adjust', label: 'Ajustar' },
  { value: 'accelerate', label: 'Acelerar' },
  { value: 'recalibrate', label: 'Recalibrar' },
] as const;

export const ninetyDayConclusionFields = [
  ['ninetyDaySummary', 'Síntese dos primeiros 90 dias'],
  ['workAgreements', 'Acordos de trabalho'],
  ['employeeCommitments', 'Compromissos do colaborador'],
  ['managerCommitments', 'Compromissos do gestor'],
] as const;

export function ratingLabel(value: number) {
  const labels: Record<number, string> = {
    1: 'Muito abaixo do necessário hoje',
    2: 'Abaixo do necessário para o momento',
    3: 'Adequado para o momento',
    4: 'Acima do esperado para o ciclo',
    5: 'Muito acima do esperado para o ciclo',
  };
  return labels[value] ?? String(value);
}
