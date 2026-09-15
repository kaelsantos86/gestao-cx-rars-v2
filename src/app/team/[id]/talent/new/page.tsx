import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { getEligibleTalentSources, getTalentSourcesByIds } from '@/lib/data/talent';
import { buildTalentSourceSnapshot, extractTalentSignals, talentPurposes, talentSourceLabel } from '@/lib/talent';

async function createTalentRecord(formData: FormData) {
  'use server';
  const employeeId = String(formData.get('employeeId') ?? '');
  const purpose = String(formData.get('purpose') ?? 'executive_view');
  const selectedIds = formData.getAll('sourceIds').map(String).filter(Boolean);
  const auth = await requireManager();
  if (!auth) redirect('/login');

  if (!talentPurposes.some((item) => item.value === purpose)) {
    throw new Error('invalid_talent_purpose');
  }

  const sources = await getTalentSourcesByIds(employeeId, selectedIds);
  if (sources.length === 0 || sources.length !== new Set(selectedIds).size) {
    redirect(`/team/${employeeId}/talent/new?sources=required`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const snapshotAt = new Date().toISOString();
  const { data: record, error } = await auth.supabase
    .from('module_records')
    .insert({
      employee_id: employeeId,
      manager_id: auth.user.id,
      module_type: 'talent',
      status: 'draft',
      cycle_label: `Talento em Evidência · ${today.split('-').reverse().join('/')}`,
      occurred_on: today,
      payload: {
        purpose,
        sourceIds: sources.map((source) => source.id),
        sourceSnapshot: buildTalentSourceSnapshot(sources),
        sourceSnapshotAt: snapshotAt,
        ready: false,
      },
    })
    .select('id')
    .single();
  if (error) throw error;

  const { error: dependencyError } = await auth.supabase
    .from('record_dependencies')
    .insert(sources.map((source) => ({
      source_record_id: source.id,
      target_record_id: record.id,
      relation_type: 'evidence_for',
    })));
  if (dependencyError) throw dependencyError;

  redirect(`/records/${record.id}/talent`);
}

export default async function NewTalentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sources?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [employee, sources] = await Promise.all([
    getEmployee(id),
    getEligibleTalentSources(id),
  ]);

  if (!employee) notFound();

  return (
    <main className="page">
      <Link href={`/team/${id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>Talento em Evidência · Gestor</p>
      <h1 className="pageTitle">Construir visão executiva</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Use somente registros formais e evidências profissionais já disponíveis na trajetória.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        Este módulo organiza evidências para uma leitura executiva. Ele não classifica automaticamente a pessoa nem toma decisões de carreira.
      </div>

      {query.sources === 'required' && (
        <div className="notice" style={{ marginBottom: 18 }}>Selecione pelo menos uma fonte formal válida.</div>
      )}

      <form action={createTalentRecord} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="employeeId" value={employee.id} />

        <section className="card">
          <p className="eyebrow">1. Finalidade</p>
          <h2 style={{ marginTop: 0 }}>Para que esta visão será usada?</h2>
          <div className="field">
            <label htmlFor="purpose">Finalidade gerencial</label>
            <select id="purpose" name="purpose" defaultValue="executive_view">
              {talentPurposes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">2. Fontes válidas</p>
          <h2 style={{ marginTop: 0 }}>Evidências da trajetória</h2>
          <p className="muted">Somente registros concluídos — ou PDI formalmente ativo/em revisão — podem ser usados. Feedback de orientação não entra neste resumo.</p>

          {sources.length === 0 ? (
            <div className="empty">Ainda não existem fontes formais elegíveis para compor esta visão executiva.</div>
          ) : (
            <div className="workspaceStack">
              {sources.map((source) => {
                const signals = extractTalentSignals(source).slice(0, 2);
                return (
                  <label className="workspaceMiniCard" key={source.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, cursor: 'pointer' }}>
                    <input type="checkbox" name="sourceIds" value={source.id} defaultChecked style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
                    <span>
                      <strong>{talentSourceLabel(source.module_type)} · {source.cycle_label ?? 'Registro formal'}</strong>
                      <small className="muted" style={{ display: 'block', marginTop: 4 }}>{source.completed_at ? `Concluído em ${String(source.completed_at).slice(0, 10).split('-').reverse().join('/')}` : `Status: ${source.status}`}</small>
                      {signals.length > 0 && (
                        <small className="muted" style={{ display: 'block', marginTop: 8 }}>{signals.join(' · ')}</small>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <div>
          <button className="button" type="submit" disabled={sources.length === 0}>Criar Talento em Evidência</button>
        </div>
      </form>
    </main>
  );
}
