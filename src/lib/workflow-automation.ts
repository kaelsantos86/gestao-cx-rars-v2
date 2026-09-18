type JsonObject = Record<string, any>;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function sentence(value: unknown) {
  const normalized = text(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function excerpt(value: unknown, max = 220) {
  const normalized = text(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trim()}…`;
}

function formatDate(value: unknown) {
  const normalized = text(value);
  if (!normalized) return '';
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : normalized;
}

function paragraphs(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n\n');
}

const directionLabels: Record<string, string> = {
  maintain: 'manter',
  adjust: 'ajustar',
  accelerate: 'acelerar',
  recalibrate: 'recalibrar',
};

const competencyLabels: Record<string, string> = {
  cooperation: 'Cooperação',
  systemic_action: 'Atuação Sistêmica',
  people_centered: 'Pessoas no Centro',
  local_development: 'Desenvolvimento Local',
  constant_evolution: 'Evolução Constante',
  ethics: 'Ética',
  transparency: 'Transparência',
};

const competencyBandLabels: Record<string, string> = {
  not_meets: 'Não atende',
  partial: 'Atende parcialmente',
  meets: 'Atende à expectativa',
  exceeds: 'Supera a expectativa',
};

const ninetyDayDimensionLabels: Record<string, string> = {
  roleClarity: 'clareza do papel',
  deliveryQuality: 'entregas e qualidade',
  autonomyProtagonism: 'autonomia e protagonismo',
  integrationCollaboration: 'integração e colaboração',
  conditionsSupport: 'condições e apoio',
};

function managerConversationLens(employeeName?: string) {
  const name = (employeeName ?? '').toLocaleLowerCase('pt-BR');

  const directCompetitive = [
    'Apresente sua leitura com clareza, mas abra espaço real para a pessoa expor a própria interpretação antes de fechar qualquer conclusão.',
    'Se houver discordância, volte para fatos, exemplos e acordos observáveis; evite transformar a conversa em disputa de quem está certo.',
    'Respeite franqueza e posicionamentos diretos. O objetivo é construir o próximo movimento, não vencer a discussão.',
  ];

  if (name.includes('khaoan') || name.includes('cauan')) {
    return [
      ...directCompetitive,
      'Use comunicação objetiva e estruturada. Deixe explícitos papel, área de influência, autonomia e quando o gestor deve ser envolvido.',
      'Conecte desenvolvimento a responsabilidade real e espaço de decisão, evitando controle permanente ou microgestão.',
    ];
  }

  if (name.includes('alisson') || name.includes('francieli') || name.includes('jessica') || name.includes('natyelle')) {
    return directCompetitive;
  }

  if (name.includes('daniela') || name.includes('leandro')) {
    return [
      'Ouça a leitura da pessoa por inteiro antes de apresentar sua conclusão ou contraponto.',
      'Prefira sugestões, perguntas e recomendações a ordens diretas quando estiver construindo o próximo movimento.',
      'Mantenha a mensagem clara e segura sem endurecer o tom; valide ideias úteis antes de propor ajustes.',
    ];
  }

  return [
    'Comece pela escuta e use diferenças de percepção como perguntas, não como correções automáticas.',
    'Mantenha a conversa ancorada em fatos, exemplos e próximos movimentos observáveis.',
  ];
}

export function buildMarcoZeroSummary(payloadInput: unknown, responseInput?: unknown) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;

  const purpose = text(payload.purpose);
  const contribution = text(payload.expectedContribution);
  const first30Days = text(payload.first30Days);
  const autonomy = text(payload.autonomy);
  const involveManager = text(payload.involveManager);
  const adjustment = text(payload.conversationAdjustment);
  const mainAgreement = text(payload.mainAgreement);
  const managerSupport = text(payload.managerSupport || payload.managerCommitments);
  const nextFollowUp = formatDate(payload.nextFollowUp);

  const openingParts = [
    purpose ? `O Marco Zero alinhou o propósito do trabalho: ${sentence(purpose)}` : '',
    contribution ? `A contribuição esperada para o papel ficou definida como ${sentence(contribution)}` : '',
    first30Days ? `As prioridades iniciais são ${sentence(first30Days)}` : '',
  ].filter(Boolean);

  const autonomyParts = [
    autonomy ? `Autonomia combinada: ${sentence(autonomy)}` : '',
    involveManager ? `O gestor deve ser envolvido em ${sentence(involveManager)}` : '',
  ].filter(Boolean);

  const closingParts = [
    adjustment ? `Na conversa final, ${sentence(adjustment)}` : '',
    mainAgreement ? `Acordo principal: ${sentence(mainAgreement)}` : '',
    managerSupport ? `Apoio do gestor: ${sentence(managerSupport)}` : '',
    nextFollowUp ? `Próximo acompanhamento: ${nextFollowUp}.` : '',
  ].filter(Boolean);

  if (!closingParts.length) {
    const clarity = excerpt(response.needsToUnderstand);
    if (clarity) closingParts.push(`Na perspectiva do colaborador, o principal ponto de clareza para o início foi: ${sentence(clarity)}`);
  }

  return paragraphs([
    openingParts.join(' '),
    autonomyParts.join(' '),
    closingParts.join(' '),
  ]);
}

export function buildNinetyDaySummary(
  payloadInput: unknown,
  responseInput?: unknown,
  directionLabel?: string,
  conversationAdjustment?: string,
  mainAgreement?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const reflections = (response.reflections ?? {}) as JsonObject;

  const finalObservation = text(conversationAdjustment)
    || text(payload.conversationAdjustment)
    || text(payload.observableAdvances);
  const strengths = text(payload.strengths);
  const development = text(payload.developmentPriorities)
    || text(reflections.nextCyclePriority);
  const direction = text(directionLabel)
    || directionLabels[text(payload.agreedDirection)]
    || text(payload.legacyDirection);
  const agreement = text(mainAgreement)
    || text(payload.mainAgreement)
    || text(payload.workAgreements);
  const managerSupport = text(payload.managerSupport || payload.managerCommitments);
  const nextFollowUp = formatDate(payload.nextFollowUp);
  const routeAdjustment = text(payload.possibleRouteAdjustment);

  const observationParagraph = [
    finalObservation ? sentence(finalObservation) : '',
    strengths ? `Entre as forças observadas estão ${sentence(strengths)}` : '',
  ].filter(Boolean).join(' ');

  const directionParagraph = [
    direction ? `A direção acordada para o próximo ciclo é ${sentence(direction.toLocaleLowerCase('pt-BR'))}` : '',
    development ? `O principal foco de desenvolvimento é ${sentence(development)}` : routeAdjustment ? `O foco de evolução é ${sentence(routeAdjustment)}` : '',
  ].filter(Boolean).join(' ');

  const agreementParagraph = [
    agreement ? `Como acordo principal, ${sentence(agreement)}` : '',
    managerSupport ? `Como apoio do gestor, ${sentence(managerSupport)}` : '',
    nextFollowUp ? `Próximo acompanhamento: ${nextFollowUp}.` : '',
  ].filter(Boolean).join(' ');

  return paragraphs([observationParagraph, directionParagraph, agreementParagraph]);
}

export function buildCompetencyFinalSummary(payloadInput: unknown) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const assessments = (payload.finalAssessments ?? payload.initialAssessments ?? {}) as JsonObject;

  const scored = Object.entries(competencyLabels)
    .map(([key, label]) => {
      const assessment = (assessments[key] ?? {}) as JsonObject;
      const score = Number(assessment.score);
      return Number.isFinite(score)
        ? { key, label, score, band: text(assessment.band), evidence: text(assessment.evidence), nextStep: text(assessment.nextStep) }
        : null;
    })
    .filter(Boolean) as Array<{ key: string; label: string; score: number; band: string; evidence: string; nextStep: string }>;

  const meetsOrExceeds = scored.filter((item) => item.band === 'meets' || item.band === 'exceeds').length;
  const strongest = scored.slice().sort((a, b) => b.score - a.score).slice(0, 2).map((item) => item.label);
  const resultParts = scored.length
    ? [
        `Na avaliação de competências, ${meetsOrExceeds} de ${scored.length} competências atenderam ou superaram a expectativa do ciclo.`,
        strongest.length ? `Os principais destaques foram ${strongest.join(' e ')}.` : '',
      ].filter(Boolean).join(' ')
    : '';

  const development = text(payload.developmentPriority);
  const adjustment = text(payload.conversationAdjustment);
  const agreement = text(payload.employeeAgreements);
  const support = text(payload.managerSupport);
  const returnDate = formatDate(payload.returnDate);

  const developmentParagraph = [
    development ? `O foco de desenvolvimento definido foi ${sentence(development)}` : '',
    adjustment ? `Após a conversa, ${sentence(adjustment)}` : '',
  ].filter(Boolean).join(' ');

  const agreementParagraph = [
    agreement ? `Acordo principal do próximo ciclo: ${sentence(agreement)}` : '',
    support ? `Apoio do gestor: ${sentence(support)}` : '',
    returnDate ? `Retorno previsto: ${returnDate}.` : '',
  ].filter(Boolean).join(' ');

  return paragraphs([resultParts, developmentParagraph, agreementParagraph]);
}

export function buildPdiFinalSummary(payloadInput: unknown, responseInput?: unknown) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const overview = (response.overview ?? response) as JsonObject;
  const priorities = Array.isArray(payload.priorities) ? payload.priorities as JsonObject[] : [];
  const review = (payload.review ?? {}) as JsonObject;
  const reviews = Array.isArray(review.objectiveReviews) ? review.objectiveReviews as JsonObject[] : [];

  if (reviews.length) {
    const statusLabels: Record<string, string> = {
      advanced: 'avançou',
      adjusted: 'foi ajustada',
      continue: 'continua no próximo ciclo',
    };
    const reviewParts = priorities.map((priority, index) => {
      const item = reviews.find((candidate) => candidate.priorityId === priority.id) ?? reviews[index] ?? {};
      const status = statusLabels[text(item.status)] ?? text(item.status);
      const evidence = excerpt(item.evidence, 180);
      const title = text(priority.title) || `Prioridade ${index + 1}`;
      return status || evidence ? `${title}: ${[status, evidence].filter(Boolean).join(' — ')}` : '';
    }).filter(Boolean);

    return paragraphs([
      reviewParts.length ? `Na revisão do PDI, ${reviewParts.join('; ')}.` : '',
      text(review.learningToPreserve) ? `Aprendizado a preservar: ${sentence(review.learningToPreserve)}` : '',
      text(review.nextDirection) ? `Próxima direção: ${sentence(review.nextDirection)}` : '',
    ]);
  }

  const direction = text(payload.developmentDirection) || text(overview.desiredDevelopment);
  const priorityParts = priorities.slice(0, 3).map((priority, index) => {
    const title = text(priority.title) || `Prioridade ${index + 1}`;
    const desired = text(priority.desiredState);
    const practice = text(priority.practice);
    const evidence = text(priority.evidence);
    const details = [
      desired ? `objetivo: ${desired}` : '',
      practice ? `prática: ${practice}` : '',
      evidence ? `evidência: ${evidence}` : '',
    ].filter(Boolean);
    return details.length ? `${title} — ${details.join(' | ')}` : title;
  });

  const adjustment = text(payload.conversationAdjustment);
  const collaboratorCommitment = text(payload.collaboratorCommitment);
  const managerCommitment = text(payload.managerCommitment);
  const autonomy = text(payload.autonomyAgreement);
  const formalReview = formatDate(payload.formalReviewDate);

  return paragraphs([
    direction ? `O PDI está direcionado a ${sentence(direction)}` : '',
    priorityParts.length ? `Prioridades do ciclo: ${priorityParts.join('; ')}.` : '',
    [
      adjustment ? `Ajuste validado na conversa: ${sentence(adjustment)}` : '',
      collaboratorCommitment ? `Compromisso do colaborador: ${sentence(collaboratorCommitment)}` : '',
      managerCommitment ? `Compromisso do gestor: ${sentence(managerCommitment)}` : '',
      autonomy ? `Acordo de autonomia: ${sentence(autonomy)}` : '',
      formalReview ? `Revisão formal prevista para ${formalReview}.` : '',
    ].filter(Boolean).join(' '),
  ]);
}

export function buildFeedbackFinalSummary(payloadInput: unknown, _responseInput?: unknown) {
  const payload = (payloadInput ?? {}) as JsonObject;
  if (payload.essentialRecordManuallyAdjusted && text(payload.essentialRecord)) {
    return text(payload.essentialRecord);
  }
  const flow = text(payload.feedbackFlow);
  const adjustment = text(payload.conversationAdjustment);
  const agreement = text(payload.mainAgreement || payload.nextMoves);
  const managerSupport = text(payload.managerCommitment);
  const futureDirection = text(payload.futureDirection || payload.expectedDirection);

  if (flow === 'recognition') {
    return paragraphs([
      [
        text(payload.concreteContribution) ? `Contribuição reconhecida: ${sentence(payload.concreteContribution)}` : '',
        text(payload.generatedImpact) ? `Impacto: ${sentence(payload.generatedImpact)}` : '',
        text(payload.recognizedStrengths) ? `Fortalezas evidenciadas: ${sentence(payload.recognizedStrengths)}` : '',
      ].filter(Boolean).join(' '),
      [
        adjustment ? `Na conversa, ${sentence(adjustment)}` : '',
        agreement ? `Próximo movimento acordado: ${sentence(agreement)}` : '',
        futureDirection ? `Direção futura: ${sentence(futureDirection)}` : '',
        managerSupport ? `Apoio do gestor: ${sentence(managerSupport)}` : '',
      ].filter(Boolean).join(' '),
    ]);
  }

  return paragraphs([
    [
      text(payload.situationReason) ? `Situação tratada: ${sentence(payload.situationReason)}` : '',
      text(payload.observedFacts) ? `Fatos observados: ${sentence(payload.observedFacts)}` : '',
      text(payload.behavioralImpact) ? `Impacto percebido: ${sentence(payload.behavioralImpact)}` : '',
    ].filter(Boolean).join(' '),
    [
      futureDirection ? `Direção esperada: ${sentence(futureDirection)}` : '',
      adjustment ? `Após a conversa, ${sentence(adjustment)}` : '',
      agreement ? `Acordo principal: ${sentence(agreement)}` : '',
      managerSupport ? `Apoio do gestor: ${sentence(managerSupport)}` : '',
    ].filter(Boolean).join(' '),
  ]);
}

export function buildPdiAgreementSummary(
  payloadInput: unknown,
  responseInput: unknown,
  conversationAdjustment?: string,
) {
  const existing = (payloadInput ?? {}) as JsonObject;
  const payload = { ...existing, conversationAdjustment: conversationAdjustment ?? existing.conversationAdjustment };
  return buildPdiFinalSummary(payload, responseInput);
}

export function buildPdiReviewSummary(
  prioritiesInput: unknown,
  reviewsInput: unknown,
  nextDirection?: string,
  learningToPreserve?: string,
) {
  return buildPdiFinalSummary({
    priorities: Array.isArray(prioritiesInput) ? prioritiesInput : [],
    review: {
      objectiveReviews: Array.isArray(reviewsInput) ? reviewsInput : [],
      nextDirection,
      learningToPreserve,
    },
  });
}

export function buildFeedbackEssentialRecord(
  payloadInput: unknown,
  responseInput: unknown,
  conversationAdjustment?: string,
) {
  return buildFeedbackFinalSummary(
    {
      ...((payloadInput ?? {}) as JsonObject),
      conversationAdjustment: conversationAdjustment ?? ((payloadInput ?? {}) as JsonObject).conversationAdjustment,
    },
    responseInput,
  );
}

export function buildPdiSourceContext(sourcesInput: unknown) {
  const candidates = Array.isArray(sourcesInput) ? sourcesInput as JsonObject[] : [];
  const seen = new Set<string>();
  const sources = candidates
    .filter((source) => !source.deleted_at && (
      (['ninety_days', 'competencies'].includes(source.module_type) && source.status === 'completed')
      || (source.module_type === 'pdi' && ['completed', 'archived'].includes(source.status))
    ))
    .slice()
    .sort((a, b) => text(b.completed_at || b.created_at).localeCompare(text(a.completed_at || a.created_at)))
    .filter((source) => {
      if (seen.has(source.module_type)) return false;
      seen.add(source.module_type);
      return true;
    });

  const readings = sources.map((source) => {
    const payload = (source.payload ?? {}) as JsonObject;
    const summary = source.module_type === 'ninety_days'
      ? buildNinetyDaySummary(payload)
      : source.module_type === 'competencies'
        ? buildCompetencyFinalSummary(payload)
        : buildPdiFinalSummary(payload);
    const moduleLabels: Record<string, string> = {
      ninety_days: 'Avaliação de 90 dias', competencies: 'Competências', pdi: 'PDI anterior',
    };
    return { id: text(source.id), label: text(source.cycle_label) || moduleLabels[source.module_type], summary };
  });
  const sourcePayloads = sources.map((source) => (source.payload ?? {}) as JsonObject);
  const firstValue = (read: (payload: JsonObject) => unknown) => sourcePayloads.map(read).map(text).find(Boolean) || '';

  return {
    sources: readings,
    strengthsToPreserve: firstValue((payload) => payload.strengthsToPreserve || payload.recognizedStrengths || payload.strengthSummary || payload.strengths),
    developmentDirection: firstValue((payload) => payload.review?.nextDirection || payload.developmentPriority || payload.developmentPriorities || payload.developmentDirection),
    managerSupport: firstValue((payload) => payload.managerSupport || payload.managerCommitments || payload.managerCommitment),
    sourceReadings: paragraphs(readings.filter((reading) => reading.summary).map((reading) => `${reading.label}\n${reading.summary}`)),
  };
}

export function buildMarcoZeroConversationGuide(
  payloadInput: unknown,
  responseInput: unknown,
  employeeName?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;

  const recognition = unique([
    text(response.motivation),
    text(response.firstContribution),
    text(payload.expectedContribution),
  ]).map((item) => excerpt(item)).slice(0, 3);

  const questions = unique([
    text(response.needsToUnderstand) ? `Você trouxe como ponto de clareza: “${excerpt(response.needsToUnderstand)}”. O que precisa ficar combinado hoje para você sair seguro sobre isso?` : '',
    text(response.bestConditions) ? `Você disse que trabalha melhor nestas condições: “${excerpt(response.bestConditions)}”. O que devemos preservar na rotina e o que pode ser inviável no contexto real?` : '',
    text(response.contextPreference) ? `Sobre contexto e orientações, você prefere: “${excerpt(response.contextPreference)}”. Como traduzimos isso para uma combinação prática entre nós?` : '',
    text(response.supportNeeded) ? `Você indicou este apoio: “${excerpt(response.supportNeeded)}”. O que precisa vir do gestor e o que fica sob sua autonomia?` : '',
    text(response.risksExpectations) ? `Você colocou esta preocupação ou expectativa: “${excerpt(response.risksExpectations)}”. O que precisamos esclarecer ou prevenir desde já?` : '',
  ]).filter(Boolean).slice(0, 6);

  const managerDirections = unique([
    text(payload.purpose) ? `Reforce o propósito do trabalho: ${text(payload.purpose)}` : '',
    text(payload.first30Days) ? `Feche prioridades iniciais claras: ${text(payload.first30Days)}` : '',
    text(payload.autonomy) ? `Deixe explícito o espaço de autonomia: ${text(payload.autonomy)}` : '',
    text(payload.involveManager) ? `Combine quando o gestor deve ser envolvido: ${text(payload.involveManager)}` : '',
  ]).filter(Boolean);

  return {
    objective: 'Sair da conversa com clareza sobre propósito, prioridades, autonomia, forma de trabalho e apoio necessário para o início do ciclo.',
    recognition,
    questions,
    managerDirections,
    watchouts: managerConversationLens(employeeName),
    closing: [
      'Confirmar o que ficou claro e o que mudou em relação à preparação inicial.',
      'Definir um acordo principal de trabalho, sem repetir todos os campos já registrados.',
      'Combinar somente o apoio específico do gestor que realmente seja necessário.',
      'Registrar próximo acompanhamento apenas quando fizer sentido para o momento.',
    ],
  };
}

export function buildNinetyDayConversationGuide(
  payloadInput: unknown,
  responseInput: unknown,
  employeeName?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const reflections = (response.reflections ?? {}) as JsonObject;
  const managerRatings = (payload.managerRatings ?? {}) as Record<string, number>;
  const participantRatings = (response.ratings ?? {}) as Record<string, number>;

  const recognition = unique([
    text(payload.observableAdvances),
    text(payload.strengths),
    text(reflections.proudContribution),
    text(reflections.advancesLearning),
  ]).map((item) => excerpt(item)).slice(0, 3);

  const questions: string[] = [];
  Object.entries(ninetyDayDimensionLabels).forEach(([key, label]) => {
    const manager = Number(managerRatings[key] ?? 0);
    const participant = Number(participantRatings[key] ?? 0);
    if (!manager || !participant || manager === participant) return;

    questions.push(
      participant < manager
        ? `Em ${label}, você se avaliou em ${participant} e minha leitura foi ${manager}. O que faz você se perceber abaixo da minha avaliação? Que exemplos sustentam essa leitura?`
        : `Em ${label}, sua autoavaliação foi ${participant} e minha leitura foi ${manager}. Quais situações sustentam sua percepção? O que precisamos observar juntos para alinhar essa referência?`,
    );
  });

  if (text(reflections.obstaclesDependencies)) {
    questions.push(`Aprofunde o desafio que você registrou: “${excerpt(reflections.obstaclesDependencies)}”. Em que situação real isso mais aparece e o que ajudaria a destravar?`);
  }
  if (text(reflections.nextCyclePriority)) {
    questions.push(`Você indicou como prioridade: “${excerpt(reflections.nextCyclePriority)}”. O que seria uma evidência concreta de avanço nas próximas semanas?`);
  }
  if (text(reflections.supportDifference)) {
    questions.push(`Você registrou este apoio como relevante: “${excerpt(reflections.supportDifference)}”. O que precisa vir do gestor e o que pode ficar sob sua autonomia?`);
  }

  const managerDirections = unique([
    text(payload.developmentPriorities) ? `Transforme o ponto de desenvolvimento em um movimento observável: ${text(payload.developmentPriorities)}` : '',
    text(payload.possibleRouteAdjustment) ? `Teste o ajuste de rota já identificado: ${text(payload.possibleRouteAdjustment)}` : '',
    text(payload.strengths) ? `Preserve as fortalezas reconhecidas enquanto amplia repertório: ${text(payload.strengths)}` : '',
  ]).filter(Boolean);

  const development = excerpt(payload.developmentPriorities);
  return {
    objective: development
      ? `Reconhecer a consolidação já demonstrada e sair com um acordo claro sobre o próximo avanço: ${development}`
      : 'Reconhecer os avanços do ciclo, alinhar diferenças de percepção e sair com direção clara para o próximo período.',
    recognition,
    questions: questions.slice(0, 6),
    managerDirections,
    watchouts: managerConversationLens(employeeName),
    closing: [
      'Confirmar a direção do ciclo: manter, ajustar, acelerar ou recalibrar.',
      'Definir um acordo principal observável no trabalho real.',
      'Combinar somente o apoio do gestor que for realmente necessário, preservando autonomia.',
      'Registrar uma data de retomada apenas se houver motivo concreto para acompanhamento.',
    ],
  };
}

export function buildCompetencyConversationGuide(
  payloadInput: unknown,
  responseInput: unknown,
  employeeName?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const assessments = (payload.finalAssessments ?? payload.initialAssessments ?? {}) as JsonObject;
  const participantCompetencies = (response.competencies ?? {}) as JsonObject;
  const participantOverview = (response.overview ?? {}) as JsonObject;

  const scored = Object.entries(competencyLabels)
    .map(([key, label]) => {
      const assessment = (assessments[key] ?? {}) as JsonObject;
      const score = Number(assessment.score);
      return Number.isFinite(score) ? { key, label, score, assessment } : null;
    })
    .filter(Boolean) as Array<{ key: string; label: string; score: number; assessment: JsonObject }>;

  const strongest = scored.slice().sort((a, b) => b.score - a.score).slice(0, 2);
  const recognition = strongest
    .map((item) => item.assessment.evidence ? `${item.label}: ${excerpt(item.assessment.evidence)}` : item.label);

  const questions: string[] = [];
  Object.entries(competencyLabels).forEach(([key, label]) => {
    const manager = (assessments[key] ?? {}) as JsonObject;
    const participant = (participantCompetencies[key] ?? {}) as JsonObject;
    const managerBand = text(manager.band);
    const participantBand = text(participant.band);
    if (!managerBand || !participantBand || managerBand === participantBand) return;

    questions.push(
      `Em ${label}, sua percepção foi “${competencyBandLabels[participantBand] ?? participantBand}” e minha leitura foi “${competencyBandLabels[managerBand] ?? managerBand}”. Quais evidências explicam essa diferença e qual referência devemos levar para o próximo ciclo?`,
    );
  });

  if (text(participantOverview.desiredDevelopment)) {
    questions.push(`Você indicou este desenvolvimento como relevante: “${excerpt(participantOverview.desiredDevelopment)}”. Como isso se conecta às competências avaliadas e ao trabalho real?`);
  }

  const developmentCandidates = scored
    .slice()
    .sort((a, b) => a.score - b.score)
    .filter((item) => text(item.assessment.nextStep))
    .slice(0, 2);

  const managerDirections = developmentCandidates.length
    ? developmentCandidates.map((item) => `${item.label}: ${text(item.assessment.nextStep)}`)
    : ['Evite transformar todas as sete competências em plano de ação; escolha no máximo uma prioridade de desenvolvimento para o próximo ciclo.'];

  return {
    objective: 'Validar a leitura final das competências, explorar somente divergências relevantes e sair com uma prioridade de desenvolvimento clara.',
    recognition,
    questions: questions.slice(0, 6),
    managerDirections,
    watchouts: managerConversationLens(employeeName),
    closing: [
      'Confirmar as notas finais apenas depois da conversa.',
      'Escolher uma prioridade de desenvolvimento quando houver necessidade; não criar sete frentes simultâneas.',
      'Registrar um acordo principal e apoio do gestor somente se forem necessários.',
      'Usar o resumo final como síntese; os comentários detalhados permanecem dentro de cada competência.',
    ],
  };
}

export function buildPdiConversationGuide(
  payloadInput: unknown,
  responseInput: unknown,
  employeeName?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const overview = (response.overview ?? response) as JsonObject;
  const priorities = Array.isArray(payload.priorities) ? payload.priorities as JsonObject[] : [];

  const recognition = unique([
    text(payload.strengthsToPreserve),
    text(overview.recognizedStrengths),
    text(payload.currentMoment),
  ]).map((item) => excerpt(item)).slice(0, 3);

  const questions = unique([
    text(overview.desiredDevelopment) ? `Você indicou que gostaria de desenvolver: “${excerpt(overview.desiredDevelopment)}”. Qual mudança concreta no trabalho mostraria que isso avançou?` : '',
    text(overview.practicalExperience) ? `Você sugeriu esta experiência prática: “${excerpt(overview.practicalExperience)}”. Ela é viável e suficiente para gerar a evidência que buscamos?` : '',
    text(overview.desiredAutonomy) ? `Você busca mais autonomia em: “${excerpt(overview.desiredAutonomy)}”. Que limite de decisão podemos combinar para este ciclo?` : '',
    text(overview.managerSupport) ? `Você pediu este apoio do gestor: “${excerpt(overview.managerSupport)}”. Qual é o mínimo necessário para apoiar sem reduzir sua autonomia?` : '',
  ]).filter(Boolean).slice(0, 6);

  const managerDirections = priorities.slice(0, 3).map((priority, index) => {
    const title = text(priority.title) || `Prioridade ${index + 1}`;
    const desired = text(priority.desiredState);
    return desired ? `${title}: confirme se o objetivo “${desired}” está claro, observável e ligado ao trabalho real.` : `${title}: confirme objetivo e evidência antes de ativar o plano.`;
  });

  return {
    objective: 'Transformar a direção de desenvolvimento em poucas prioridades praticáveis, com evidências claras e autonomia compatível com o momento profissional.',
    recognition,
    questions,
    managerDirections,
    watchouts: managerConversationLens(employeeName),
    closing: [
      'Manter no máximo três prioridades reais para o ciclo.',
      'Confirmar prática e evidência de cada prioridade; evitar metas abstratas.',
      'Definir compromisso do colaborador, apoio do gestor e autonomia sem criar microgestão.',
      'Registrar a data de revisão formal e deixar o acompanhamento cotidiano fora do PDI.',
    ],
  };
}

export function buildFeedbackConversationGuide(
  payloadInput: unknown,
  responseInput: unknown,
  employeeName?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const recognitionFlow = text(payload.feedbackFlow) === 'recognition';

  const recognition = unique([
    recognitionFlow ? text(payload.concreteContribution) : text(payload.observedFacts),
    recognitionFlow ? text(payload.generatedImpact) : text(payload.behavioralImpact),
    text(payload.recognizedStrengths),
  ]).map((item) => excerpt(item)).slice(0, 3);

  const questions = unique([
    text(response.importantContext) ? `Você trouxe este contexto: “${excerpt(response.importantContext)}”. O que ele muda na leitura da situação?` : '',
    text(response.perspective) ? `Sua perspectiva foi: “${excerpt(response.perspective)}”. Que fatos precisamos considerar juntos antes de fechar o próximo movimento?` : '',
    text(response.nextMovement || response.nextStep) ? `Você indicou este próximo movimento: “${excerpt(response.nextMovement || response.nextStep)}”. O que precisa acontecer para ele ser viável?` : '',
  ]).filter(Boolean).slice(0, 5);

  return {
    objective: recognitionFlow
      ? 'Reconhecer de forma específica a contribuição e o impacto, deixando claro o que merece ser preservado e ampliado.'
      : 'Alinhar fatos, impacto e expectativa futura, com um acordo proporcional ao que precisa mudar.',
    recognition,
    questions,
    managerDirections: recognitionFlow
      ? [text(payload.futureDirection) ? `Conecte o reconhecimento à direção futura: ${text(payload.futureDirection)}` : 'Mantenha o reconhecimento específico, sustentado por fatos e impacto.']
      : [text(payload.expectedDirection) ? `Deixe explícita a direção esperada: ${text(payload.expectedDirection)}` : 'Conclua com comportamento ou resultado esperado de forma observável.'],
    watchouts: managerConversationLens(employeeName),
    closing: [
      'Registrar somente o que a conversa acrescentou ou alterou.',
      'Definir um acordo principal ou próximo movimento quando necessário.',
      'Combinar apoio do gestor somente se ele fizer parte da solução.',
      'Usar a síntese final como registro oficial; os fatos detalhados ficam preservados no módulo.',
    ],
  };
}

export function buildTalentExecutiveDraft(sourceSnapshotInput: unknown) {
  const sources = Array.isArray(sourceSnapshotInput) ? sourceSnapshotInput as JsonObject[] : [];
  const signals = unique(
    sources.flatMap((source) => Array.isArray(source.signals) ? source.signals.map(text) : []).filter(Boolean),
  );
  const sourceLabels = unique(sources.map((source) => text(source.moduleLabel || source.cycleLabel)).filter(Boolean));
  const firstThree = signals.slice(0, 3);

  return {
    headline: firstThree[0] || 'Trajetória consolidada a partir de registros formais.',
    summary: firstThree.length
      ? `Evidências consolidadas da trajetória: ${firstThree.join(' · ')}`
      : 'Síntese construída a partir das fontes formais selecionadas para este ciclo.',
    strengths: signals.slice(0, 2).join(' · '),
    managerConclusion: sourceLabels.length
      ? `Leitura executiva sustentada por ${sources.length} fonte${sources.length === 1 ? '' : 's'} formal${sources.length === 1 ? '' : 'is'} (${sourceLabels.join(', ')}). Revise o texto antes de apresentar.`
      : 'Revise as fontes formais e registre a conclusão gerencial antes de apresentar.',
    delivery1: signals[0] || '',
    delivery2: signals[1] || '',
    delivery3: signals[2] || '',
    indicator1: '',
    indicator2: '',
    indicator3: '',
  };
}
