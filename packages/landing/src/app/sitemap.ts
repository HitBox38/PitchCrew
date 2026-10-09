import type { MetadataRoute } from 'next';
import { indexable, origin } from '../SEO/metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return indexable && origin
    ? [
        {
          url: `${origin}/`,
          images: ['board', 'chat', 'review'].map((view) => `${origin}/screenshots/${view}.png`),
        },
      ]
    : [];
}
