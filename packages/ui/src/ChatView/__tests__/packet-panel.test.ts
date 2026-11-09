import { expect, it } from 'vitest';
import { fileFacts } from '@/FileViewer/attachments.ts';
import { wordCount } from '../packet-panel.ts';

it('counts a resume’s words the same in the Packet panel and on its file tile', () => {
  const resume = '# Example Candidate\n\n- Built **React** interfaces.\n- Led a team.\n';
  const tile = fileFacts({
    id: 'resume',
    name: 'resume.md',
    kind: 'markdown',
    mimeType: 'text/markdown',
    text: resume,
    downloadAllowed: false,
  });
  // Markdown markers (#, -) are not words; the earlier whitespace split counted them (11).
  expect(wordCount(resume)).toBe(8);
  expect(tile).toContain(`${wordCount(resume)} words`);
});
