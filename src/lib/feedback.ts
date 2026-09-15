export const feedbackFlows = [
  {
    value: 'orientation',
    label: 'Orientação / correção de rota',
    help: 'Situação específica em que fatos, impacto e direção desejada precisam de clareza.',
  },
  {
    value: 'recognition',
    label: 'Promoção e/ou reconhecimento',
    help: 'Contribuição concreta, impacto e mérito; promoção somente após aprovação formal.',
  },
] as const;

export const recognitionModes = [
  { value: 'recognition', label: 'Reconhecimento' },
  { value: 'promotion', label: 'Promoção confirmada' },
] as const;

export const orientationPreparationFields = [
  ['situationReason', 'Situação ou motivo'],
  ['shareableContext', 'Contexto compartilhável'],
  ['observedFacts', 'Fatos observados'],
  ['behavioralImpact', 'Impacto comportamental'],
  ['expectedDirection', 'Direção esperada'],
  ['previousContext', 'Contexto anterior'],
] as const;

export const recognitionPreparationFields = [
  ['concreteContribution', 'Contribuição concreta'],
  ['generatedImpact', 'Impacto gerado'],
  ['recognizedStrengths', 'Fortalezas reconhecidas'],
  ['competenciesValues', 'Competências ou valores'],
] as const;

export const promotionFields = [
  ['roleTransition', 'Transição de papel'],
  ['newResponsibilities', 'Novas responsabilidades'],
  ['effectiveDate', 'Data efetiva'],
] as const;

export const feedbackParticipantFields = [
  ['currentMoment', 'Como você percebe seu momento atual?'],
  ['importantContext', 'Qual contexto, contribuição ou aprendizado é importante para a conversa?'],
  ['meaningfulChange', 'Que conquista, evolução ou mudança faria sentido discutir?'],
  ['neededSupport', 'Que apoio ou clareza você precisa?'],
  ['nextMovement', 'Que próximo movimento faz sentido?'],
  ['ownCommitment', 'Existe algum compromisso que você quer assumir?'],
  ['additionalNotes', 'Algo mais que você gostaria de dizer?'],
] as const;

export const feedbackClosingFields = [
  ['perceivedCare', 'Cuidados percebidos'],
  ['collaboratorCommitment', 'Compromisso do colaborador'],
  ['managerCommitment', 'Compromisso do gestor'],
  ['nextMoves', 'Próximos movimentos'],
  ['autonomySpace', 'Espaço de autonomia'],
  ['followupReason', 'Retomada e motivo'],
  ['essentialRecord', 'Registro essencial'],
  ['futureDirection', 'Direção futura'],
] as const;

export function feedbackFlowLabel(value: string) {
  return feedbackFlows.find((item) => item.value === value)?.label ?? value;
}

export function recognitionModeLabel(value: string) {
  return recognitionModes.find((item) => item.value === value)?.label ?? value;
}

export function feedbackCycleLabel(flow: string, occurredOn?: string) {
  const date = occurredOn ? new Date(`${occurredOn}T12:00:00`) : new Date();
  const formatted = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  return `Feedback · ${feedbackFlowLabel(flow)} · ${formatted}`;
}
