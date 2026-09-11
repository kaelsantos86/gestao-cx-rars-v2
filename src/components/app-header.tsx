'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppHeader() {
  const pathname = usePathname();
  const isParticipantRoute = pathname.startsWith('/participate/');

  if (isParticipantRoute) {
    return (
      <header className="topbar">
        <div className="topbarInner">
          <div className="brand" aria-label="Gestão CX RARS — participação segura">
            <span className="brandMark">CX</span>
            <span>
              <strong>Gestão CX RARS</strong>
              <small>Participação segura</small>
            </span>
          </div>
        </div>
      </header>
    );
  }

  return (
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
  );
}
