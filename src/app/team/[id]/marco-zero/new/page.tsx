import { redirect, notFound } from 'next/navigation';
import { hasSupabaseEnv } from '@/lib/env';
import { requireManager } from '@/lib/auth';
import { getEmployee } from '@/lib/data/team';
import { marcoZeroManagerFields } from '@/lib/marco-zero';

async function createMarcoZero(formData: FormData) {
  'use server';

  const employeeId = String(formData.get('employeeId') ?? '');
  if (!hasSupabaseEnv()) redirect(`/team/${employeeId}/marco-zero/new?setup=1`);

  const auth = await requireManager();
  const payload = Object.fromEntries(
    marcoZeroManagerFields.map(([key]) => [key, String(formData.get(key) ?? '')]),
  );

  Object.assign(payload, {
    firstDelivery: String(formData.get('firstDelivery') ?? ''),
    firstMilestone: String(formData.get('firstMilestone') ?? ''),
    firstDeliveryDate: String(formData.get('firstDeliveryDate') ?? ''),
    supportNeeded: String(formData.get('supportNeeded') ?? ''),
    successEvidence: String(formData.get('successEvidence') ?? ''),
    nextOneToOne: String(formData.get('nextOneToOne') ?? ''),
    review30Days: String(formData.get('review30Days') ?? ''),
  });

  const { data, error } = await auth!.supabase
    .from('module_records')
    .insert({
      employee_id: employeeId,
      manager_id: auth!.user.id,
      module_type: 'marco_zero',
      status: 'awaiting_participant',
      cycle_label: 'Marco Zero',
      occurred_on: new Date().toISOString().slice(0, 10),
      payload,
    })
    .select('id')
    .single();

  if (error) throw error;
  redirect(`/records/${data.id}/marco-zero`);
}

export default async function NewMarcoZeroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ setup?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const connected = hasSupabaseEnv();

  return (
    <main className="page">
      <p className="eyebrow">Marco Zero · Gestor</p>
      <h1 className="pageTitle">Preparar alinhamento</h1>
      <p className="lead">{employee.displayName} · {employee.currentRole}. Registre direção, critérios e autonomia antes de compartilhar a preparação com a pessoa.</p>

      {!connected && <div className="notice" style={{ marginBottom: 20 }}>Modo demonstração: conecte o Supabase para criar um registro persistente. O formulário abaixo permite validar a estrutura sem gravar dados.</div>}
      {query.setup && <div className="notice" style={{ marginBottom: 20 }}>O Marco Zero só pode ser persistido após a conexão do Supabase.</div>}

      <form action={createMarcoZero} className="card">
        <input type="hidden" name="employeeId" value={employee.id} />
        <div className="grid grid2">
          {marcoZeroManagerFields.map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <textarea id={key} name={key} rows={4} required={['purpose','expectedContribution','qualityCriteria','first30Days','autonomy'].includes(key)} placeholder="Registre fatos, direção e critérios observáveis." />
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0 22px', paddingTop: 22 }}>
          <p className="eyebrow">Primeiro ciclo</p>
          <h2 style={{ marginTop: 0 }}>Primeira entrega e acompanhamento</h2>
          <div className="grid grid2">
            <div className="field"><label htmlFor="firstDelivery">Resultado / entrega</label><textarea id="firstDelivery" name="firstDelivery" rows={3} /></div>
            <div className="field"><label htmlFor="firstMilestone">Primeiro marco</label><textarea id="firstMilestone" name="firstMilestone" rows={3} /></div>
            <div className="field"><label htmlFor="firstDeliveryDate">Data da entrega</label><input id="firstDeliveryDate" name="firstDeliveryDate" type="date" /></div>
            <div className="field"><label htmlFor="supportNeeded">Apoio necessário</label><textarea id="supportNeeded" name="supportNeeded" rows={3} /></div>
            <div className="field"><label htmlFor="successEvidence">Evidência de sucesso</label><textarea id="successEvidence" name="successEvidence" rows={3} /></div>
            <div className="field"><label htmlFor="nextOneToOne">Próximo 1:1</label><input id="nextOneToOne" name="nextOneToOne" type="date" /></div>
            <div className="field"><label htmlFor="review30Days">Revisão de 30 dias</label><input id="review30Days" name="review30Days" type="date" /></div>
          </div>
        </div>

        <button className="button" type="submit" disabled={!connected} style={{ opacity: connected ? 1 : .55 }}>Criar Marco Zero</button>
      </form>
    </main>
  );
}
