import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { appName, siteUrl } from '@/lib/shared';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: appName, template: '%s · Cloak' },
  description: 'Cloak documentation: user guide, SDK reference, platform and program architecture.',
  icons: { icon: '/favicon.svg' },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
