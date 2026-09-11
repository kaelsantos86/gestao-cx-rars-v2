import { redirect } from 'next/navigation';
import { hasSupabaseEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

async function login(formData: FormData) {
  'use server';

  if (!hasSupabaseEnv()) redirect('/login?setup=1');

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect('/login?error=1');
  redirect('/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();

  return (
    <main className="page">
      <section className="formCard">
        <p className="eyebrow">Acesso do gestor</p>
        <h1 style={{ marginTop: 0 }}>Entrar na Gestão CX</h1>
        <p className="muted">O login será a chave da base centralizada da V2, substituindo a dependência dos links gerenciais da versão anterior.</p>

        {!configured && (
          <div className="notice" style={{ marginBottom: 18 }}>
            Supabase ainda não conectado. O aplicativo está em modo demonstração; configure as variáveis de <code>.env.example</code> para ativar autenticação e banco reais.
          </div>
        )}
        {params.setup && <div className="notice" style={{ marginBottom: 18 }}>Configure o Supabase antes de autenticar.</div>}
        {params.error && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível entrar. Confira e-mail e senha.</div>}

        <form action={login}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required disabled={!configured} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
          </div>
          <button className="button" type="submit" disabled={!configured} style={{ width: '100%', opacity: configured ? 1 : .5 }}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
