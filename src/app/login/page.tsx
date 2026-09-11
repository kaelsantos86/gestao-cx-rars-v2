import { redirect } from 'next/navigation';
import { hasSupabaseEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

async function login(formData: FormData) {
  'use server';

  if (!hasSupabaseEnv()) redirect('/login?setup=1');

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect('/login?error=login');
  redirect('/');
}

async function signUp(formData: FormData) {
  'use server';

  if (!hasSupabaseEnv()) redirect('/login?setup=1');

  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (fullName.length < 2 || password.length < 8) {
    redirect('/login?error=signup');
  }

  const supabase = await createClient();
  const { data: signupState, error: stateError } = await supabase.rpc('manager_signup_available');

  if (stateError || signupState !== true) {
    redirect('/login?error=closed');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) redirect('/login?error=signup');
  if (data.session) redirect('/');

  redirect('/login?registered=1');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; error?: string; registered?: string }>;
}) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();
  let signupAvailable = false;

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('manager_signup_available');
    signupAvailable = data === true;
  }

  return (
    <main className="page">
      <div style={{ maxWidth: 980, margin: '32px auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p className="eyebrow">Acesso do gestor</p>
          <h1 className="pageTitle" style={{ fontSize: 38 }}>Gestão CX RARS</h1>
          <p className="lead" style={{ margin: '12px auto 0' }}>
            A autenticação passa a ser a chave da base centralizada da V2, substituindo a dependência dos links gerenciais da versão anterior.
          </p>
        </div>

        {!configured && (
          <div className="notice" style={{ marginBottom: 18 }}>
            Supabase ainda não conectado ao ambiente de execução. O aplicativo permanece em modo demonstração até as variáveis de ambiente serem configuradas.
          </div>
        )}
        {params.setup && <div className="notice" style={{ marginBottom: 18 }}>Configure o Supabase antes de autenticar.</div>}
        {params.error === 'login' && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível entrar. Confira e-mail e senha.</div>}
        {params.error === 'signup' && <div className="notice" style={{ marginBottom: 18 }}>Não foi possível criar o acesso. Confira nome, e-mail e uma senha com pelo menos 8 caracteres.</div>}
        {params.error === 'closed' && <div className="notice" style={{ marginBottom: 18 }}>O primeiro acesso gerencial já foi concluído. Use a opção Entrar.</div>}
        {params.error === 'unauthorized' && <div className="notice" style={{ marginBottom: 18 }}>Esta conta não possui perfil gerencial autorizado.</div>}
        {params.registered && (
          <div className="notice" style={{ marginBottom: 18 }}>
            Cadastro recebido. Se a confirmação de e-mail estiver ativa no Supabase, confirme a mensagem enviada e depois entre normalmente.
          </div>
        )}

        <div className={signupAvailable ? 'grid grid2' : 'grid'} style={!signupAvailable ? { maxWidth: 560, margin: '0 auto' } : undefined}>
          <section className="card">
            <p className="eyebrow">Acesso gerencial</p>
            <h2>Entrar</h2>
            {!signupAvailable && <p className="muted" style={{ fontSize: 14 }}>O primeiro acesso já foi concluído. Entre com a conta gerencial cadastrada.</p>}
            <form action={login}>
              <div className="field">
                <label htmlFor="login-email">E-mail</label>
                <input id="login-email" name="email" type="email" autoComplete="email" required disabled={!configured} />
              </div>
              <div className="field">
                <label htmlFor="login-password">Senha</label>
                <input id="login-password" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
              </div>
              <button className="button" type="submit" disabled={!configured} style={{ width: '100%', opacity: configured ? 1 : .5 }}>
                Entrar
              </button>
            </form>
          </section>

          {signupAvailable && (
            <section className="card">
              <p className="eyebrow">Primeiro acesso</p>
              <h2>Criar conta do gestor</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Use este cadastro apenas para a primeira conta gerencial. Os colaboradores continuarão acessando os formulários pelos links seguros de cada módulo.
              </p>
              <form action={signUp}>
                <div className="field">
                  <label htmlFor="signup-name">Nome</label>
                  <input id="signup-name" name="fullName" type="text" autoComplete="name" required disabled={!configured} />
                </div>
                <div className="field">
                  <label htmlFor="signup-email">E-mail</label>
                  <input id="signup-email" name="email" type="email" autoComplete="email" required disabled={!configured} />
                </div>
                <div className="field">
                  <label htmlFor="signup-password">Senha</label>
                  <input id="signup-password" name="password" type="password" minLength={8} autoComplete="new-password" required disabled={!configured} />
                </div>
                <button className="button buttonSecondary" type="submit" disabled={!configured} style={{ width: '100%', opacity: configured ? 1 : .5 }}>
                  Criar acesso
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
