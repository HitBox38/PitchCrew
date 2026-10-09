import { releasesUrl, repository } from '../lib/links';
import { installerDefinitions } from './constants';
import type { Installer, Platform, Release } from './types';

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function validAsset(value: unknown): { name: string; url: string; size: number } | undefined {
  const asset = record(value);
  if (
    !asset ||
    typeof asset.name !== 'string' ||
    typeof asset.browser_download_url !== 'string' ||
    typeof asset.size !== 'number' ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0
  )
    return;
  try {
    const url = new URL(asset.browser_download_url);
    const expected = `${repository}/releases/download/`;
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.href.startsWith(expected) ||
      decodeURIComponent(url.pathname.split('/').at(-1) ?? '') !== asset.name
    )
      return;
    return { name: asset.name, url: url.href, size: asset.size };
  } catch {
    return;
  }
}

export function parseRelease(input: unknown): Release {
  const release = record(input);
  const assets =
    release?.draft === false && release?.prerelease === false && Array.isArray(release.assets)
      ? release.assets.map(validAsset).filter((asset) => asset !== undefined)
      : [];
  const installers: Installer[] = installerDefinitions.map(({ pattern, ...definition }) => {
    const asset = assets.find((entry) => pattern.test(entry.name));
    return {
      ...definition,
      filename: asset?.name ?? null,
      url: asset?.url ?? releasesUrl,
      size: asset?.size ?? null,
    };
  });
  return { installers, available: installers.some((installer) => installer.filename !== null) };
}

export function detectPlatform(userAgent: string): Platform | undefined {
  if (/Android|iPhone|iPad|Mobile/i.test(userAgent)) return;
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'mac';
  if (/Linux|X11/i.test(userAgent)) return 'linux';
}

export function installerSize(size: number): string {
  return `${Math.round(size / 1_000_000)} MB`;
}
