'use client';

import { useMemo, useState } from 'react';
import {
  bandForScore,
  bandHelp,
  bandLabel,
  buildAutomaticOfficialComment,
  scoreText,
} from '@/lib/competencies';

type Assessment = {
  score?: number;
  evidence?: string;
  officialComment?: string;
  nextStep?: string;
};

type Props = {
  competencyKey: string;
  competencyLabel: string;
  competencyHelp: string;
  initial: Assessment;
  participantBand?: string;
  participantEvidence?: string;
};

function parseScore(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function CompetencyFinalReviewCard({
  competencyKey,
  competencyLabel,
  competencyHelp,
  initial,
  participantBand,
  participantEvidence,
}: Props) {
  const [score, setScore] = useState(
    typeof initial.score === 'number'
      ? initial.score.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '',
  );
  const [evidence, setEvidence] = useState(initial.evidence ?? '');
  const [nextStep, setNextStep] = useState(initial.nextStep ?? '');
  const numericScore = parseScore(score);
  const band = Number.isNaN(numericScore) ? null : bandForScore(numericScore);
  const generatedComment = useMemo(
    () => band
      ? buildAutomaticOfficialComment(competencyLabel, numericScore, evidence, nextStep)
      : '',
    [band, competencyLabel, evidence, nextStep, numericScore],
  );
  const [manualComment, setManualComment] = useState(() => {
    const initialComment = initial.officialComment?.trim() ?? '';
    const initialAutomaticComment = typeof initial.score === 'number'
      ? buildAutomaticOfficialComment(competencyLabel, initial.score, initial.evidence ?? '', initial.nextStep ?? '')
      : '';
    return initialComment === initialAutomaticComment ? '' : initialComment;
  });
  const officialComment = manualComment.trim() || generatedComment;

  return (
    <details className="competencyAccordion">
      <summary className="competencySummary">
        <span>
          <strong>{competencyLabel}</strong>
          <small>{competencyHelp}</small>
        </span>
        <span className="badge badgeAccent">
          {band ? `${bandLabel(band)} · ${scoreText(numericScore)}` : 'Revisar nota'}
        </span>
        <span className="competencyChevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="competencyAccordionBody">
        <div className="notice" style={{ marginBottom: 14 }}>
          <strong>Comparação</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            Gestor: {band ? `${bandLabel(band)} · ${scoreText(numericScore)}` : '—'} · Colaborador: {participantBand ? bandLabel(participantBand) : 'sem autoavaliação'}
          </div>
          {participantEvidence && <p className="muted" style={{ marginBottom: 0 }}>Evidência do colaborador: {participantEvidence}</p>}
        </div>

        <div className="grid grid2">
          <div className="field">
            <label htmlFor={`final_${competencyKey}_score`}>Nota final</label>
            <input
              id={`final_${competencyKey}_score`}
              name={`final_${competencyKey}_score`}
              type="text"
              inputMode="decimal"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              required
            />
            <small className="fieldHelp">A faixa é automática.</small>
          </div>
          <div className="field">
            <label>Faixa final</label>
            <div className="notice" style={{ margin: 0, minHeight: 46 }}>
              <strong>{band ? bandLabel(band) : 'Nota inválida'}</strong>
              {band && <div className="muted" style={{ marginTop: 4 }}>{bandHelp(band)}</div>}
            </div>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`final_${competencyKey}_evidence`}>Comentário / evidências</label>
            <textarea
              id={`final_${competencyKey}_evidence`}
              name={`final_${competencyKey}_evidence`}
              rows={3}
              value={evidence}
              onChange={(event) => {
                setEvidence(event.target.value);
              }}
              required
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`final_${competencyKey}_nextStep`}>Próximo foco <span className="muted">(opcional)</span></label>
            <textarea
              id={`final_${competencyKey}_nextStep`}
              name={`final_${competencyKey}_nextStep`}
              rows={2}
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`final_${competencyKey}_officialComment`}>Comentário para o +Evolução</label>
            <textarea
              id={`final_${competencyKey}_officialComment`}
              name={`final_${competencyKey}_officialComment`}
              rows={3}
              value={officialComment}
              onChange={(event) => setManualComment(event.target.value)}
              required
            />
            <div style={{ marginTop: 8 }}>
              <button
                className="button buttonSecondary"
                type="button"
                onClick={() => setManualComment('')}
                disabled={!generatedComment}
              >
                Gerar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
