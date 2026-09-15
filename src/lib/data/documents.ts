import { hasSupabaseEnv } from '@/lib/env';
import { requireManager } from '@/lib/auth';

export type EmployeeDocumentItem = {
  id: string;
  source: 'attachment' | 'legacy';
  name: string;
  kind: string;
  visibility?: string | null;
  integrity?: string | null;
  date: string;
  moduleType?: string | null;
};

export async function getEmployeeDocuments(employeeId: string): Promise<EmployeeDocumentItem[]> {
  if (!hasSupabaseEnv()) return [];

  const auth = await requireManager();
  const supabase = auth!.supabase;

  const [{ data: attachments, error: attachmentError }, { data: legacy, error: legacyError }] = await Promise.all([
    supabase
      .from('attachments')
      .select('id, original_name, document_kind, visibility, created_at, record_id')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false }),
    supabase
      .from('legacy_sources')
      .select('id, source_kind, source_locator, module_type, original_date, integrity, created_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false }),
  ]);

  if (attachmentError) throw attachmentError;
  if (legacyError) throw legacyError;

  const attachmentItems: EmployeeDocumentItem[] = (attachments ?? []).map((item) => ({
    id: item.id,
    source: 'attachment',
    name: item.original_name,
    kind: item.document_kind || 'Documento',
    visibility: item.visibility,
    date: String(item.created_at).slice(0, 10),
  }));

  const legacyItems: EmployeeDocumentItem[] = (legacy ?? []).map((item) => ({
    id: item.id,
    source: 'legacy',
    name: item.source_locator,
    kind: item.source_kind,
    integrity: item.integrity,
    date: item.original_date || String(item.created_at).slice(0, 10),
    moduleType: item.module_type ? String(item.module_type) : null,
  }));

  return [...attachmentItems, ...legacyItems].sort((a, b) => b.date.localeCompare(a.date));
}
