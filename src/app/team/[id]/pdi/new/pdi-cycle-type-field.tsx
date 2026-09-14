'use client';

import { useState } from 'react';

type CycleTypeOption = {
  value: string;
  label: string;
};

export function PdiCycleTypeField({
  items,
  defaultValue,
}: {
  items: CycleTypeOption[];
  defaultValue: string;
}) {
  const [cycleType, setCycleType] = useState(defaultValue);

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
          {items.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {cycleType === 'extraordinary_review' && (
        <div className="field" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <label htmlFor="extraordinaryReason">Motivo extraordinário</label>
          <textarea
            id="extraordinaryReason"
            name="extraordinaryReason"
            rows={3}
            required
            placeholder="Descreva a mudança relevante de função, responsabilidade, desempenho ou direção que justifica esta revisão."
          />
        </div>
      )}
    </>
  );
}
