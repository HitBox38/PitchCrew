import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const maximumLines = 100;
const violations = [];
let components = 0;

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') await checkDirectory(filename);
    } else if (entry.name.endsWith('.tsx')) {
      components += 1;
      const content = await readFile(filename, 'utf8');
      const lines = content.trimEnd().split('\n').length;
      if (lines > maximumLines) violations.push(`${filename}: ${lines} lines`);
    }
  }
}

await checkDirectory('packages/ui/src');
if (violations.length) {
  console.error(
    `Component files must have at most ${maximumLines} lines:\n${violations.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Checked ${components} component files: all at most ${maximumLines} lines.`);
}
