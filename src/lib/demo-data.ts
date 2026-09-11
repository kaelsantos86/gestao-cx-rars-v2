export type EmployeeSummary = {
  id: string;
  displayName: string;
  currentRole: string;
  currentSquad: string;
  stage: string;
  nextMilestone: string;
  nextMilestoneDate?: string;
};

export type TimelineItem = {
  id: string;
  module: string;
  title: string;
  status: string;
  date: string;
  description: string;
};

export const demoTeam: EmployeeSummary[] = [
  { id: 'alisson', displayName: 'Alisson', currentRole: 'Assessor II', currentSquad: 'Estratégia / CX', stage: 'Consolidado', nextMilestone: 'PDI semestral' },
  { id: 'daniela', displayName: 'Daniela', currentRole: 'Assessora', currentSquad: 'Suporte', stage: 'Consolidada', nextMilestone: 'PDI semestral' },
  { id: 'nathyelle', displayName: 'Nathyelle', currentRole: 'Assessora', currentSquad: 'Atendimento Digital', stage: 'Consolidada', nextMilestone: 'PDI semestral' },
  { id: 'francieli', displayName: 'Francieli', currentRole: 'Assessora', currentSquad: 'CX', stage: 'Consolidação', nextMilestone: 'Avaliação + PDI' },
  { id: 'khaoan', displayName: 'Khaoan', currentRole: 'Assessor', currentSquad: 'CX', stage: 'Consolidação', nextMilestone: 'Avaliação + PDI' },
  { id: 'jessica', displayName: 'Jessica', currentRole: 'Assessora', currentSquad: 'CX', stage: 'Entrada', nextMilestone: 'Marco Zero' },
  { id: 'leandro', displayName: 'Leandro', currentRole: 'Assessor', currentSquad: 'CX', stage: 'Entrada', nextMilestone: 'Marco Zero' },
];

export const demoTimeline: Record<string, TimelineItem[]> = {
  jessica: [
    { id: 'j1', module: 'Marco Zero', title: 'Marco Zero', status: 'Preparação', date: '2026-09', description: 'Alinhamento inicial e registro de expectativas, autonomia e primeiro ciclo.' },
  ],
  leandro: [
    { id: 'l1', module: 'Marco Zero', title: 'Marco Zero', status: 'Preparação', date: '2026-09', description: 'Alinhamento inicial e registro de expectativas, autonomia e primeiro ciclo.' },
  ],
};
