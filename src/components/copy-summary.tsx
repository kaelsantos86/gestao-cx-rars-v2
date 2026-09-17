'use client';

import { useState } from 'react';

function normalizePlainText(value: string) {
  let normalized = value.replace(/\r\n?/g, '\n');

  // Defensive fix for summaries that may arrive URL-encoded in some mobile flows.
  if (/%[0-9A-Fa-f]{2}/.test(normalized)) {
    try {
      const decoded = decodeURIComponent(normalized);
      const encodedBefore = normalized.match(/%[0-9A-Fa-f]{2}/g)?.length ?? 0;
      const encodedAfter = decoded.match(/%[0-9A-Fa-f]{2}/g)?.length ?? 0;
      if (decoded !== normalized && encodedAfter < encodedBefore) normalized = decoded;
    } catch {
      // Keep the original text if it is not valid URI encoding.
    }
  }

  return normalized;
}

async function writePlainText(value: string) {
  const clipboard = navigator.clipboard;

  // Prefer an explicit text/plain ClipboardItem when supported. This avoids
  // mobile clients interpreting the clipboard payload as an encoded URL.
  if (clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const item = new ClipboardItem({
        'text/plain': new Blob([value], { type: 'text/plain;charset=utf-8' }),
      });
      await clipboard.write([item]);
      return;
    } catch {
      // Fall through to writeText / legacy selection fallback.
    }
  }

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy iOS-compatible copy path.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) throw new Error('copy_failed');
}

export function CopySummary({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copy() {
    try {
      await writePlainText(normalizePlainText(text));
      setState('copied');
    } catch {
      setState('error');
    }
    window.setTimeout(() => setState('idle'), 2200);
  }

  return (
    <button className="button buttonSecondary" type="button" onClick={copy}>
      {state === 'copied'
        ? 'Resumo copiado em texto simples'
        : state === 'error'
          ? 'Não foi possível copiar · tente novamente'
          : 'Copiar resumo para registro oficial'}
    </button>
  );
}
