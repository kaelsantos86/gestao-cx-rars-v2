import { requireManager } from '@/lib/auth';
import { createEvaluationPdf, evaluationPdfFilename } from '@/lib/evaluation-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireManager();
  if (!auth) return new Response('Não autorizado', { status: 401 });

  const { data: record, error: recordError } = await auth.supabase
    .from('module_records')
    .select('id, employee_id, manager_id, module_type, status, cycle_label, occurred_on, completed_at, payload')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  // O acesso ao registro já foi autorizado pela sessão e pelas políticas RLS.
  // Não compare manager_id: registros migrados podem manter o vínculo histórico.
  if (recordError || !record) {
    return new Response('Registro não encontrado', { status: 404 });
  }

  const [{ data: employee, error: employeeError }, { data: latestResponse, error: responseError }] = await Promise.all([
    auth.supabase
      .from('employees')
      .select('display_name, role_title, current_squad')
      .eq('id', record.employee_id)
      .maybeSingle(),
    auth.supabase
      .from('participant_responses')
      .select('response_payload')
      .eq('record_id', record.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (employeeError || responseError || !employee) {
    return new Response('Não foi possível gerar o PDF', { status: 500 });
  }

  const pdf = await createEvaluationPdf({
    record,
    employee,
    response: latestResponse?.response_payload,
  });
  const filename = evaluationPdfFilename(employee.display_name, record.module_type, record.cycle_label);

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
