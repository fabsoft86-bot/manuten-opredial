import type { Metadata, Viewport } from 'next';

import { AuthGuard } from '../components/AuthGuard';
import { InstallPrompt } from '../components/pwa/InstallPrompt';
import { ServiceWorkerRegister } from '../components/pwa/ServiceWorkerRegister';
import './globals.css';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'FixPro • Gestão de Manutenção',
  description: 'Ordens de serviço e manutenção predial, com suporte offline.',
  applicationName: 'FixPro',
  appleWebApp: { capable: true, title: 'FixPro', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#020617',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
