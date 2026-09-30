'use client';

import { useState } from 'react';

type DownloadState = 'idle' | 'loading' | 'ready' | 'error';
type PreparedPdf = { base64: string; filename: string; bytes: number };

async function createPdfInBrowser(summary: string, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  function addHeader() {
    doc.setFillColor(23, 115, 93);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('GESTÃO CX RARS', margin, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Resumo operacional da avaliação', margin, 23);
  }

  addHeader();
  doc.setTextColor(23, 42, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Resumo para registro oficial', margin, 47);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);

  const paragraphs = summary.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  let y = 56;
  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
    const blockHeight = lines.length * 5.2 + 4;
    if (y + blockHeight > pageHeight - 18) {
      doc.addPage();
      addHeader();
      doc.setTextColor(23, 42, 58);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      y = 44;
    }
    doc.text(lines, margin, y, { lineHeightFactor: 1.35 });
    y += blockHeight;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setTextColor(94, 107, 117);
    doc.setFontSize(8);
    doc.text(`Gestão CX RARS · página ${page} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  const data = doc.output('arraybuffer');
  return new File([data], filename, { type: 'application/pdf' });
}

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

export function PdfDownloadButton({
  preparedPdf,
  summary,
}: {
  preparedPdf: PreparedPdf | null;
  summary: string;
}) {
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
      const baseFilename = preparedPdf?.filename || 'gestao-cx-rars-avaliacao.pdf';
      const filename = baseFilename.endsWith('.pdf') ? baseFilename : `${baseFilename}.pdf`;
      let file: File;

      if (preparedPdf?.base64 && preparedPdf.bytes > 0) {
        const binary = window.atob(preparedPdf.base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const signature = String.fromCharCode(...bytes.slice(0, 5));
        if (!signature.startsWith('%PDF-')) throw new Error('invalid_server_pdf');
        file = new File([bytes], filename, { type: 'application/pdf' });
      } else {
        // Fallback para registros históricos ou falhas do PDFKit na função da Vercel.
        // O arquivo é criado inteiramente no navegador com o resumo já carregado.
        file = await createPdfInBrowser(summary, filename);
      }

      if (file.size <= 0) throw new Error('empty_pdf');

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
