import type { Metadata, Viewport } from 'next';
import { AppHeader } from '@/components/app-header';
import { PdiNewEnhancer } from '@/components/pdi-new-enhancer';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';
import './forms.css';

export const metadata: Metadata = {
  title: 'Gestão CX RARS',
  applicationName: 'CX RARS',
  description: 'Gestão de pessoas, desenvolvimento e trajetória profissional do time de CX.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'CX RARS',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0B5D4B',
  colorScheme: 'light',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        <AppHeader />
        <PdiNewEnhancer />
        {children}
      </body>
    </html>
  );
}
