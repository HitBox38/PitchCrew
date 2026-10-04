import type { DocumentKind } from './types.ts';

// One single-column template per document, in PDF points (1/72 inch). The DOCX renderer converts
// the same values so both formats share margins, type sizes and spacing.
export interface HeadingStyle {
  size: number;
  leading: number;
  before: number;
  after: number;
  rule: boolean;
}
export interface Template {
  page: [number, number];
  margin: number;
  size: number;
  leading: number;
  paragraphAfter: number;
  headings: [HeadingStyle, HeadingStyle, HeadingStyle, HeadingStyle];
  indent: number;
  hang: number;
  itemAfter: number;
}

const letter: [number, number] = [612, 792];

export const templates: Record<DocumentKind, Template> = {
  // Tight one-page resume: 0.35 inch margins and 10 point body text.
  resume: {
    page: letter,
    margin: 25.2,
    size: 10,
    leading: 12,
    paragraphAfter: 4,
    headings: [
      { size: 18, leading: 21, before: 0, after: 2, rule: false },
      { size: 11.5, leading: 14, before: 7, after: 4, rule: true },
      { size: 10.5, leading: 13, before: 4, after: 1, rule: false },
      { size: 10, leading: 12, before: 3, after: 1, rule: false },
    ],
    indent: 12,
    hang: 10,
    itemAfter: 1.5,
  },
  coverLetter: {
    page: letter,
    margin: 72,
    size: 11,
    leading: 15,
    paragraphAfter: 10,
    headings: [
      { size: 18, leading: 22, before: 0, after: 4, rule: false },
      { size: 13, leading: 17, before: 8, after: 4, rule: false },
      { size: 11.5, leading: 15, before: 6, after: 2, rule: false },
      { size: 11, leading: 15, before: 4, after: 2, rule: false },
    ],
    indent: 14,
    hang: 12,
    itemAfter: 3,
  },
};

// Liberation Sans, the embedded PDF font, shares Arial's metrics; DOCX names Arial.
export const ascent = 0.905;
export const descent = 0.212;
export const linkColor = { red: 0.04, green: 0.31, blue: 0.75, hex: '0A4FBF' };
export const ruleGray = 0.55;
