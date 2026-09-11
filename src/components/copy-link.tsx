'use client';

import { useState } from 'react';

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="button buttonSecondary" type="button" onClick={copy}>
      {copied ? 'Link copiado' : 'Copiar link do colaborador'}
    </button>
  );
}
