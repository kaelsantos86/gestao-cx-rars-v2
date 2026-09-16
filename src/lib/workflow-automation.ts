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
