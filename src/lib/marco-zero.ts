export const marcoZeroQuestions = [
  { key: 'motivation', label: 'O que mais motivou você a assumir este desafio?' },
  { key: 'needsToUnderstand', label: 'O que você precisa compreender para começar com segurança?' },
  { key: 'bestConditions', label: 'Em quais condições você costuma entregar seu melhor trabalho?' },
  { key: 'contextPreference', label: 'Como você prefere receber contexto e orientações?' },
  { key: 'feedbackPreference', label: 'Como o feedback costuma funcionar melhor para você?' },
  { key: 'supportNeeded', label: 'Que apoio aumentaria sua chance de começar bem?' },
  { key: 'risksExpectations', label: 'Existe alguma preocupação, risco ou expectativa que vale colocarmos na mesa?' },
  { key: 'firstContribution', label: 'Qual contribuição ou primeira entrega você imagina conseguir realizar?' },
  { key: 'additionalContext', label: 'Há algo mais que você gostaria que seu gestor soubesse antes da conversa?' },
] as const;

export type MarcoZeroParticipantPayload = Record<(typeof marcoZeroQuestions)[number]['key'], string>;

export const marcoZeroManagerFields = [
  ['moment', 'Momento atual'],
  ['purpose', 'Propósito do trabalho'],
  ['expectedContribution', 'Contribuição esperada do papel'],
  ['qualityCriteria', 'Critérios de qualidade e sucesso'],
  ['first30Days', 'Prioridades dos primeiros 30 dias'],
  ['autonomy', 'Autonomia combinada'],
  ['involveManager', 'Quando envolver o gestor'],
  ['waysOfWorking', 'Como vamos trabalhar'],
  ['managerCommitments', 'Compromissos do gestor'],
] as const;
