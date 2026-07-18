import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Work_Sans } from 'next/font/google';
import Nav from '../components/Nav';
import AmbientBackground from '../components/AmbientBackground';
import AuthCloudSync from '../components/AuthCloudSync';
import PwaRegister from '../components/PwaRegister';
import { LanguageProvider } from '../components/LanguageProvider';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '600']
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600']
});

export const metadata: Metadata = {
  title: {
    default: 'Wishflow · Life-long Wish Navigation',
    template: '%s · Wishflow',
  },
  description:
    'A gentle, life-long wish navigation system. Leave your wish here — no streaks, no deadlines, no pressure. It will wait for you through every season.',
  applicationName: 'Wishflow',
  keywords: ['wishes', 'manifestation', 'mindfulness', 'gentle productivity', 'life goals', '愿望', '愿航'],
  openGraph: {
    title: 'Wishflow · Life-long Wish Navigation',
    description:
      'Leave your wish here. No streaks, no deadlines, no pressure — it will wait for you through every season.',
    type: 'website',
    siteName: 'Wishflow',
  },
  appleWebApp: {
    capable: true,
    title: 'Wishflow',
    statusBarStyle: 'default',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-180.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FAF9F7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${workSans.variable}`}>
        <AmbientBackground />
        <LanguageProvider>
          <PwaRegister />
          <AuthCloudSync />
          <Nav />
          <main>{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
