type JsonObject = Record<string, any>;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function push(lines: string[], label: string, value: unknown) {
  const normalized = text(value);
  if (normalized) lines.push(`${label}: ${normalized}`);
}

function unique(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

export function buildNinetyDaySummary(
  payloadInput: unknown,
  responseInput: unknown,
  directionLabel?: string,
  conversationAdjustment?: string,
  mainAgreement?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const reflections = (response.reflections ?? {}) as JsonObject;
  const lines: string[] = [];

  push(lines, 'Avanços observados', payload.observableAdvances);
  push(lines, 'Forças que já aparecem', payload.strengths);
  push(lines, 'Prioridade de desenvolvimento', payload.developmentPriorities);
  push(lines, 'Leitura do colaborador sobre avanços', reflections.advancesLearning);
  push(lines, 'Principal prioridade percebida pelo colaborador', reflections.nextCyclePriority);
  push(lines, 'Apoio que faria diferença', reflections.supportDifference);
  push(lines, 'Direção acordada', directionLabel);
  push(lines, 'Ajuste relevante após a conversa', conversationAdjustment);
  push(lines, 'Acordo principal do próximo ciclo', mainAgreement);

  return lines.join('\n');
}

export function buildPdiAgreementSummary(
  payloadInput: unknown,
  responseInput: unknown,
  conversationAdjustment?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const overview = (response.overview ?? {}) as JsonObject;
  const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
  const lines: string[] = [];

  push(lines, 'Direção de desenvolvimento', payload.developmentDirection);
  priorities.forEach((priority: JsonObject, index: number) => {
    const parts = [
      text(priority.desiredState) ? `objetivo: ${text(priority.desiredState)}` : '',
      text(priority.practice) ? `prática: ${text(priority.practice)}` : '',
      text(priority.evidence) ? `evidência: ${text(priority.evidence)}` : '',
    ].filter(Boolean);
    if (parts.length) lines.push(`Prioridade ${index + 1} — ${text(priority.title) || 'desenvolvimento'}: ${parts.join(' | ')}`);
  });
  push(lines, 'Desenvolvimento desejado pelo colaborador', overview.desiredDevelopment);
  push(lines, 'Experiência prática sugerida pelo colaborador', overview.practicalExperience);
  push(lines, 'Apoio solicitado ao gestor', overview.managerSupport);
  push(lines, 'Ajuste realizado na conversa', conversationAdjustment);

  return lines.join('\n');
}

export function buildPdiReviewSummary(
  prioritiesInput: unknown,
  reviewsInput: unknown,
  nextDirection?: string,
) {
  const priorities = Array.isArray(prioritiesInput) ? prioritiesInput as JsonObject[] : [];
  const reviews = Array.isArray(reviewsInput) ? reviewsInput as JsonObject[] : [];
  const labels: Record<string, string> = {
    advanced: 'Avançou',
    adjusted: 'Ajustado',
    continue: 'Continua no próximo ciclo',
  };
  const lines: string[] = [];

  priorities.forEach((priority, index) => {
    const review = reviews.find((item) => item.priorityId === priority.id) ?? reviews[index] ?? {};
    const status = labels[text(review.status)] ?? text(review.status);
    const evidence = text(review.evidence);
    if (status || evidence) {
      lines.push(`${text(priority.title) || `Prioridade ${index + 1}`}: ${[status, evidence].filter(Boolean).join(' — ')}`);
    }
  });
  push(lines, 'Direção seguinte', nextDirection);
  return lines.join('\n');
}

export function buildFeedbackEssentialRecord(
  payloadInput: unknown,
  responseInput: unknown,
  conversationAdjustment?: string,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const lines: string[] = [];

  if (text(payload.feedbackFlow) === 'recognition') {
    push(lines, 'Contribuição reconhecida', payload.concreteContribution);
    push(lines, 'Impacto gerado', payload.generatedImpact);
    push(lines, 'Fortalezas reconhecidas', payload.recognizedStrengths);
    push(lines, 'Competências ou valores relacionados', payload.competenciesValues);
    push(lines, 'Perspectiva do colaborador', response.importantContext || response.recognizedContribution);
    push(lines, 'Impacto percebido pelo colaborador', response.perceivedImpact || response.meaningfulChange);
  } else {
    push(lines, 'Situação', payload.situationReason);
    push(lines, 'Fatos observados', payload.observedFacts);
    push(lines, 'Impacto', payload.behavioralImpact);
    push(lines, 'Direção esperada', payload.expectedDirection);
    push(lines, 'Perspectiva do colaborador', response.importantContext || response.perspective || response.currentMoment);
    push(lines, 'Próximo movimento percebido pelo colaborador', response.nextMovement || response.nextStep);
  }

  push(lines, 'Ajuste após a conversa', conversationAdjustment);
  return lines.join('\n');
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


const ninetyDayDimensionLabels: Record<string, string> = {
  roleClarity: 'clareza do papel',
  deliveryQuality: 'entregas e qualidade',
  autonomyProtagonism: 'autonomia e protagonismo',
  integrationCollaboration: 'integração e colaboração',
  conditionsSupport: 'condições e apoio',
};

function excerpt(value: unknown, max = 190) {
  const normalized = text(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trim()}…`;
}

function managerConversationLens(employeeName?: string) {
  const name = (employeeName ?? '').toLocaleLowerCase('pt-BR');

  const directCompetitive = [
    'Apresente sua leitura com clareza, mas abra espaço real para a pessoa expor a própria interpretação antes de fechar qualquer conclusão.',
    'Se houver discordância, evite transformar a conversa em disputa de quem está certo; volte para fatos, exemplos e acordos observáveis.',
    'Respeite franqueza e posicionamentos diretos. O objetivo é negociar um próximo movimento, não vencer a discussão.',
  ];

  if (name.includes('khaoan') || name.includes('cauan')) {
    return [
      ...directCompetitive,
      'Use comunicação objetiva e estruturada. Deixe explícitos papel, área de influência, autonomia e em quais situações o gestor deve ser envolvido.',
      'Conecte o desenvolvimento a responsabilidade real e espaço de decisão, evitando controle permanente ou microgestão.',
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
  ]).slice(0, 3);

  const questions: string[] = [];
  Object.entries(ninetyDayDimensionLabels).forEach(([key, label]) => {
    const manager = Number(managerRatings[key] ?? 0);
    const participant = Number(participantRatings[key] ?? 0);
    if (!manager || !participant || manager === participant) return;

    if (participant < manager) {
      questions.push(
        `Em ${label}, você se avaliou em ${participant} e minha leitura foi ${manager}. O que faz você se perceber abaixo da minha avaliação? Que exemplos sustentam essa leitura?`,
      );
    } else {
      questions.push(
        `Em ${label}, sua autoavaliação foi ${participant} e minha leitura foi ${manager}. Quais situações sustentam sua percepção? O que precisamos observar juntos para alinhar essa referência?`,
      );
    }
  });

  const obstacles = excerpt(reflections.obstaclesDependencies);
  if (obstacles) {
    questions.push(
      `Aprofunde o ponto que você trouxe sobre obstáculos, dúvidas ou dependências: “${obstacles}”. Em que situação real isso mais aparece hoje e o que ajudaria a destravar?`,
    );
  }

  const nextPriority = excerpt(reflections.nextCyclePriority);
  if (nextPriority) {
    questions.push(
      `Você indicou como prioridade do próximo ciclo: “${nextPriority}”. O que seria uma evidência concreta de avanço nisso nas próximas semanas?`,
    );
  }

  const support = excerpt(reflections.supportDifference);
  if (support) {
    questions.push(
      `Você registrou que este apoio faria diferença: “${support}”. O que precisa vir do gestor e o que pode ficar sob sua autonomia?`,
    );
  }

  const advances = excerpt(reflections.advancesLearning);
  if (advances) {
    questions.push(
      `Do aprendizado que você descreveu — “${advances}” — o que já virou comportamento recorrente e o que ainda precisa ser consolidado?`,
    );
  }

  const managerDirections = unique([
    text(payload.developmentPriorities)
      ? `Transforme o ponto de desenvolvimento em um movimento observável: ${text(payload.developmentPriorities)}`
      : '',
    text(payload.possibleRouteAdjustment)
      ? `Teste o ajuste de rota já identificado: ${text(payload.possibleRouteAdjustment)}`
      : '',
    text(payload.strengths)
      ? `Preserve as fortalezas reconhecidas enquanto amplia repertório: ${text(payload.strengths)}`
      : '',
  ]);

  const development = excerpt(payload.developmentPriorities);
  const objective = development
    ? `Reconhecer a consolidação já demonstrada e sair da conversa com um acordo claro sobre o próximo avanço: ${development}`
    : 'Reconhecer os avanços do ciclo, alinhar diferenças de percepção e sair com uma direção clara para o próximo período.';

  const closing = [
    'Confirmar a direção do ciclo: manter, ajustar, acelerar ou recalibrar.',
    'Definir um acordo principal que possa ser observado no trabalho real, sem criar uma lista excessiva de tarefas.',
    'Combinar somente o apoio do gestor que for realmente necessário e preservar o espaço de autonomia.',
    'Registrar uma data de retomada apenas se houver motivo concreto para acompanhamento.',
  ];

  return {
    objective,
    recognition,
    questions: questions.slice(0, 6),
    managerDirections,
    watchouts: managerConversationLens(employeeName),
    closing,
  };
}
