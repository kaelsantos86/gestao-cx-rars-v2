import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const schedule = request.headers.get('x-vercel-cron-schedule');
  const userAgent = request.headers.get('user-agent');

  // Esta rota não lê nem altera dados. Ainda assim, aceita somente a assinatura
  // operacional enviada pelo Vercel Cron para o agendamento configurado.
  if (schedule !== '0 9 * * *' || userAgent !== 'vercel-cron/1.0') {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const { url, key } = getSupabaseEnv();
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // A documentação do Supabase indica que algumas consultas diárias costumam
    // ser suficientes para que um projeto Free não seja classificado como inativo.
    const probes = await Promise.all([
      supabase.rpc('keep_project_active'),
      supabase.rpc('keep_project_active'),
      supabase.rpc('keep_project_active'),
    ]);
    const failure = probes.find((probe) => probe.error);

    if (failure?.error) {
      console.error('[cron/keep-alive] Supabase probe failed', {
        code: failure.error.code,
        message: failure.error.message,
      });
      return Response.json({ ok: false }, { status: 503 });
    }

    console.info('[cron/keep-alive] Supabase activity registered');
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[cron/keep-alive] Unexpected failure', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
