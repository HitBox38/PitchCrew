import { z } from 'zod';

const reportedSource =
  'https://github.com/Jakeschincariol/hunter-skill/blob/f40d6a94b61283785b20e47a237608d5b1976b1c/skills/hunter-linkedin/limits.json';
const reviewedAt = '2026-10-18';
export const linkedInFieldLimits = Object.freeze({
  headline: 220,
  about: 2600,
  position_title: 100,
  position_description: 2000,
});
export const linkedInDraftInput = z
  .strictObject({
    fields: z
      .array(
        z.strictObject({
          field: z.enum(['headline', 'about', 'position_title', 'position_description']),
          label: z.string().max(120).optional(),
          text: z.string().max(12000),
        }),
      )
      .min(1)
      .max(30)
      .optional(),
    skills: z.array(z.string().min(1).max(200)).max(200).optional(),
  })
  .refine((value) => value.fields !== undefined || value.skills !== undefined, {
    message: 'Supply draft fields or a complete proposed skills list.',
  });

/** Measures exact supplied text locally; never rewrites it or verifies its claims. */
export function checkLinkedInDraft(input: unknown) {
  const data = linkedInDraftInput.parse(input);
  const fields = (data.fields ?? []).map(({ field, label, text }) => {
    const count = text.length;
    const limit = linkedInFieldLimits[field];
    return {
      field,
      ...(label === undefined ? {} : { label }),
      count,
      codePoints: [...text].length,
      limit,
      overBy: Math.max(0, count - limit),
      withinLimit: count <= limit,
      warnings: [
        ...(count > limit ? [`Exceeds the reported ${limit}-character limit.`] : []),
        ...(text.trim() ? [] : ['Empty or whitespace-only draft field.']),
      ],
      source: reportedSource,
      evidence: 'reported' as const,
      reviewedAt,
    };
  });
  return {
    counting: 'UTF-16 code units, including spaces and line breaks; no trimming or normalization.',
    caveat:
      'Text limits are reported, not confirmed by LinkedIn Help. LinkedIn’s live editor is authoritative and may count Unicode differently. Length checks do not verify facts or predict hiring outcomes.',
    fields,
    ...(data.skills === undefined
      ? {}
      : {
          skills: {
            count: data.skills.length,
            limit: 100,
            overBy: Math.max(0, data.skills.length - 100),
            withinLimit: data.skills.length <= 100,
            warnings: [
              ...(data.skills.length > 100 ? ['Exceeds the 100-skill profile limit.'] : []),
              ...(data.skills.some((skill) => !skill.trim())
                ? ['Contains a whitespace-only skill.']
                : []),
              ...(new Set(data.skills.map((skill) => skill.trim().toLowerCase())).size <
              data.skills.length
                ? ['Contains duplicate skill labels; entries were counted without deduplication.']
                : []),
            ],
            source:
              'https://www.linkedin.com/help/linkedin/answer/a549047/adding-and-removing-skills-on-your-profile',
            evidence: 'linkedin_help' as const,
            reviewedAt,
            caveat:
              'The count applies to the complete supplied list, not unsupplied existing skills.',
          },
        }),
  };
}
