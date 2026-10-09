import type { Metadata } from 'next';
import { documentationUrl, releasesUrl, repository } from '../lib/links';
import { searchDescription, searchTitle } from './constants';

export function canIndex(
  origin: string | undefined,
  runtime: string | undefined,
  deployment: string | undefined,
) {
  return (
    Boolean(origin) && runtime === 'production' && (!deployment || deployment === 'production')
  );
}

export function createMetadata(origin: string | undefined, index: boolean): Metadata {
  return {
    title: searchTitle,
    description: searchDescription,
    applicationName: 'Pitchcrew',
    category: 'technology',
    ...(origin ? { metadataBase: new URL(origin), alternates: { canonical: '/' } } : {}),
    icons: { icon: '/favicon.svg' },
    robots: {
      index,
      follow: true,
      googleBot: { index, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    openGraph: {
      title: searchTitle,
      description: searchDescription,
      type: 'website',
      siteName: 'Pitchcrew',
      locale: 'en_US',
      ...(origin ? { url: `${origin}/` } : {}),
    },
    twitter: { card: 'summary_large_image', title: searchTitle, description: searchDescription },
  };
}

export function structuredData(origin: string | undefined) {
  const app = {
    '@type': 'SoftwareApplication',
    name: 'Pitchcrew',
    description: searchDescription,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'macOS, Windows, Linux',
    isAccessibleForFree: true,
    downloadUrl: releasesUrl,
    softwareHelp: documentationUrl,
    sameAs: repository,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      description: 'Free app. Separate AI provider charges may apply.',
    },
    ...(origin
      ? {
          '@id': `${origin}/#app`,
          url: `${origin}/`,
          screenshot: `${origin}/screenshots/board.png`,
        }
      : {}),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': origin
      ? [
          {
            '@type': 'WebSite',
            '@id': `${origin}/#website`,
            name: 'Pitchcrew',
            url: `${origin}/`,
            inLanguage: 'en',
            sameAs: repository,
          },
          {
            '@type': 'WebPage',
            '@id': `${origin}/#webpage`,
            url: `${origin}/`,
            name: searchTitle,
            description: searchDescription,
            inLanguage: 'en',
            isPartOf: { '@id': `${origin}/#website` },
            mainEntity: { '@id': `${origin}/#app` },
          },
          app,
        ]
      : [app],
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
