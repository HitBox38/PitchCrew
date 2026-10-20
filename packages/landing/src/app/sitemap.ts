import type { MetadataRoute } from 'next';
import { indexable, origin } from '../SEO/metadata';

const sitemap = (): MetadataRoute.Sitemap => {
  return indexable && origin
    ? [
        {
          url: `${origin}/`,
          images: [`${origin}/screenshots/board.png`],
        },
      ]
    : [];
};
export default sitemap;
