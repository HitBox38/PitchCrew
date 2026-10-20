import type { RuntimeId } from '@pitchcrew/core';
import { maintenanceDefinitions, runtimeVersion } from './catalog.ts';
import type { RuntimeInstallation } from './installation.ts';

/** Public metadata only. Never follows a redirect or executes a downloaded installer. */
async function readPublicText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok || !response.body)
    throw new Error('The runtime release source could not be reached.');
  let bytes = 0,
    text = '';
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 256_000) throw new Error('Runtime release metadata exceeded its limit.');
      text += new TextDecoder().decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
  return text;
}

async function readPublicMetadata(url: string, signal?: AbortSignal): Promise<unknown> {
  return JSON.parse(await readPublicText(url, signal));
}
export async function latestRuntimeVersion(
  id: Exclude<RuntimeId, 'demo'>,
  installation: RuntimeInstallation,
  signal?: AbortSignal,
): Promise<string | null> {
  const definition = maintenanceDefinitions[id];
  if (installation.installer === 'homebrew' && definition.brew) {
    const cask =
      installation.command?.args.includes('--cask') ||
      installation.realPath.replaceAll('\\', '/').includes('/Caskroom/');
    const result = (await readPublicMetadata(
      `https://formulae.brew.sh/api/${cask ? 'cask' : 'formula'}/${definition.brew}.json`,
      signal,
    )) as { version?: string; versions?: { stable?: string } };
    return cask ? (result.version ?? null) : (result.versions?.stable ?? null);
  }
  if (id === 'cursor-agent') {
    const installer = await readPublicText('https://cursor.com/install', signal);
    return (
      installer.match(
        /https:\/\/downloads\.cursor\.com\/lab\/(\d{4}\.\d{2}\.\d{2}-[a-f0-9]+)\//,
      )?.[1] ?? null
    );
  }
  if (definition.package) {
    const result = (await readPublicMetadata(
      `https://registry.npmjs.org/${encodeURIComponent(definition.package)}/latest`,
      signal,
    )) as { name?: unknown; version?: unknown };
    if (
      result.name !== definition.package ||
      typeof result.version !== 'string' ||
      runtimeVersion(result.version) !== result.version ||
      result.version.includes('-')
    )
      throw new Error('The runtime release source returned invalid stable metadata.');
    return result.version;
  }
  if (definition.repository) {
    const result = (await readPublicMetadata(
      `https://api.github.com/repos/${definition.repository}/releases/latest`,
      signal,
    )) as { tag_name?: unknown; prerelease?: unknown; draft?: unknown };
    if (result.prerelease || result.draft || typeof result.tag_name !== 'string')
      throw new Error('No stable runtime release could be verified.');
    const version = runtimeVersion(result.tag_name);
    return version?.includes('-') ? null : version;
  }
  return null;
}
