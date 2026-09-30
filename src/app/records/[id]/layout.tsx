import type { ReactNode } from 'react';
import { OfficialSummaryCard } from '@/components/official-summary-card';
import { requireManager } from '@/lib/auth';
import { createEvaluationPdf, evaluationPdfFilename } from '@/lib/evaluation-pdf';
import { buildOfficialSummary } from '@/lib/official-summary';

function canShowOfficialSummary(moduleType: string, status: string) {
  if (status === 'completed') return true;
  return moduleType === 'pdi' && ['active', 'in_review'].includes(status);
}

export default async function RecordLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireManager();
  let summary: string | null = null;
  let preparedPdf: { base64: string; filename: string; bytes: number } | null = null;

  if (auth) {
    const { data: record } = await auth.supabase
      .from('module_records')
      .select('id, employee_id, manager_id, module_type, status, payload, cycle_label, occurred_on, completed_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (record) {
      const moduleType = String(record.module_type);
      const status = String(record.status);

      if (canShowOfficialSummary(moduleType, status)) {
        const [{ data: response }, { data: employee }] = await Promise.all([
          auth.supabase
            .from('participant_responses')
            .select('response_payload')
            .eq('record_id', id)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle(),
          auth.supabase
            .from('employees')
            .select('display_name, role_title, current_squad')
            .eq('id', record.employee_id)
            .maybeSingle(),
        ]);

        summary = buildOfficialSummary(
          moduleType,
          record.payload,
          response?.response_payload,
          record.cycle_label,
        );

        if (employee && record.manager_id === auth.user.id) {
          try {
            const pdf = await createEvaluationPdf({
              record,
              employee,
              response: response?.response_payload,
            });
            preparedPdf = {
              base64: pdf.toString('base64'),
              filename: evaluationPdfFilename(employee.display_name, moduleType, record.cycle_label),
              bytes: pdf.byteLength,
            };
          } catch (error) {
            console.error('[record-layout] PDF preparation failed', {
              recordId: id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  return (
    <>
      {children}
      {summary && (
        <div className="page" style={{ paddingTop: 0 }}>
          <OfficialSummaryCard summary={summary} preparedPdf={preparedPdf} />
        </div>
      )}
    </>
  );
}
