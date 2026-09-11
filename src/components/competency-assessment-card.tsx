'use client';

import { useEffect, useRef, useState } from 'react';
import { competencyBands } from '@/lib/competencies';

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

function pt(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CompetencyAssessmentCard({ competency }: { competency: Competency }) {
  const [band, setBand] = useState('');
  const [score, setScore] = useState('');
  const [evidence, setEvidence] = useState('');
  const [officialComment, setOfficialComment] = useState('');
  const scoreRef = useRef<HTMLInputElement>(null);

  const bandDefinition = competencyBands.find((item) => item.value === band);
  const numericScore = parseScore(score);
  const scoreValid = Boolean(
    bandDefinition
      && numericScore !== null
      && !Number.isNaN(numericScore)
      && numericScore >= bandDefinition.min
      && numericScore <= bandDefinition.max,
  );
  const complete = Boolean(bandDefinition && scoreValid && evidence.trim() && officialComment.trim());

  useEffect(() => {
    const input = scoreRef.current;
    if (!input) return;

    if (!score.trim()) {
      input.setCustomValidity('');
    } else if (!bandDefinition) {
      input.setCustomValidity('Selecione primeiro a faixa da competência.');
    } else if (numericScore === null || Number.isNaN(numericScore)) {
      input.setCustomValidity('Digite uma nota válida usando vírgula ou ponto.');
    } else if (numericScore < bandDefinition.min || numericScore > bandDefinition.max) {
      input.setCustomValidity(`A nota desta faixa deve ficar entre ${pt(bandDefinition.min)} e ${pt(bandDefinition.max)}.`);
    } else {
      input.setCustomValidity('');
    }

    input.form?.dispatchEvent(new Event('competency-validity'));
  }, [bandDefinition, numericScore, score]);

  const status = complete
    ? `${bandDefinition?.label} · ${score.replace('.', ',')}`
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
        <div className="grid grid2">
          <div className="field">
            <label htmlFor={`assessment_${competency.key}_band`}>Faixa</label>
            <select
              id={`assessment_${competency.key}_band`}
              name={`assessment_${competency.key}_band`}
              value={band}
              onChange={(event) => setBand(event.target.value)}
              required
            >
              <option value="" disabled>Selecione</option>
              {competencyBands.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} · {pt(item.min)}–{pt(item.max)}
                </option>
              ))}
            </select>
            {bandDefinition && <small className="fieldHelp">{bandDefinition.help}</small>}
          </div>

          <div className="field">
            <label htmlFor={`assessment_${competency.key}_score`}>Nota dentro da faixa</label>
            <input
              ref={scoreRef}
              id={`assessment_${competency.key}_score`}
              name={`assessment_${competency.key}_score`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              placeholder={bandDefinition ? `De ${pt(bandDefinition.min)} a ${pt(bandDefinition.max)}` : 'Selecione a faixa primeiro'}
              required
            />
            <small className="fieldHelp">
              {bandDefinition
                ? `Intervalo permitido: ${pt(bandDefinition.min)} a ${pt(bandDefinition.max)}. Aceita vírgula ou ponto.`
                : 'A faixa escolhida define automaticamente o intervalo permitido.'}
            </small>
          </div>

          <div className="field">
            <label htmlFor={`assessment_${competency.key}_evidence`}>Evidências observáveis</label>
            <textarea
              id={`assessment_${competency.key}_evidence`}
              name={`assessment_${competency.key}_evidence`}
              rows={4}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              required
              placeholder="Situação + comportamento + efeito. Inclua mais de uma situação quando estiver avaliando consistência."
            />
          </div>

          <div className="field">
            <label htmlFor={`assessment_${competency.key}_officialComment`}>Comentário para a ferramenta oficial</label>
            <textarea
              id={`assessment_${competency.key}_officialComment`}
              name={`assessment_${competency.key}_officialComment`}
              rows={4}
              value={officialComment}
              onChange={(event) => setOfficialComment(event.target.value)}
              required
              placeholder="Escreva uma devolutiva equilibrada, conectada à competência e pronta para copiar ao +Evolução."
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor={`assessment_${competency.key}_nextStep`}>Próximo passo ou acordo <span className="muted">(opcional)</span></label>
          <textarea
            id={`assessment_${competency.key}_nextStep`}
            name={`assessment_${competency.key}_nextStep`}
            rows={3}
            placeholder="Comportamento a reforçar, desenvolver ou acompanhar de forma proporcional ao ciclo."
          />
        </div>
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
      {valid ? 'Criar Avaliação de Competências' : 'Complete os campos obrigatórios'}
    </button>
  );
}
