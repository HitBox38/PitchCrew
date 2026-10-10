import { afterEach, describe, expect, it, vi } from 'vitest';
import { releasesUrl, repository } from '../../lib/links';
import { latestRelease } from '../api';
import { detectPlatform, parseRelease } from '../helpers';

const filename = 'Pitchcrew-0.1.0-mac-arm64.dmg';
const asset = {
  name: filename,
  browser_download_url: `${repository}/releases/download/build-fixture/${filename}`,
  size: 123000000,
};
const release = (assets: unknown[]) => ({ draft: false, prerelease: false, assets });
afterEach(() => vi.restoreAllMocks());

describe('public release downloads', () => {
  it('uses real assets and leaves missing architectures with a labeled Releases fallback', () => {
    const result = parseRelease(release([asset]));
    expect(result.installers[0]).toMatchObject({
      filename,
      url: asset.browser_download_url,
      size: 123000000,
    });
    expect(result.installers[1]).toMatchObject({ filename: null, url: releasesUrl });
    expect(result.installers).toHaveLength(5);
  });

  it.each([
    'https://github.com.evil.test/HitBox38/PitchCrew/releases/download/tag/file',
    `https://github.com/another/repo/releases/download/tag/${filename}`,
    `${repository}/releases/download/tag/wrong.dmg`,
    `https://user:password@github.com/HitBox38/PitchCrew/releases/download/tag/${filename}`,
    `${asset.browser_download_url}?secret=value`,
    'javascript:alert(1)',
  ])('rejects unsafe or mismatched asset URLs: %s', (url) => {
    expect(parseRelease(release([{ ...asset, browser_download_url: url }])).available).toBe(false);
  });

  it('ignores draft and prerelease installers', () => {
    expect(parseRelease({ ...release([asset]), draft: true }).available).toBe(false);
    expect(parseRelease({ ...release([asset]), prerelease: true }).available).toBe(false);
  });

  it('handles malformed release data without breaking the page', () => {
    for (const input of [null, {}, release([null, 'not an asset', { ...asset, size: -1 }])]) {
      expect(
        parseRelease(input).installers.every((installer) => installer.url === releasesUrl),
      ).toBe(true);
    }
  });

  it('recognizes the Linux architecture names produced by electron-builder', () => {
    const assets = ['Pitchcrew-0.1.0-linux-amd64.deb', 'Pitchcrew-0.1.0-linux-x86_64.AppImage'].map(
      (name) => ({
        name,
        size: 100,
        browser_download_url: `${repository}/releases/download/tag/${name}`,
      }),
    );
    expect(
      parseRelease(release(assets))
        .installers.filter((installer) => installer.platform === 'linux')
        .every((installer) => installer.filename !== null),
    ).toBe(true);
  });

  it('keeps the page usable when GitHub is unavailable or returns an error', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('rate limited', { status: 403 }));
    expect((await latestRelease()).available).toBe(false);
    expect((await latestRelease()).installers[0].url).toBe(releasesUrl);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ next: { revalidate: 3600 } }),
    );
  });

  it('detects desktop operating systems without mistaking phones for desktop machines', () => {
    expect(detectPlatform('Mozilla Windows NT 10.0')).toBe('windows');
    expect(detectPlatform('Mozilla Macintosh; Intel Mac OS X')).toBe('mac');
    expect(detectPlatform('Mozilla X11; Linux x86_64')).toBe('linux');
    expect(detectPlatform('Mozilla Android Linux Mobile')).toBeUndefined();
    expect(detectPlatform('Mozilla iPhone like Mac OS X')).toBeUndefined();
  });
});
