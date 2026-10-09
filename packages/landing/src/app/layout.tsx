import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { siteMetadata } from '../SEO/metadata';
import { themeScript } from '../Theme/constants';
import './globals.css';

const serif = localFont({
  src: '../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2',
  variable: '--font-fraunces',
  display: 'swap',
  weight: '100 900',
});
const sans = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2',
      weight: '600',
    },
    {
      path: '../../node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2',
      weight: '700',
    },
  ],
  variable: '--font-source-sans',
  display: 'swap',
});
export const metadata: Metadata = siteMetadata;
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f1ec' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1b1e' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
