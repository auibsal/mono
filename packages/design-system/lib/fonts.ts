import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';

// Geist has no Arabic glyphs; Arabic text falls through to IBM Plex Sans
// Arabic via the --font-sans stack in styles/globals.css.
const arabic = IBM_Plex_Sans_Arabic({
  display: 'swap',
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['400', '500', '600', '700'],
});

export const fonts = cn(
  GeistSans.variable,
  GeistMono.variable,
  arabic.variable,
  'touch-manipulation font-sans antialiased'
);
