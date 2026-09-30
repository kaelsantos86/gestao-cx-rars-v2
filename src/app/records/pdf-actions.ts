'use server';

import { requireManager } from '@/lib/auth';
import { createEvaluationPdf, evaluationPdfFilename } from '@/lib/evaluation-pdf';

export async function generateRecordPdf(recordId: string) {
  const auth = await requireManager();
  if (!auth) return { ok: false as const, error: 'not_authorized' };

  try {
    const { data: record, error: recordError } = await auth.supabase
      .from('module_records')
      .select('id, employee_id, manager_id, module_type, status, cycle_label, occurred_on, completed_at, payload')
      .eq('id', recordId)
      .is('deleted_at', null)
      .maybeSingle();

    if (recordError || !record || record.manager_id !== auth.user.id) {
      return { ok: false as const, error: 'record_not_found' };
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
      console.error('[pdf-action] source data unavailable', {
        recordId,
        employeeError: employeeError?.message,
        responseError: responseError?.message,
      });
      return { ok: false as const, error: 'source_data_unavailable' };
    }

    const pdf = await createEvaluationPdf({
      record,
      employee,
      response: latestResponse?.response_payload,
    });
    const filename = evaluationPdfFilename(employee.display_name, record.module_type, record.cycle_label);

    console.info('[pdf-action] generated', { recordId, bytes: pdf.byteLength });
    return {
      ok: true as const,
      filename,
      base64: pdf.toString('base64'),
      bytes: pdf.byteLength,
    };
  } catch (error) {
    console.error('[pdf-action] generation failed', {
      recordId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false as const, error: 'generation_failed' };
  }
}
