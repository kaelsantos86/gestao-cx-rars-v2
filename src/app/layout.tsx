import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão CX RARS',
  description: 'Gestão de pessoas, desenvolvimento e trajetória profissional do time de CX.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <div className="topbarInner">
            <Link className="brand" href="/">
              <span className="brandMark">CX</span>
              <span>
                <strong>Gestão CX RARS</strong>
                <small>V2.0</small>
              </span>
            </Link>
            <nav className="mainNav" aria-label="Navegação principal">
              <Link href="/">Home</Link>
              <Link href="/team">Minha Equipe</Link>
              <Link href="/login">Acesso</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
