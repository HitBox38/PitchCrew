import { expect, it } from 'vitest';
import { legacyExportFileName, packetExportFileName, packetFileName } from '../src/packet-files.ts';

it('names resume and cover letter files from the resume heading', () => {
  const resume = '# Ada Lovelace\n\nBuilt analytical engines.';
  expect(packetFileName(resume, 'resume', 'pdf')).toBe('Ada_Lovelace_CV.pdf');
  expect(packetFileName(resume, 'resume', 'md')).toBe('Ada_Lovelace_CV.md');
  expect(packetFileName(resume, 'coverLetter', 'md')).toBe('Ada_Lovelace_Cover_Letter.md');
  expect(packetFileName(resume, 'coverLetter', 'docx')).toBe('Ada_Lovelace_Cover_Letter.docx');
  expect(packetExportFileName(resume, 'resume.pdf')).toBe('Ada_Lovelace_CV.pdf');
  expect(packetExportFileName(resume, 'form_answers.md')).toBe('form_answers.md');
  expect(legacyExportFileName('Ada_Lovelace_CV.pdf')).toBe('resume.pdf');
  expect(legacyExportFileName('resume.pdf')).toBeUndefined();
});

it('keeps letters from the heading and falls back when there is no name', () => {
  expect(packetFileName('# 山田 太郎\n\nWork.', 'resume', 'pdf')).toBe('山田_太郎_CV.pdf');
  expect(packetFileName('# José García\n\nWork.', 'coverLetter', 'md')).toBe(
    'José_García_Cover_Letter.md',
  );
  expect(packetFileName('# Jose\u0301 Garci\u0301a\n\nWork.', 'resume', 'pdf')).toBe(
    'José_García_CV.pdf',
  );
  expect(packetFileName('# प्रिया शर्मा\n\nWork.', 'resume', 'pdf')).toBe('प्रिया_शर्मा_CV.pdf');
  expect(packetFileName('# محمد\u200Cرضا\n\nWork.', 'resume', 'md')).toBe('محمد\u200Cرضا_CV.md');
  const rare = '\u{20000}';
  expect(packetFileName(`# ${'A'.repeat(59)}${rare}\n`, 'resume', 'pdf')).toBe(
    `${'A'.repeat(59)}${rare}_CV.pdf`,
  );
  expect(packetFileName('---\nname: hidden\n---\n# Ada Lovelace\n', 'resume', 'md')).toBe(
    'Ada_Lovelace_CV.md',
  );
  expect(packetFileName('Ada Lovelace\n=============\nWork.', 'resume', 'pdf')).toBe(
    'Ada_Lovelace_CV.pdf',
  );
  expect(packetFileName('Built tools without a heading.', 'resume', 'md')).toBe('resume.md');
  expect(packetFileName('# ***\n\nNo name.', 'coverLetter', 'pdf')).toBe('cover_letter.pdf');
});
