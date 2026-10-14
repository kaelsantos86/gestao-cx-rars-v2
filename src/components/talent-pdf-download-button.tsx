'use client';

import { useState } from 'react';

type PdfState = 'idle' | 'loading' | 'ready' | 'downloaded' | 'error';

function canSharePdf(file: File) {
  return typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });
}

function downloadWithBrowser(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = file.name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function TalentPdfDownloadButton({ url, filename }: { url: string; filename: string }) {
  const [state, setState] = useState<PdfState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  async function downloadPdf() {
    if (file) {
      if (canSharePdf(file)) {
        try {
          // O segundo toque preserva a ativação exigida pelo iOS para compartilhar arquivos.
          await navigator.share({ files: [file], title: 'Talento em Evidência' });
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setErrorMessage('Não foi possível abrir o compartilhamento. Tente novamente.');
            setState('error');
          }
        }
      } else {
        downloadWithBrowser(file);
        setState('downloaded');
      }
      return;
    }

    setState('loading');
    setErrorMessage('');
    try {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.redirected
            ? 'Sua sessão pode ter expirado. Acesse novamente o aplicativo.'
            : 'Falha ao gerar o PDF (código ' + response.status + ').',
        );
      }
      const bytes = await response.arrayBuffer();
      const signature = String.fromCharCode(...new Uint8Array(bytes.slice(0, 5)));
      if (bytes.byteLength < 100 || signature !== '%PDF-') {
        throw new Error('O servidor não retornou um arquivo PDF válido.');
      }
      const generated = new File([bytes], filename, { type: 'application/pdf' });
      setFile(generated);

      if (canSharePdf(generated)) {
        // O arquivo já está em memória; o próximo toque abre o menu nativo de compartilhar.
        setState('ready');
      } else {
        downloadWithBrowser(generated);
        setState('downloaded');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro inesperado ao preparar o PDF.');
      setState('error');
    }
  }

  const label = state === 'loading' ? 'Gerando PDF...'
    : state === 'ready' ? 'Salvar ou compartilhar PDF'
      : state === 'downloaded' ? 'Baixar PDF novamente'
        : state === 'error' ? 'Tentar gerar PDF'
          : 'Gerar PDF da apresentação';

  return (
    <div style={{ display: 'grid', gap: 7, justifyItems: 'start' }}>
      <button className="button" type="button" onClick={downloadPdf} disabled={state === 'loading'}>
        {label}
      </button>
      {state === 'ready' && (
        <p className="muted" role="status" style={{ margin: 0, fontSize: 12 }}>
          PDF pronto. Toque em “Salvar ou compartilhar PDF” e escolha “Salvar em Arquivos” no iPhone.
        </p>
      )}
      {state === 'downloaded' && (
        <p className="muted" role="status" style={{ margin: 0, fontSize: 12 }}>
          PDF preparado e enviado para o download do navegador.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: '#A52A2A' }}>
          {errorMessage || 'Não foi possível preparar o PDF.'}
        </p>
      )}
      {state === 'error' && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, textDecoration: 'underline' }}>
          Abrir PDF diretamente no navegador
        </a>
      )}
    </div>
  );
}
