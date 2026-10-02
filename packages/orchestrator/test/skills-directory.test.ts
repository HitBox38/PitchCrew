import { describe, expect, it, vi } from 'vitest';
import { SkillDirectory } from '../src/skills-directory.ts';
const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const url = 'https://skills.sh/fictional/crew-skills/evidence-checklist';
const text =
  '---\nname: evidence-checklist\ndescription: >\n  Use when checking\n  profile claims.\n---\n\n# Evidence checklist\n\nVerify exact profile quotes.\n';
function fixture(raw = text, path = 'skills/evidence-checklist/SKILL.md') {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    if (String(input).includes('/git/trees/'))
      return Response.json({
        truncated: false,
        tree: [
          { path, sha, type: 'blob', mode: '100644', size: Buffer.byteLength(raw) },
          { path: 'scripts/untrusted.js', sha: otherSha, type: 'blob', mode: '100755', size: 42 },
        ],
      });
    if (String(input).endsWith(`/git/blobs/${sha}`))
      return Response.json({
        sha,
        encoding: 'base64',
        size: Buffer.byteLength(raw),
        content: Buffer.from(raw).toString('base64'),
      });
    throw new Error('Unexpected external request.');
  });
  return { fetcher, directory: new SkillDirectory(fetcher) };
}
describe('skills.sh Markdown imports', () => {
  it('reads public immutable blobs, parses folded frontmatter, caches sources and refreshes on demand', async () => {
    const { directory, fetcher } = fixture();
    const preview = await directory.preview(url);
    expect(preview).toMatchObject({
      name: 'evidence-checklist',
      description: 'Use when checking profile claims.',
      content: '# Evidence checklist\n\nVerify exact profile quotes.',
      source: {
        url,
        repository: 'fictional/crew-skills',
        path: 'skills/evidence-checklist/SKILL.md',
        blobSha: sha,
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [target, options] of fetcher.mock.calls) {
      expect(String(target)).toMatch(
        /^https:\/\/api\.github\.com\/repos\/fictional\/crew-skills\/git\/(trees|blobs)\//,
      );
      expect(options?.redirect).toBe('error');
      expect(options?.headers).not.toHaveProperty('authorization');
    }
    expect(await directory.preview(url)).toMatchObject({
      ...preview,
      source: { ...preview.source, fetchedAt: expect.any(String) },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await directory.preview(url, undefined, true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('finds skills when their directory name differs from frontmatter and prioritizes matching folders', async () => {
    const { directory } = fixture(text, 'skills/checklist/SKILL.md');
    expect((await directory.preview(url)).name).toBe('evidence-checklist');
  });
  it.each([
    'http://skills.sh/fictional/crew-skills/evidence-checklist',
    'https://skills.sh.evil.invalid/fictional/crew-skills/evidence-checklist',
    'https://user:password@skills.sh/fictional/crew-skills/evidence-checklist',
    'https://skills.sh:1234/fictional/crew-skills/evidence-checklist',
    'https://127.0.0.1/fictional/crew-skills/evidence-checklist',
    'https://skills.sh/fictional/crew-skills/%2e%2e/evidence-checklist',
    'https://skills.sh/fictional/crew-skills/evidence-checklist?redirect=http://127.0.0.1',
  ])('rejects unsupported URLs before any network request: %s', async (invalid) => {
    const { directory, fetcher } = fixture();
    await expect(directory.preview(invalid)).rejects.toThrow('skills.sh skill URL');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects truncated trees and oversized streamed responses', async () => {
    const truncated = new SkillDirectory(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ truncated: true, tree: [] })),
    );
    await expect(truncated.preview(url)).rejects.toThrow('too large');
    const huge = new SkillDirectory(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(2000001))),
    );
    await expect(huge.preview(url)).rejects.toThrow('too large');
  });
  it.each([
    '# Missing frontmatter',
    '---\nname: evidence-checklist\ndescription: &anchor test\nother: *anchor\n---\nbody',
    '---\nname: evidence-checklist\nname: overridden\n---\nbody',
    '---\nname: different-skill\n---\nbody',
  ])('does not import malformed, aliased or mismatched definitions', async (raw) => {
    const { directory } = fixture(raw);
    await expect(directory.preview(url)).rejects.toThrow('No matching');
  });
  it('imports longer writing skills but rejects instructions beyond the skill limit and symlinks', async () => {
    const longSkill = fixture(`---\nname: evidence-checklist\n---\n${'x'.repeat(32000)}`);
    expect((await longSkill.directory.preview(url)).content).toHaveLength(32000);
    const { directory } = fixture(`---\nname: evidence-checklist\n---\n${'x'.repeat(50001)}`);
    await expect(directory.preview(url)).rejects.toThrow('50,000');
    const symlink = new SkillDirectory(
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          truncated: false,
          tree: [
            {
              path: 'skills/evidence-checklist/SKILL.md',
              sha,
              type: 'blob',
              mode: '120000',
              size: 10,
            },
          ],
        }),
      ),
    );
    await expect(symlink.preview(url)).rejects.toThrow('No matching');
  });
  it('loads only the curated source path even in a repository with more than 20 definitions', async () => {
    const raw = '---\nname: research\n---\nUse primary sources.';
    const { directory, fetcher } = fixture(raw, 'skills/engineering/research/SKILL.md');
    fetcher.mockImplementationOnce(async () =>
      Response.json({
        truncated: false,
        tree: [
          ...Array.from({ length: 25 }, (_, index) => ({
            path: `skills/unrelated-${index}/SKILL.md`,
            sha: otherSha,
            type: 'blob',
            mode: '100644',
            size: 100,
          })),
          {
            path: 'skills/engineering/research/SKILL.md',
            sha,
            type: 'blob',
            mode: '100644',
            size: Buffer.byteLength(raw),
          },
        ],
      }),
    );
    const preview = await directory.preview('https://skills.sh/mattpocock/skills/research');
    expect(preview.source?.path).toBe('skills/engineering/research/SKILL.md');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('reports a missing curated path instead of importing another same-named definition', async () => {
    const { directory, fetcher } = fixture(
      '---\nname: research\n---\nDifferent skill.',
      'other/research/SKILL.md',
    );
    await expect(directory.preview('https://skills.sh/mattpocock/skills/research')).rejects.toThrow(
      'upstream file may have moved',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stops cancelled previews and reports public rate limits', async () => {
    const { directory, fetcher } = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(directory.preview(url, controller.signal)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    const limited = new SkillDirectory(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 })),
    );
    await expect(limited.preview(url)).rejects.toThrow('request limit');
  });
});
