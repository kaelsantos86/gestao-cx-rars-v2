export const pdiCycleTypes = [
  { value: 'first_pdi', label: 'Primeiro PDI', help: 'Depois da devolutiva de 90 dias.' },
  { value: 'role_consolidation', label: 'Consolidação no papel', help: 'Quando a pessoa ainda estrutura consistência e autonomia na função.' },
  // Preserve the stored key for compatibility with existing records.
  { value: 'semiannual_evolution', label: 'Evolução anual', help: 'Para renovar prioridades em ciclos anuais.' },
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
  ['nextYearGoals', 'O que você deseja alcançar profissionalmente no ano deste PDI e como este ciclo pode contribuir?'],
  ['learningInterests', 'Que cursos, certificações ou formação você considera buscar, e como pretende aplicar o aprendizado?'],
  ['developmentConditions', 'Que condições, recursos ou obstáculos precisam ser considerados?'],
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
  // In the final quarter, suggest the upcoming annual planning cycle.
  return String(date.getFullYear() + (date.getMonth() >= 9 ? 1 : 0));
}

export const pdiOptionalParticipantFields = new Set<string>(['observations', 'learningInterests', 'developmentConditions']);
export const pdiEditableStatuses = ['draft', 'awaiting_participant', 'participant_submitted', 'in_conversation'];

export function readPdiPriorities(formData: FormData, previous: Record<string, any>[] = [], strict = false) {
  return [1, 2, 3].flatMap((index) => {
    const keys = ['axis', 'title', 'currentState', 'desiredState', 'practice', 'evidence', 'support', 'autonomy', 'relatedCompetency', 'learningPlan', 'targetDate'];
    const id = String(formData.get(`priority_${index}_id`) ?? `priority_${index}`);
    const old = previous.find((item) => item.id === id) ?? previous[index - 1] ?? {};
    const fields = Object.fromEntries(keys.map((key) => [key, formData.has(`priority_${index}_${key}`) ? String(formData.get(`priority_${index}_${key}`) ?? '').trim() : String(old[key] ?? '')]));
    if (!Object.values(fields).some(Boolean)) return [];
    if (strict && ['axis', 'title', 'desiredState', 'practice', 'evidence'].some((key) => !fields[key])) throw new Error(`incomplete_priority_${index}`);
    return [{ ...old, ...fields, id }];
  });
}
