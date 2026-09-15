'use client';

import { useState } from 'react';
import {
  pdiAxes,
  pdiContextFields,
  pdiCycleTypes,
  relatedCompetencies,
} from '@/lib/pdi';

const contextPlaceholders: Record<string, string> = {
  contextAndRole: 'Resuma escopo, prioridades e condições que afetam o desenvolvimento neste ciclo.',
  currentMoment: 'Descreva maturidade, desafios e transição sem transformar o momento em nota.',
  strengthsToPreserve: 'Escolha repertórios que sustentam o próximo passo e que devem ser preservados.',
  aspiration: 'Registre o movimento profissional desejado pela pessoa, sem presumir promoção.',
  developmentDirection: 'Conecte capacidade, contexto e impacto em uma frase de direção.',
  notPriorityNow: 'Proteja foco: registre oportunidades que não precisam virar prioridade neste ciclo.',
  sourceReadings: 'Sintetize os sinais reais vindos de 90 dias, Competências ou PDI anterior. Não altere a autoria das fontes.',
};

const requiredContextKeys = new Set([
  'contextAndRole',
  'currentMoment',
  'strengthsToPreserve',
  'aspiration',
  'developmentDirection',
]);

export function PdiCycleTypeField({ suggestedType }: { suggestedType: string }) {
  const [cycleType, setCycleType] = useState(suggestedType);

  return (
    <>
      <div className="field">
        <label htmlFor="cycleType">Tipo de PDI</label>
        <select
          id="cycleType"
          name="cycleType"
          value={cycleType}
          onChange={(event) => setCycleType(event.target.value)}
          required
        >
          {pdiCycleTypes.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {cycleType === 'extraordinary_review' && (
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="extraordinaryReason">Motivo extraordinário</label>
          <textarea
            id="extraordinaryReason"
            name="extraordinaryReason"
            rows={3}
            required
            placeholder="Descreva a mudança relevante de contexto, papel ou direção que justifica esta revisão."
          />
        </div>
      )}
    </>
  );
}

export function PdiDirectionSection() {
  const essentialFields = pdiContextFields.filter(([key]) => requiredContextKeys.has(key));
  const optionalFields = pdiContextFields.filter(([key]) => !requiredContextKeys.has(key));

  return (
    <details className="workspaceAccordion" open>
      <summary className="workspaceSummary">
        <span>
          <strong>2. Direção do ciclo</strong>
          <small>Contexto, fortalezas, aspiração e direção antes das prioridades.</small>
        </span>
        <span className="badge">5 essenciais</span>
        <span className="competencyChevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="workspaceBody">
        <h2 style={{ marginTop: 0 }}>Contexto antes das prioridades</h2>
        <div className="grid grid2">
          {essentialFields.map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <textarea
                id={key}
                name={key}
                rows={4}
                required
                placeholder={contextPlaceholders[key]}
              />
            </div>
          ))}
        </div>

        <details className="competencyAccordion" style={{ marginTop: 14 }}>
          <summary className="competencySummary">
            <span>
              <strong>Complementos opcionais</strong>
              <small>Proteção de foco e leitura das fontes do ciclo.</small>
            </span>
            <span className="badge">Opcional</span>
            <span className="competencyChevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="competencyAccordionBody grid grid2">
            {optionalFields.map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label} <span className="muted">(opcional)</span></label>
                <textarea
                  id={key}
                  name={key}
                  rows={4}
                  placeholder={contextPlaceholders[key]}
                />
              </div>
            ))}
          </div>
        </details>
      </div>
    </details>
  );
}

function PriorityCard({ index }: { index: number }) {
  const [title, setTitle] = useState('');
  const hasTitle = title.trim().length > 0;

  return (
    <details className="competencyAccordion" open={index === 1}>
      <summary className="competencySummary">
        <span>
          <strong>{hasTitle ? title.trim() : `Prioridade ${index}`}</strong>
          <small>{index === 1 ? 'Obrigatória' : hasTitle ? 'Preenchida' : 'Opcional'}</small>
        </span>
        <span className="competencyChevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="competencyAccordionBody grid grid2">
        <div className="field">
          <label htmlFor={`priority_${index}_axis`}>Eixo</label>
          <select id={`priority_${index}_axis`} name={`priority_${index}_axis`} defaultValue="">
            <option value="">Selecione</option>
            {pdiAxes.map((axis) => <option key={axis.value} value={axis.value}>{axis.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`priority_${index}_relatedCompetency`}>Competência relacionada <span className="muted">(opcional)</span></label>
          <select id={`priority_${index}_relatedCompetency`} name={`priority_${index}_relatedCompetency`} defaultValue="">
            <option value="">Sem vínculo obrigatório</option>
            {relatedCompetencies.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor={`priority_${index}_title`}>Título: capacidade + impacto</label>
          <input
            id={`priority_${index}_title`}
            name={`priority_${index}_title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Conduzir pactuações multiarea com clareza e influência."
          />
        </div>
        <div className="field"><label>Estado atual</label><textarea name={`priority_${index}_currentState`} rows={4} placeholder="Padrão atual com fatos, sem desqualificar a pessoa." /></div>
        <div className="field"><label>Estado desejado</label><textarea name={`priority_${index}_desiredState`} rows={4} placeholder="Comportamento ou resultado que indicará evolução." /></div>
        <div className="field"><label>Prática ou experiência</label><textarea name={`priority_${index}_practice`} rows={4} placeholder="Situação real de trabalho em que a capacidade será praticada." /></div>
        <div className="field"><label>Evidência natural</label><textarea name={`priority_${index}_evidence`} rows={4} placeholder="Produto ou efeito verificável do trabalho, sem microgestão." /></div>
        <div className="field"><label>Apoio do gestor/organização</label><textarea name={`priority_${index}_support`} rows={4} placeholder="Contexto, exposição, conexão, recurso ou debrief necessário." /></div>
        <div className="field"><label>Autonomia</label><textarea name={`priority_${index}_autonomy`} rows={4} placeholder="O que a pessoa pode decidir e quais situações pedem alinhamento." /></div>
      </div>
    </details>
  );
}

export function PdiPrioritiesSection() {
  return (
    <section className="card">
      <p className="eyebrow">3. Prioridades</p>
      <h2>Até 3 movimentos de desenvolvimento</h2>
      <p className="muted">A prioridade 1 é obrigatória. Abra as prioridades 2 e 3 somente se elas realmente aumentarem foco, e não o transformarem em checklist.</p>
      <div className="grid" style={{ gap: 12 }}>
        {[1, 2, 3].map((index) => <PriorityCard key={index} index={index} />)}
      </div>
    </section>
  );
}

export function PdiPrivateNotesSection() {
  return (
    <details className="workspaceAccordion">
      <summary className="workspaceSummary">
        <span>
          <strong>Notas privadas do gestor</strong>
          <small>Hipóteses de acompanhamento que não fazem parte do plano compartilhado.</small>
        </span>
        <span className="badge">Opcional</span>
        <span className="competencyChevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="workspaceBody">
        <div className="field">
          <label htmlFor="privateNotes">Observações do gestor</label>
          <textarea
            id="privateNotes"
            name="privateNotes"
            rows={3}
            placeholder="Hipóteses de acompanhamento que não compõem o plano compartilhado. Não esconda aqui decisões que afetem a pessoa."
          />
        </div>
      </div>
    </details>
  );
}
