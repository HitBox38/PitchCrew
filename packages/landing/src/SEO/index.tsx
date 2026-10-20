import { siteOrigin } from '../lib/links';
import { serializeJsonLd, structuredData } from './helpers';

export const SEO = () => {
  return (
    <script
      type="application/ld+json"
      id="pitchcrew-structured-data"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData(siteOrigin())) }}
    />
  );
};
