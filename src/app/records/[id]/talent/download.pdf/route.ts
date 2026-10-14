import { getTalentRecord } from '@/lib/data/records';
import { createTalentPdf, talentPdfFilename } from '@/lib/talent-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getTalentRecord(id);
  if (!record || !record.employee) {
    return new Response('Apresentação não encontrada', { status: 404 });
  }
  if (record.status !== 'completed') {
    return new Response('Finalize a apresentação antes de gerar o PDF', { status: 409 });
  }

  try {
    const pdf = await createTalentPdf({ record, employee: record.employee });
    if (pdf.byteLength < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return new Response('O arquivo PDF não pôde ser criado', { status: 500 });
    }

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="' + talentPdfFilename(record.employee.display_name) + '"',
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF de Talento em Evidência:', error);
    return new Response('Não foi possível gerar o PDF da apresentação', { status: 500 });
  }
}
