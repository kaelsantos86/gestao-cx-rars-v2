import type { ReactNode } from 'react';
import { OfficialSummaryCard } from '@/components/official-summary-card';
import { requireManager } from '@/lib/auth';
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

  if (auth) {
    const { data: record } = await auth.supabase
      .from('module_records')
      .select('id, module_type, status, payload, cycle_label')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (record) {
      const moduleType = String(record.module_type);
      const status = String(record.status);

      if (canShowOfficialSummary(moduleType, status)) {
        const { data: response } = await auth.supabase
          .from('participant_responses')
          .select('response_payload')
          .eq('record_id', id)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        summary = buildOfficialSummary(
          moduleType,
          record.payload,
          response?.response_payload,
          record.cycle_label,
        );
      }
    }
  }

  return (
    <>
      {children}
      {summary && (
        <div className="page" style={{ paddingTop: 0 }}>
          <OfficialSummaryCard summary={summary} />
        </div>
      )}
    </>
  );
}
