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

  const { data: records, error: recordError } = await supabase
    .from('module_records')
    .select('id')
    .eq('employee_id', employeeId)
    .is('deleted_at', null);

  if (recordError) throw recordError;
  const recordIds = (records ?? []).map((record) => record.id);

  const directAttachmentQuery = supabase
    .from('attachments')
    .select('id, original_name, document_kind, visibility, created_at, record_id')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  const directLegacyQuery = supabase
    .from('legacy_sources')
    .select('id, source_kind, source_locator, module_type, original_date, integrity, created_at, record_id')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  const recordAttachmentQuery = recordIds.length > 0
    ? supabase
        .from('attachments')
        .select('id, original_name, document_kind, visibility, created_at, record_id')
        .in('record_id', recordIds)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const recordLegacyQuery = recordIds.length > 0
    ? supabase
        .from('legacy_sources')
        .select('id, source_kind, source_locator, module_type, original_date, integrity, created_at, record_id')
        .in('record_id', recordIds)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [directAttachmentsResult, recordAttachmentsResult, directLegacyResult, recordLegacyResult] = await Promise.all([
    directAttachmentQuery,
    recordAttachmentQuery,
    directLegacyQuery,
    recordLegacyQuery,
  ]);

  if (directAttachmentsResult.error) throw directAttachmentsResult.error;
  if (recordAttachmentsResult.error) throw recordAttachmentsResult.error;
  if (directLegacyResult.error) throw directLegacyResult.error;
  if (recordLegacyResult.error) throw recordLegacyResult.error;

  const attachmentMap = new Map<string, (typeof directAttachmentsResult.data)[number]>();
  for (const item of [...(directAttachmentsResult.data ?? []), ...(recordAttachmentsResult.data ?? [])]) {
    attachmentMap.set(item.id, item);
  }

  const legacyMap = new Map<string, (typeof directLegacyResult.data)[number]>();
  for (const item of [...(directLegacyResult.data ?? []), ...(recordLegacyResult.data ?? [])]) {
    legacyMap.set(item.id, item);
  }

  const attachmentItems: EmployeeDocumentItem[] = [...attachmentMap.values()].map((item) => ({
    id: item.id,
    source: 'attachment',
    name: item.original_name,
    kind: item.document_kind || 'Documento',
    visibility: item.visibility,
    date: String(item.created_at).slice(0, 10),
  }));

  const legacyItems: EmployeeDocumentItem[] = [...legacyMap.values()].map((item) => ({
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
