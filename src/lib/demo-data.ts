export type CoreJourneyModule = 'marco_zero' | 'ninety_days' | 'competencies' | 'pdi';

export type EmployeeSummary = {
  id: string;
  displayName: string;
  currentRole: string;
  currentSquad: string;
  stage: string;
  professionalMoment: 'entry' | 'consolidation' | 'established' | 'transition';
  v2EntryModule: 'marco_zero' | 'ninety_days' | 'competencies' | 'pdi' | 'feedback' | 'talent';
  journeyNote: string;
  nextMilestone: string;
  nextMilestoneDate?: string;
  openRecordId?: string;
  openRecordModule?: CoreJourneyModule;
  openRecordStatus?: string;
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
  { id: 'alisson', displayName: 'Alisson', currentRole: 'Assessor II', currentSquad: 'Estratégia / CX', stage: 'Estabilizado', professionalMoment: 'established', v2EntryModule: 'competencies', journeyNote: 'Profissional estabilizado: etapas de entrada não são refeitas; seguir pelo ciclo semestral Competências → PDI.', nextMilestone: 'Competências' },
  { id: 'daniela', displayName: 'Daniela', currentRole: 'Assessora', currentSquad: 'Suporte', stage: 'Estabilizado', professionalMoment: 'established', v2EntryModule: 'competencies', journeyNote: 'Profissional estabilizado: etapas de entrada não são refeitas; seguir pelo ciclo semestral Competências → PDI.', nextMilestone: 'Competências' },
  { id: 'nathyelle', displayName: 'Nathyelle', currentRole: 'Assessora', currentSquad: 'Atendimento Digital', stage: 'Estabilizado', professionalMoment: 'established', v2EntryModule: 'competencies', journeyNote: 'Profissional estabilizado: etapas de entrada não são refeitas; seguir pelo ciclo semestral Competências → PDI.', nextMilestone: 'Competências' },
  { id: 'francieli', displayName: 'Francieli', currentRole: 'Assessora', currentSquad: 'CX', stage: 'Consolidação', professionalMoment: 'consolidation', v2EntryModule: 'ninety_days', journeyNote: 'Consolidação na função: Marco Zero não é refeito; iniciar pela avaliação de 90 dias e seguir para PDI.', nextMilestone: 'Avaliação de 90 dias' },
  { id: 'khaoan', displayName: 'Khaoan', currentRole: 'Assessor', currentSquad: 'CX', stage: 'Consolidação', professionalMoment: 'consolidation', v2EntryModule: 'ninety_days', journeyNote: 'Consolidação na função: Marco Zero não é refeito; iniciar pela avaliação de 90 dias e seguir para PDI.', nextMilestone: 'Avaliação de 90 dias' },
  { id: 'jessica', displayName: 'Jessica', currentRole: 'Assessora', currentSquad: 'CX', stage: 'Entrada', professionalMoment: 'entry', v2EntryModule: 'marco_zero', journeyNote: 'Entrada na função: iniciar pela jornada Marco Zero → 90 dias → primeiro PDI.', nextMilestone: 'Marco Zero' },
  { id: 'leandro', displayName: 'Leandro', currentRole: 'Assessor', currentSquad: 'CX', stage: 'Entrada', professionalMoment: 'entry', v2EntryModule: 'marco_zero', journeyNote: 'Entrada na função: iniciar pela jornada Marco Zero → 90 dias → primeiro PDI.', nextMilestone: 'Marco Zero' },
];

export const demoTimeline: Record<string, TimelineItem[]> = {
  jessica: [
    { id: 'j1', module: 'marco_zero', title: 'Marco Zero', status: 'Preparação', date: '2026-09', description: 'Alinhamento inicial e registro de expectativas, autonomia e primeiro ciclo.' },
  ],
  leandro: [
    { id: 'l1', module: 'marco_zero', title: 'Marco Zero', status: 'Preparação', date: '2026-09', description: 'Alinhamento inicial e registro de expectativas, autonomia e primeiro ciclo.' },
  ],
};
