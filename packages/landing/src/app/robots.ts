import type { MetadataRoute } from 'next';
import { indexable, origin } from '../SEO/metadata';

const robots = (): MetadataRoute.Robots => {
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(indexable && origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
};
export default robots;
