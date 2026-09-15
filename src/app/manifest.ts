import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gestão CX RARS',
    short_name: 'CX RARS',
    description: 'Gestão de pessoas, desenvolvimento e trajetória profissional do time de CX.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F7F6',
    theme_color: '#0B5D4B',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
