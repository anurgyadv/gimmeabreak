import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'CoverAssist — A better way to plan leave',
  description: 'Explore leave, understand coverage, and find a way forward. A synthetic workforce planning prototype.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
