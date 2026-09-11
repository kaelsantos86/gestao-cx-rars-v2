import type { Metadata } from 'next';
import { AppHeader } from '@/components/app-header';
import './globals.css';
import './forms.css';

export const metadata: Metadata = {
  title: 'Gestão CX RARS',
  description: 'Gestão de pessoas, desenvolvimento e trajetória profissional do time de CX.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
