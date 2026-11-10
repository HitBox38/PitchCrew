/** Fixture-only benchmark: bun --no-env-file packages/packet/test/verification.bench.ts [runs] */
import { prepareVerifiedArtifacts } from '../src/index.ts';

// Bun is the production daemon runtime, so verification forks the bounded Node helper as it does
// for pitchcrew_lint_packet. Each run changes the text so the verification cache never answers.
const runs = Number(process.argv[2] ?? 5);
const times: number[] = [];
for (let run = 0; run < runs; run++) {
  const bullets = Array.from(
    { length: 14 },
    (_, i) => `- Led fictional project ${i} at Example Corp for ${10 + i} engineers.`,
  ).join('\n');
  const resume = `# Alex Example ${run} ${Date.now()}\n\n## Experience\n\n${bullets}\n`;
  const coverLetter = `Dear Hiring Team,\n\n${'I build reliable systems for small teams. '.repeat(40)}\n`;
  const started = performance.now();
  const { reports } = await prepareVerifiedArtifacts(
    { resume, coverLetter, formAnswers: '', note: '', claims: [] } as never,
    ['pdf'],
  );
  times.push(Math.round(performance.now() - started));
  if (reports.some((report) => report.status !== 'verified'))
    throw new Error(JSON.stringify(reports));
}
const sorted = [...times].sort((a, b) => a - b);
console.log({ runs, medianMs: sorted[sorted.length >> 1], timesMs: times });
