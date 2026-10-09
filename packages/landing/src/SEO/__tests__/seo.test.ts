import { describe, expect, it } from 'vitest';
import { canIndex, createMetadata, serializeJsonLd, structuredData } from '../helpers';

describe('landing search configuration', () => {
  it('indexes only production with a configured canonical origin', () => {
    const origin = 'https://pitchcrew.example';
    expect(canIndex(origin, 'production', 'production')).toBe(true);
    expect(canIndex(origin, 'production', undefined)).toBe(true);
    expect(canIndex(undefined, 'production', 'production')).toBe(false);
    expect(canIndex(origin, 'development', undefined)).toBe(false);
    expect(canIndex(origin, 'production', 'preview')).toBe(false);
    expect(canIndex(origin, 'production', 'development')).toBe(false);
  });

  it('uses one origin for canonical metadata and connected website/app entities', () => {
    const origin = 'https://pitchcrew.example';
    const metadata = createMetadata(origin, true);
    expect(String(metadata.metadataBase)).toBe(`${origin}/`);
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph).toMatchObject({ url: `${origin}/`, siteName: 'Pitchcrew' });
    const graph = structuredData(origin)['@graph'];
    expect(graph).toContainEqual(
      expect.objectContaining({ '@type': 'WebSite', url: `${origin}/` }),
    );
    expect(graph).toContainEqual(
      expect.objectContaining({ '@type': 'WebPage', mainEntity: { '@id': `${origin}/#app` } }),
    );
    expect(graph).toContainEqual(
      expect.objectContaining({
        '@type': 'SoftwareApplication',
        '@id': `${origin}/#app`,
        offers: expect.objectContaining({ price: 0 }),
      }),
    );
  });

  it('does not invent a domain or ratings when deployment details are missing', () => {
    expect(createMetadata(undefined, false).alternates).toBeUndefined();
    const data = structuredData(undefined);
    expect(data['@graph']).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('aggregateRating');
    expect(JSON.stringify(data)).not.toContain('localhost');
    expect(createMetadata(undefined, false).robots).toMatchObject({ index: false });
  });

  it('escapes HTML script terminators without changing JSON-LD data', () => {
    const data = { name: '</script><script>alert(1)</script>' };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual(data);
  });
});
