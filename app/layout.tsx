import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: { default: 'Cloak Documentation', template: '%s · Cloak' },
  description: 'Cloak documentation',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
