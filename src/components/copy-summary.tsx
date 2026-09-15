'use client';

import { useState } from 'react';

export function CopySummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="button buttonSecondary" type="button" onClick={copy}>
      {copied ? 'Resumo copiado' : 'Copiar resumo para registro oficial'}
    </button>
  );
}
