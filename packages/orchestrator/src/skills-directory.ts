import { skillInput, skillsShUrl, type SkillPreview } from '@pitchcrew/core';
import { baseSkills, skillContentLimit } from '@pitchcrew/core/base-skills';
import { parseDocument } from 'yaml';
import { z } from 'zod';

const treeSchema = z.object({
  truncated: z.boolean(),
  tree: z
    .array(
      z.object({
        path: z.string().max(1000),
        type: z.string(),
        mode: z.string(),
        sha: z.string().regex(/^[a-f0-9]{40}$/),
        size: z.number().optional(),
      }),
    )
    .max(30000),
});
const blobSchema = z.object({
  sha: z.string(),
  encoding: z.literal('base64'),
  content: z.string().max(100000),
  size: z.number().max(64000),
});
function definition(text: string) {
  const match = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match || match[1].length > 8000)
    throw new Error('The skill needs valid YAML frontmatter and Markdown instructions.');
  const document = parseDocument(match[1], {
    schema: 'failsafe',
    stringKeys: true,
    logLevel: 'silent',
  });
  if (document.errors.length || document.warnings.length)
    throw new Error('The skill has invalid YAML frontmatter.');
  const metadata = z
    .object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(500).default(''),
    })
    .parse(document.toJS({ maxAliasCount: 0 }));
  return { ...metadata, content: match[2].trim() };
}

// Only public GitHub objects are read. No CLI installer, credentials, redirects or repository code.
export class SkillDirectory {
  private readonly blobs = new Map<string, string>();
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}
  private async read(url: string, maxBytes: number, signal: AbortSignal) {
    const response = await this.fetcher(url, {
      redirect: 'error',
      signal,
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'Pitchcrew',
        'x-github-api-version': '2026-03-10',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      if ([403, 429].includes(response.status))
        throw new Error('GitHub’s public request limit was reached. Try importing again later.');
      throw new Error('The public skill repository could not be read. Check the skills.sh URL.');
    }
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new Error('The skill repository response is too large.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The skill source returned an empty response.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error('The skill repository response is too large.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  async preview(value: string, parentSignal?: AbortSignal): Promise<SkillPreview> {
    const url = new URL(skillsShUrl.parse(value));
    const [owner, repo, slug] = url.pathname.split('/').filter(Boolean);
    const requestedRepository = `${owner}/${repo}`;
    const starter = baseSkills.find(
      (skill) =>
        [skill.source, ...(skill.sourceAliases ?? [])].some(
          (source) => source.toLowerCase() === requestedRepository.toLowerCase(),
        ) && skill.name.toLowerCase() === slug.toLowerCase(),
    );
    const repository = starter?.source ?? requestedRepository;
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000);
    signal.throwIfAborted();
    // Resolve HEAD on every load. Only immutable blob contents may be reused.
    const tree = treeSchema.parse(
      await this.read(
        `https://api.github.com/repos/${repository}/git/trees/HEAD?recursive=1`,
        2000000,
        signal,
      ),
    );
    if (tree.truncated) throw new Error('This skill repository is too large to import.');
    const candidates = tree.tree.filter(
      (file) =>
        file.type === 'blob' &&
        ['100644', '100755'].includes(file.mode) &&
        (starter
          ? file.path === starter.skillPath
          : file.path === 'SKILL.md' || file.path.endsWith('/SKILL.md')),
    );
    const priority = (path: string) => {
      const folder = path.split('/').at(-2)?.toLowerCase() ?? '';
      return folder === slug.toLowerCase()
        ? 0
        : folder && slug.toLowerCase().endsWith(`-${folder}`)
          ? 1
          : 2;
    };
    candidates.sort((a, b) => priority(a.path) - priority(b.path));
    for (const file of candidates.slice(0, 20)) {
      signal.throwIfAborted();
      if (file.size && file.size > 64000) continue;
      const key = `${repository}/${file.sha}`;
      let text = this.blobs.get(key);
      if (text === undefined) {
        const blob = blobSchema.parse(
          await this.read(
            `https://api.github.com/repos/${repository}/git/blobs/${file.sha}`,
            150000,
            signal,
          ),
        );
        if (blob.sha !== file.sha) throw new Error('The skill source returned a different file.');
        const bytes = Buffer.from(blob.content, 'base64');
        if (bytes.length !== blob.size || bytes.length > 64000)
          throw new Error('The skill source returned an invalid file size.');
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (this.blobs.size >= 60) this.blobs.delete(this.blobs.keys().next().value!);
        this.blobs.set(key, text);
      }
      let parsed: ReturnType<typeof definition>;
      try {
        parsed = definition(text);
      } catch {
        continue;
      }
      if (parsed.name.toLowerCase().replace(/\s+/g, '-') !== slug.toLowerCase()) continue;
      if (!parsed.content || parsed.content.length > skillContentLimit)
        throw new Error('The skill instructions must contain 1–50,000 characters to import.');
      const source = {
        url: `https://skills.sh/${repository}/${slug}`,
        repository,
        path: file.path,
        blobSha: file.sha,
        fetchedAt: new Date().toISOString(),
      };
      const skill = skillInput.parse({ ...parsed, source, scope: 'all', roleIds: [] });
      return { name: skill.name, description: skill.description, content: skill.content, source };
    }
    throw new Error(
      starter
        ? `The starter skill could not be loaded from ${starter.skillPath}. Its upstream file may have moved or changed.`
        : 'No matching SKILL.md was found. Imports support public GitHub repositories and check up to 20 skill definitions.',
    );
  }
}
export const skillDirectory = new SkillDirectory();
