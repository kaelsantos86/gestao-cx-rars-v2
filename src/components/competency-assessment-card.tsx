'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bandForScore,
  bandHelp,
  bandLabel,
  buildAutomaticOfficialComment,
  scoreText,
} from '@/lib/competencies';

type Competency = {
  key: string;
  label: string;
  tagline: string;
  help: string;
};

function parseScore(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function CompetencyAssessmentCard({ competency }: { competency: Competency }) {
  const [score, setScore] = useState('');
  const [evidence, setEvidence] = useState('');
  const [nextStep, setNextStep] = useState('');
  const scoreRef = useRef<HTMLInputElement>(null);

  const numericScore = parseScore(score);
  const band = numericScore !== null && !Number.isNaN(numericScore) ? bandForScore(numericScore) : null;
  const scoreValid = numericScore !== null && !Number.isNaN(numericScore) && Boolean(band);
  const officialComment = useMemo(
    () => scoreValid && numericScore !== null
      ? buildAutomaticOfficialComment(competency.label, numericScore, evidence, nextStep)
      : '',
    [competency.label, evidence, nextStep, numericScore, scoreValid],
  );
  const complete = Boolean(scoreValid && evidence.trim());

  useEffect(() => {
    const input = scoreRef.current;
    if (!input) return;

    if (!score.trim()) input.setCustomValidity('');
    else if (!scoreValid) input.setCustomValidity('Informe uma nota entre 0,00 e 1,20, usando até duas casas decimais.');
    else input.setCustomValidity('');

    input.form?.dispatchEvent(new Event('competency-validity'));
  }, [score, scoreValid]);

  const status = complete && band && numericScore !== null
    ? `${bandLabel(band)} · ${scoreText(numericScore)}`
    : 'Pendente';

  return (
    <details className="competencyAccordion">
      <summary className="competencySummary">
        <span>
          <strong>{competency.label}</strong>
          <small>{competency.tagline} {competency.help}</small>
        </span>
        <span className={`badge ${complete ? 'badgeAccent' : ''}`}>{status}</span>
        <span className="competencyChevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="competencyAccordionBody">
        <input type="hidden" name={`assessment_${competency.key}_band`} value={band ?? ''} />
        <input type="hidden" name={`assessment_${competency.key}_officialComment`} value={officialComment} />

        <div className="grid grid2">
          <div className="field">
            <label htmlFor={`assessment_${competency.key}_score`}>Nota</label>
            <input
              ref={scoreRef}
              id={`assessment_${competency.key}_score`}
              name={`assessment_${competency.key}_score`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              placeholder="Ex.: 1,10"
              required
            />
            <small className="fieldHelp">Informe apenas a nota. A faixa é calculada automaticamente.</small>
          </div>

          <div className="field">
            <label>Faixa automática</label>
            <div className="notice" style={{ margin: 0, minHeight: 46 }}>
              <strong>{band ? bandLabel(band) : 'Aguardando nota'}</strong>
              {band && <div className="muted" style={{ marginTop: 4 }}>{bandHelp(band)}</div>}
            </div>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`assessment_${competency.key}_evidence`}>Comentário / evidências da competência</label>
            <textarea
              id={`assessment_${competency.key}_evidence`}
              name={`assessment_${competency.key}_evidence`}
              rows={4}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              required
              placeholder="Registre fatos relevantes do semestre: situação, comportamento e efeito. Não precisa escrever novamente para a ferramenta oficial."
            />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`assessment_${competency.key}_nextStep`}>Próximo foco <span className="muted">(opcional)</span></label>
            <textarea
              id={`assessment_${competency.key}_nextStep`}
              name={`assessment_${competency.key}_nextStep`}
              rows={2}
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              placeholder="Inclua somente quando houver um comportamento específico a reforçar ou desenvolver."
            />
          </div>
        </div>

        {officialComment && (
          <div className="notice" style={{ marginTop: 14 }}>
            <strong>Comentário para o +Evolução · gerado automaticamente</strong>
            <p className="muted" style={{ marginBottom: 0 }}>{officialComment}</p>
          </div>
        )}
      </div>
    </details>
  );
}

export function CompetencySubmitButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const button = buttonRef.current;
    const form = button?.form;
    if (!form) return;

    const refresh = () => setValid(form.checkValidity());
    refresh();
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('competency-validity', refresh);

    return () => {
      form.removeEventListener('input', refresh);
      form.removeEventListener('change', refresh);
      form.removeEventListener('competency-validity', refresh);
    };
  }, []);

  return (
    <button ref={buttonRef} className="button" type="submit" disabled={!valid}>
      {valid ? 'Criar Avaliação de Competências' : 'Complete as notas e comentários obrigatórios'}
    </button>
  );
}
