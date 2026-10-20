import type { ArtifactLayout, DocumentVerification, Packet, PacketArtifact } from '@pitchcrew/core';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { verifiedArtifact, renderArtifacts, type RenderOptions } from '../artifacts.ts';
import { parseMarkdown } from '../documents/markdown.ts';
import { visibleText } from '../documents/inline.ts';

const bootstrap = `import { register } from ${JSON.stringify(import.meta.resolve('tsx/esm/api'))};
import { parentPort, workerData } from 'node:worker_threads';
register();
const { extractDocument } = await import(workerData.module);
parentPort.postMessage(await extractDocument(workerData.bytes, workerData.mimeType, workerData.headings));`;

export const expectedDocumentText = (source: string, layout: ArtifactLayout) =>
  layout === 'plain'
    ? source
    : parseMarkdown(source)
        .map((block) =>
          block.kind === 'rule'
            ? ''
            : block.kind === 'list'
              ? block.items.map((item) => visibleText(item.runs)).join('\n')
              : visibleText(block.runs),
        )
        .join('\n');
// Compare content independently of line wrapping, bidi visual order and compatibility glyphs.
// Layout and reading-order judgments remain advisory; this is not an ATS compatibility test.
const characters = (value: string) =>
  Array.from(
    value.normalize('NFKC').replace(/[\s\u00ad\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, ''),
  );
export function missingContent(expected: string, actual: string) {
  const available = new Map<string, number>();
  for (const c of characters(actual)) available.set(c, (available.get(c) ?? 0) + 1);
  const missing: string[] = [];
  for (const c of characters(expected)) {
    const n = available.get(c) ?? 0;
    if (n) available.set(c, n - 1);
    else missing.push(c);
  }
  return missing.join('');
}

async function verifyDocumentUncached(
  artifact: PacketArtifact,
  expected: string | string[],
  timeoutMs = 15000,
  headings: string[] = [],
): Promise<DocumentVerification> {
  const report: DocumentVerification = {
    name: artifact.name,
    digest: artifact.digest,
    status: 'verified',
    findings: [],
  };
  try {
    const bytes = verifiedArtifact(artifact);
    if (bytes.length > 10_000_000) throw new Error('Document exceeds the verification size limit.');
    const result = await new Promise<{
      text: string;
      findings: DocumentVerification['findings'];
      pages?: number;
    }>((resolve, reject) => {
      const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), {
        execArgv: [],
        workerData: {
          module: new URL('./extract.ts', import.meta.url).href,
          headings,
          bytes,
          mimeType: artifact.mimeType,
        },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      let settled = false;
      const finish = (
        error?: Error,
        result?: { text: string; findings: DocumentVerification['findings']; pages?: number },
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate().then(() => (error ? reject(error) : resolve(result!)), reject);
      };
      const timer = setTimeout(
        () => finish(new Error('Verification timed out. Retry this file.')),
        timeoutMs,
      );
      worker.once('message', (result) => finish(undefined, result));
      worker.once('error', (error) => finish(error));
      worker.once('exit', () =>
        finish(new Error('Verification worker stopped before completing.')),
      );
    });
    if (!result.text.trim())
      report.findings.push({
        severity: 'error',
        check: 'readability',
        message: 'The document has no extractable text.',
      });
    else {
      const missing = (Array.isArray(expected) ? expected : [expected])
        .map((text) => missingContent(text, result.text))
        .sort((a, b) => a.length - b.length)[0];
      if (missing)
        report.findings.push({
          severity: 'error',
          check: 'content',
          message: `Extracted text is missing ${Array.from(missing).length} expected character(s). Check the document or use another format.`,
        });
    }
    if (artifact.source === 'resume' && (result.pages ?? 0) > 1)
      report.findings.push({
        severity: 'warn',
        check: 'layout',
        message: `The resume runs to ${result.pages} pages. The target is one page.`,
      });
    report.findings.push(...result.findings);
  } catch (error) {
    report.findings.push({
      severity: 'error',
      check: 'readability',
      message: `Essential verification could not finish: ${error instanceof Error ? error.message : 'Unreadable document.'}`,
    });
  }
  report.status = report.findings.some((f) => f.severity === 'error') ? 'blocked' : 'verified';
  return report;
}

export async function prepareVerifiedArtifacts(
  packet: Packet,
  formats: ('pdf' | 'docx')[],
  layout: ArtifactLayout = 'formatted',
  options: RenderOptions = {},
) {
  const artifacts: PacketArtifact[] = [];
  const reports: DocumentVerification[] = [];
  for (const format of [...new Set(formats)]) {
    for (const source of options.sources ?? (['resume', 'coverLetter'] as const)) {
      const name =
        `${source === 'resume' ? 'resume' : 'cover_letter'}.${format}` as PacketArtifact['name'];
      try {
        // Each document renders independently so one failure cannot hide a valid alternative.
        const [artifact] = await renderArtifacts(packet, [format], layout, {
          ...options,
          sources: [source],
        });
        const actual = { ...artifact, name, source, layout };
        const verification = await verifyDocument(
          actual,
          expectedDocumentText(packet[source], layout),
          15000,
          layout === 'formatted'
            ? parseMarkdown(packet[source])
                .filter((block) => block.kind === 'heading')
                .map((block) => (block.kind === 'heading' ? visibleText(block.runs) : ''))
            : [],
        );
        reports.push(verification);
        if (verification.status === 'verified') artifacts.push({ ...actual, verification });
      } catch (error) {
        reports.push({
          name,
          status: 'blocked',
          findings: [
            {
              severity: 'error',
              check: 'render',
              message: error instanceof Error ? error.message : 'Document rendering failed.',
            },
          ],
        });
      }
    }
  }
  return { artifacts, reports };
}

const verifiedCache = new Map<string, Promise<DocumentVerification>>();
export async function verifyDocument(
  artifact: PacketArtifact,
  expected: string | string[],
  timeoutMs = 15000,
  headings: string[] = [],
): Promise<DocumentVerification> {
  // Validate bytes even on a cache hit; metadata must never authorize changed content.
  try {
    verifiedArtifact(artifact);
  } catch {
    return verifyDocumentUncached(artifact, expected, timeoutMs, headings);
  }
  const key = createHash('sha256')
    .update(
      JSON.stringify([
        artifact.digest,
        artifact.name,
        artifact.mimeType,
        expected,
        timeoutMs,
        headings,
      ]),
    )
    .digest('hex');
  let pending = verifiedCache.get(key);
  if (!pending) {
    pending = verifyDocumentUncached(artifact, expected, timeoutMs, headings);
    verifiedCache.set(key, pending);
    void pending.then((result) => {
      if (result.status === 'blocked') verifiedCache.delete(key);
    });
    if (verifiedCache.size > 200) verifiedCache.delete(verifiedCache.keys().next().value!);
  }
  return structuredClone(await pending);
}
