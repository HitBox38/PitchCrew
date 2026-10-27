import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseCookieExport } from '../src/browser/cookie-import.ts';
import { nativeProfiles, profilePartition } from '../src/browser/profiles.ts';

it('parses reviewed JSON/Netscape exports without accepting malformed or oversized cookie scopes', () => {
  const cookie = {
    domain: '.example.com',
    path: '/',
    name: 'fictional_session',
    value: 'fictional-value',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  };
  const parsed = parseCookieExport(
    JSON.stringify({
      cookies: [cookie, { ...cookie, name: 'partitioned', partitionKey: 'https://example.com' }],
    }),
  );
  expect(parsed.cookies).toHaveLength(1);
  expect(parsed.skipped).toBe(1);
  expect(parsed.domains).toEqual(['example.com']);
  expect(parsed.cookies[0]).toMatchObject({
    url: 'https://example.com/',
    sameSite: 'lax',
    httpOnly: true,
  });
  expect(
    parseCookieExport(
      '# Netscape HTTP Cookie File\n#HttpOnly_.example.com\tTRUE\t/\tTRUE\t0\tfixture\tfictional-value',
    ).cookies[0].httpOnly,
  ).toBe(true);
  expect(
    parseCookieExport(JSON.stringify([{ ...cookie, expires: -1 }])).cookies[0].expirationDate,
  ).toBeUndefined();
  expect(() => parseCookieExport(JSON.stringify([{ ...cookie, domain: 'localhost' }]))).toThrow();
  expect(() =>
    parseCookieExport(JSON.stringify([{ ...cookie, name: '__Host-session' }])),
  ).toThrow();
  expect(() => parseCookieExport('x'.repeat(1_000_001))).toThrow('1 MB');
  expect(() => parseCookieExport(JSON.stringify([cookie, cookie]))).toThrow('duplicate');
});
it('persists named agent profiles and isolates partitions while preserving the old default partition', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-profile-store-'));
  const base = 'a'.repeat(64);
  const id = '8533d8c4-4846-4fe3-a1dd-3685cbd2f6f5';
  try {
    const store = await nativeProfiles(directory);
    await store.update(base, (record) => {
      record.profiles.push({ id, name: 'Work' });
      record.selectedId = id;
    });
    const restored = await nativeProfiles(directory);
    expect(restored.get(base)).toMatchObject({
      selectedId: id,
      profiles: [{ id: 'default' }, { id, name: 'Work' }],
    });
    expect(profilePartition(base, 'default')).toBe(base);
    expect(profilePartition(base, id)).not.toBe(profilePartition('b'.repeat(64), id));
    await expect(
      store.update(base, (record) => {
        record.selectedId = 'missing';
      }),
    ).rejects.toThrow('existing');
    expect(store.get(base).selectedId).toBe(id);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
