import type { PacketArtifact } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { pageLabel, resumePageWarning } from '../helpers.ts';

const artifact = (name: PacketArtifact['name'], digest: string): PacketArtifact => ({
  name,
  digest,
  bytes: '',
  source: name.startsWith('resume') ? 'resume' : 'coverLetter',
  mimeType: name.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

describe('artifact page counts', () => {
  const pdf = artifact('resume.pdf', 'a');
  const docx = artifact('resume.docx', 'b');
  const letter = artifact('cover_letter.pdf', 'c');

  it('labels exact PDF counts and estimated DOCX counts', () => {
    expect(pageLabel(pdf, { a: 1 })).toBe('1 page');
    expect(pageLabel(docx, { b: 2 })).toBe('about 2 pages in Word');
    expect(pageLabel(pdf, {})).toBeUndefined();
    expect(pageLabel(pdf, undefined)).toBeUndefined();
  });

  it('warns only when a resume runs past one page', () => {
    expect(resumePageWarning([pdf, docx, letter], { a: 1, b: 1, c: 3 })).toBeUndefined();
    expect(resumePageWarning([pdf, docx], { a: 2, b: 2 })).toContain('runs to 2 pages');
    expect(resumePageWarning([pdf], undefined)).toBeUndefined();
  });
});
