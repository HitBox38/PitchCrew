import { siteOrigin } from '../lib/links';
import { canIndex, createMetadata } from './helpers';

export const origin = siteOrigin();
export const indexable = canIndex(origin, process.env.NODE_ENV, process.env.VERCEL_ENV);
export const siteMetadata = createMetadata(origin, indexable);
