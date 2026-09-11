import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { ninetyDayDimensions, ninetyDayManagerPreparationFields } from '@/lib/ninety-days';

async function createNinetyDayReview(formData: FormData) {
  'use server';

  const employeeId = String(formData.get('employeeId') ?? '');
  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: existing } = await auth.supabase
    .from('module_records')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth.user.id)
    .eq('module_type', 'ninety_days')
    .not('status', 'in', '(completed,archived,cancelled)')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/records/${existing.id}/ninety-days`);

  const { data: sourceMarcoZero } = await auth.supabase
    .from('module_records')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('manager_id', auth.user.id)
    .eq('module_type', 'marco_zero')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialFeedbackConfirmed = formData.get('initialFeedbackConfirmed') === 'on';
  if (!sourceMarcoZero && !initialFeedbackConfirmed) {
    redirect(`/team/${employeeId}/ninety-days/new?basis=required`);
  }

  const managerRatings = Object.fromEntries(
    ninetyDayDimensions.map((dimension) => {
      const value = Number(formData.get(`rating_${dimension.key}`));
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error(`invalid_rating_${dimension.key}`);
      }
      return [dimension.key, value];
    }),
  );

  const preparation = Object.fromEntries(
    ninetyDayManagerPreparationFields.map(([key]) => [key, String(formData.get(key) ?? '')]),
  );

  const payload = {
    managerRatings,
    ...preparation,
    entryBasis: sourceMarcoZero ? 'completed_marco_zero' : 'prior_initial_feedback_confirmed',
    sourceMarcoZeroId: sourceMarcoZero?.id ?? null,
  };

  const { data: record, error } = await auth.supabase
    .from('module_records')
    .insert({
      employee_id: employeeId,
      manager_id: auth.user.id,
      module_type: 'ninety_days',
      status: 'awaiting_participant',
      cycle_label: 'Avaliação de 90 dias',
      occurred_on: new Date().toISOString().slice(0, 10),
      payload,
      private_notes: String(formData.get('privateNotes') ?? '') || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  if (sourceMarcoZero) {
    const { error: dependencyError } = await auth.supabase.from('record_dependencies').insert({
      source_record_id: sourceMarcoZero.id,
      target_record_id: record.id,
      relation_type: 'source_for',
    });
    if (dependencyError) throw dependencyError;
  }

  redirect(`/records/${record.id}/ninety-days`);
}

export default async function NewNinetyDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basis?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const auth = await requireManager();
  if (!auth) redirect('/login');

  const { data: sourceMarcoZero } = await auth.supabase
    .from('module_records')
    .select('id, completed_at')
    .eq('employee_id', id)
    .eq('manager_id', auth.user.id)
    .eq('module_type', 'marco_zero')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="page">
      <Link href={`/team/${id}`} className="muted" style={{ fontSize: 13 }}>← Voltar para o perfil</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>Avaliação de 90 dias · Gestor</p>
      <h1 className="pageTitle">Preparar devolutiva</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Compare a experiência real com as expectativas do início do ciclo e prepare a conversa com fatos observáveis.</p>

      <div className="notice" style={{ marginBottom: 18 }}>
        {sourceMarcoZero
          ? 'Há um Marco Zero concluído e ele será vinculado automaticamente como fonte desta avaliação.'
          : 'Não há Marco Zero concluído na V2. Isso é esperado para pessoas que entraram pela etapa de consolidação; confirme abaixo que a devolutiva inicial já ocorreu.'}
      </div>
      {query.basis && <div className="notice" style={{ marginBottom: 18 }}>Confirme a base da avaliação para continuar sem criar um Marco Zero artificial.</div>}

      <form action={createNinetyDayReview} className="grid" style={{ gap: 18 }}>
        <input type="hidden" name="employeeId" value={employee.id} />

        <section className="card">
          <p className="eyebrow">1. Leitura do gestor</p>
          <h2>Dimensões de 1 a 5</h2>
          <p className="muted">1 = muito abaixo do necessário hoje; 3 = adequado para o momento; 5 = acima do esperado para o ciclo. Avalie o momento profissional real, não uma senioridade abstrata.</p>
          <div className="grid" style={{ gap: 16 }}>
            {ninetyDayDimensions.map((dimension) => (
              <div key={dimension.key} className="field">
                <label htmlFor={`rating_${dimension.key}`}>{dimension.label}</label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{dimension.help}</div>
                <select id={`rating_${dimension.key}`} name={`rating_${dimension.key}`} required defaultValue="">
                  <option value="" disabled>Selecione</option>
                  {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">2. Fatos e leitura</p>
          <h2>Preparação gerencial</h2>
          <div className="grid grid2">
            {ninetyDayManagerPreparationFields.map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <textarea id={key} name={key} rows={4} required placeholder="Registre fatos, contexto, efeito e direção para a conversa." />
              </div>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="privateNotes">Notas privadas do gestor</label>
            <textarea id="privateNotes" name="privateNotes" rows={3} placeholder="Hipóteses futuras ou pontos para observação. Não use para esconder acordo que afete a pessoa." />
          </div>
        </section>

        {!sourceMarcoZero && (
          <section className="card">
            <p className="eyebrow">Base da avaliação</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" name="initialFeedbackConfirmed" required style={{ marginTop: 4 }} />
              <span>Confirmo que a devolutiva/alinhamento inicial já ocorreu anteriormente e que não há necessidade de recriar um Marco Zero apenas para completar a sequência da plataforma.</span>
            </label>
          </section>
        )}

        <div><button className="button" type="submit">Criar Avaliação de 90 dias</button></div>
      </form>
    </main>
  );
}
