import type { Metadata, Viewport } from 'next';
import RegisterSW from '@/components/RegisterSW';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: 'Poupa Mais — Cartão Digital',
  description: 'POC de cartão digital e cupões com códigos de barras',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    // Standalone display on iOS home-screen installs (hides the address bar)
    capable: true,
    statusBarStyle: 'default',
    title: 'Poupa Mais',
  },
  icons: {
    icon: `${basePath}/icons/icon-192.png`,
    apple: `${basePath}/icons/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // prevent pinch-zoom breaking the presented barcode layout
  themeColor: '#FFFFFF',
  viewportFit: 'cover', // draw under the notch; safe-area insets handle spacing
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
