import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const maximumLines = 100;
const violations: string[] = [];
let components = 0;

async function checkDirectory(directory: string, requireSharedDisclosures = false) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') await checkDirectory(filename, requireSharedDisclosures);
    } else if (entry.name.endsWith('.tsx')) {
      components += 1;
      const content = await readFile(filename, 'utf8');
      const lines = content.trimEnd().split('\n').length;
      if (lines > maximumLines) violations.push(`${filename}: ${lines} lines`);
      if (requireSharedDisclosures) {
        for (const match of content.matchAll(/<\/?(?:details|summary)\b/g)) {
          const line = content.slice(0, match.index).split('\n').length;
          violations.push(
            `${filename}:${line}: use shared Accordion/AccordionSection or Collapsible controls instead of native details/summary`,
          );
        }
      }
    }
  }
}

await checkDirectory('packages/ui/src', true);
await checkDirectory('packages/landing/src');
if (violations.length) {
  console.error(
    `Component standards failed (maximum ${maximumLines} lines; shared app disclosure controls required):\n${violations.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${components} component files: line limits and shared app disclosure controls passed.`,
  );
}
