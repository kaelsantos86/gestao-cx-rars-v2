'use client';

import { useState } from 'react';

type DownloadState = 'idle' | 'loading' | 'ready' | 'error';
type PreparedPdf = { base64: string; filename: string; bytes: number };

function saveWithBrowser(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function canShareFile(file: File) {
  return typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });
}

export function PdfDownloadButton({ preparedPdf }: { preparedPdf: PreparedPdf | null }) {
  const [state, setState] = useState<DownloadState>('idle');
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function sharePreparedFile(file: File) {
    if (!canShareFile(file)) {
      saveWithBrowser(file);
      setState('idle');
      return;
    }

    try {
      await navigator.share({
        files: [file],
        title: 'Avaliação - Gestão CX RARS',
      });
      setState('idle');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setState('ready');
        return;
      }
      // O iOS pode encerrar a ativação do primeiro toque durante a geração.
      // Mantemos o arquivo pronto para um segundo toque, que abre o compartilhamento nativo.
      setState('ready');
    }
  }

  async function downloadPdf() {
    if (preparedFile && state === 'ready') {
      await sharePreparedFile(preparedFile);
      return;
    }

    setState('loading');
    setPreparedFile(null);
    setErrorCode(null);

    try {
      if (!preparedPdf?.base64 || preparedPdf.bytes <= 0) throw new Error('pdf_not_prepared');

      const binary = window.atob(preparedPdf.base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const signature = String.fromCharCode(...bytes.slice(0, 5));
      if (!signature.startsWith('%PDF-')) throw new Error('invalid_pdf');

      const filename = preparedPdf.filename.endsWith('.pdf') ? preparedPdf.filename : `${preparedPdf.filename}.pdf`;
      const file = new File([bytes], filename, {
        type: 'application/pdf',
      });

      setPreparedFile(file);
      setState('ready');
      await sharePreparedFile(file);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : 'unknown_error');
      setState('error');
    }
  }

  const label = state === 'loading'
    ? 'Gerando PDF...'
    : state === 'ready'
      ? 'Salvar ou compartilhar PDF'
      : state === 'error'
        ? 'Tentar gerar PDF novamente'
        : 'Baixar PDF operacional';

  return (
    <div>
      <button
        className="button buttonSecondary"
        type="button"
        onClick={downloadPdf}
        disabled={state === 'loading'}
      >
        {label}
      </button>
      {state === 'ready' && (
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }} role="status">
          PDF pronto. No iPad, toque no botão e escolha “Salvar em Arquivos”.
        </p>
      )}
      {state === 'error' && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--danger, #9f2d2d)' }} role="alert">
          Não foi possível preparar o PDF. Código: {errorCode ?? 'unknown_error'}.
        </p>
      )}
    </div>
  );
}
