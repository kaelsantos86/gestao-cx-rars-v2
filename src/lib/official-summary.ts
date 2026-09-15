type JsonObject = Record<string, any>;

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function add(lines: string[], label: string, value: unknown) {
  const normalized = text(value);
  if (normalized) lines.push(`${label}: ${normalized}`);
}

function score(value: unknown) {
  return typeof value === 'number'
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : text(value);
}

const competencyNames: Record<string, string> = {
  cooperation: 'Cooperação',
  systemic_action: 'Atuação Sistêmica',
  people_centered: 'Pessoas no Centro',
  local_development: 'Desenvolvimento Local',
  constant_evolution: 'Evolução Constante',
  ethics: 'Ética',
  transparency: 'Transparência',
};

const bandNames: Record<string, string> = {
  not_meets: 'Não atende',
  partial: 'Atende parcialmente',
  meets: 'Atende à expectativa',
  exceeds: 'Supera a expectativa',
};

const directionNames: Record<string, string> = {
  maintain: 'Manter',
  adjust: 'Ajustar',
  accelerate: 'Acelerar',
  recalibrate: 'Recalibrar',
};

const pdiAxisNames: Record<string, string> = {
  business_repertoire: 'Repertório e negócio',
  autonomy_decision: 'Autonomia e decisão',
  systemic_influence: 'Atuação sistêmica e influência',
  experience_data_innovation: 'Experiência, dados e inovação',
  communication_relationships_leadership: 'Comunicação, relações e liderança',
  maturity_trajectory: 'Maturidade e trajetória',
};

const pdiReviewNames: Record<string, string> = {
  advanced: 'Avançou',
  adjusted: 'Ajustado',
  continue: 'Continua no próximo ciclo',
};

export function buildOfficialSummary(
  moduleType: string,
  payloadInput: unknown,
  responseInput?: unknown,
  cycleLabel?: string | null,
) {
  const payload = (payloadInput ?? {}) as JsonObject;
  const response = (responseInput ?? {}) as JsonObject;
  const lines: string[] = [];

  if (cycleLabel) add(lines, 'Ciclo', cycleLabel);

  if (moduleType === 'marco_zero') {
    add(lines, 'Contexto', payload.moment);
    add(lines, 'Propósito', payload.purpose);
    add(lines, 'Contribuição esperada', payload.expectedContribution);
    add(lines, 'Critérios de sucesso', payload.qualityCriteria);
    add(lines, 'Prioridades iniciais', payload.first30Days);
    add(lines, 'Autonomia combinada', payload.autonomy);
    add(lines, 'Quando envolver o gestor', payload.involveManager);
    add(lines, 'Forma de trabalho', payload.waysOfWorking);
    add(lines, 'Compromissos do gestor', payload.managerCommitments);
    add(lines, 'Acordos recíprocos', payload.legacyV1?.reciprocalAgreements);
    add(lines, 'Ponto de clareza trazido pelo colaborador', response.needsToUnderstand);
    add(lines, 'Apoio inicial solicitado', response.supportNeeded);
    add(lines, 'Primeira contribuição indicada', response.firstContribution);
  }

  if (moduleType === 'ninety_days') {
    add(lines, 'Síntese do ciclo', payload.ninetyDaySummary);
    add(lines, 'Avanços e contribuições observáveis', payload.observableAdvances);
    add(lines, 'Forças observadas', payload.strengths);
    add(lines, 'Prioridades de desenvolvimento', payload.developmentPriorities);
    add(lines, 'Ajuste de rota', payload.possibleRouteAdjustment);
    add(lines, 'Direção acordada', directionNames[text(payload.agreedDirection)] ?? payload.agreedDirection);
    add(lines, 'Acordos de trabalho', payload.workAgreements);
    add(lines, 'Compromissos do colaborador', payload.employeeCommitments);
    add(lines, 'Compromissos do gestor', payload.managerCommitments);

    const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
    priorities.forEach((priority: JsonObject, index: number) => {
      const parts = [text(priority.result), text(priority.evidence), text(priority.date), text(priority.support)].filter(Boolean);
      if (parts.length) lines.push(`Prioridade ${index + 1}: ${parts.join(' | ')}`);
    });

    const reflections = (response.reflections ?? {}) as JsonObject;
    add(lines, 'Aprendizado percebido pelo colaborador', reflections.advancesLearning);
    add(lines, 'Prioridade indicada pelo colaborador para o próximo ciclo', reflections.nextCyclePriority);
  }

  if (moduleType === 'competencies') {
    const assessments = (payload.finalAssessments ?? payload.initialAssessments ?? {}) as JsonObject;
    const resultParts = Object.entries(competencyNames)
      .map(([key, label]) => {
        const assessment = (assessments[key] ?? {}) as JsonObject;
        if (assessment.score === undefined && !assessment.band) return '';
        const band = bandNames[text(assessment.band)] ?? text(assessment.band);
        return `${label}: ${score(assessment.score)}${band ? ` (${band})` : ''}`;
      })
      .filter(Boolean);
    if (resultParts.length) lines.push(`Resultado das competências: ${resultParts.join('; ')}`);

    add(lines, 'Síntese do ciclo', payload.competencySummary);
    add(lines, 'Forças reconhecidas', payload.strengthSummary || payload.recognizedStrengths);
    add(lines, 'Prioridade de desenvolvimento', payload.developmentPriority);
    add(lines, 'Acordo principal do próximo ciclo', payload.employeeAgreements);
    add(lines, 'Apoio do gestor', payload.managerSupport);
    add(lines, 'Conexão com o PDI', payload.pdiConnection);
    add(lines, 'Data de retorno', payload.returnDate);

    Object.entries(competencyNames).forEach(([key, label]) => {
      const assessment = (assessments[key] ?? {}) as JsonObject;
      const comment = text(assessment.officialComment);
      if (comment) lines.push(`${label} — comentário oficial: ${comment}`);
    });
  }

  if (moduleType === 'pdi') {
    add(lines, 'Momento profissional', payload.currentMoment);
    add(lines, 'Fortalezas a preservar', payload.strengthsToPreserve);
    add(lines, 'Direção de desenvolvimento', payload.developmentDirection);
    add(lines, 'Aspiração profissional', payload.aspiration);

    const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
    priorities.forEach((priority: JsonObject, index: number) => {
      const axis = pdiAxisNames[text(priority.axis)] ?? text(priority.axis);
      const title = text(priority.title) || `Prioridade ${index + 1}`;
      const parts = [
        axis ? `Eixo: ${axis}` : '',
        text(priority.desiredState) ? `Objetivo: ${text(priority.desiredState)}` : '',
        text(priority.practice) ? `Prática: ${text(priority.practice)}` : '',
        text(priority.evidence) ? `Evidência: ${text(priority.evidence)}` : '',
      ].filter(Boolean);
      lines.push(`${title}: ${parts.join(' | ')}`);
    });

    add(lines, 'Compromisso do colaborador', payload.collaboratorCommitment);
    add(lines, 'Compromisso do gestor', payload.managerCommitment);
    add(lines, 'Acordo de autonomia', payload.autonomyAgreement);
    add(lines, 'Acordos compartilhados', payload.sharedAgreements);
    add(lines, 'Síntese da conversa', payload.conversationSummary);
    add(lines, 'Revisão formal prevista', payload.formalReviewDate);

    const review = (payload.review ?? {}) as JsonObject;
    add(lines, 'Síntese da revisão', review.cycleSummary);
    add(lines, 'Aprendizado a preservar', review.learningToPreserve);
    add(lines, 'Próxima direção', review.nextDirection);
    const reviews = Array.isArray(review.objectiveReviews) ? review.objectiveReviews : [];
    reviews.forEach((item: JsonObject, index: number) => {
      const status = pdiReviewNames[text(item.status)] ?? text(item.status);
      if (status || item.evidence) lines.push(`Revisão da prioridade ${index + 1}: ${[status, text(item.evidence)].filter(Boolean).join(' | ')}`);
    });
  }

  if (moduleType === 'feedback') {
    const flow = text(payload.feedbackFlow) === 'recognition' ? 'Promoção e/ou reconhecimento' : 'Orientação / correção de rota';
    add(lines, 'Tipo de feedback', flow);
    add(lines, 'Registro essencial', payload.essentialRecord);
    add(lines, 'Situação ou contribuição', payload.situationReason || payload.concreteContribution);
    add(lines, 'Fatos ou impacto', payload.observedFacts || payload.generatedImpact);
    add(lines, 'Direção esperada', payload.expectedDirection || payload.futureDirection);
    add(lines, 'Fortalezas reconhecidas', payload.recognizedStrengths);
    add(lines, 'Compromisso do colaborador', payload.collaboratorCommitment);
    add(lines, 'Compromisso do gestor', payload.managerCommitment);
    add(lines, 'Próximos movimentos', payload.nextMoves);
    add(lines, 'Espaço de autonomia', payload.autonomySpace);
    add(lines, 'Retomada', payload.followupReason);
    if (payload.recognitionMode === 'promotion') {
      add(lines, 'Transição de papel', payload.roleTransition);
      add(lines, 'Novas responsabilidades', payload.newResponsibilities);
      add(lines, 'Data efetiva', payload.effectiveDate);
    }
  }

  if (moduleType === 'talent') {
    add(lines, 'Síntese executiva', payload.executiveSummary || payload.summary);
    add(lines, 'Tese de recomendação', payload.recommendationThesis);
    add(lines, 'Direção', payload.futureDirection);
  }

  return lines.length ? lines.join('\n\n') : null;
}
