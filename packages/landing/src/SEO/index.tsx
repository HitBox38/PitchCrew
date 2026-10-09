import { siteOrigin } from '../lib/links';
import { serializeJsonLd, structuredData } from './helpers';

export function SEO() {
  return (
    <script
      type="application/ld+json"
      id="pitchcrew-structured-data"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData(siteOrigin())) }}
    />
  );
}
