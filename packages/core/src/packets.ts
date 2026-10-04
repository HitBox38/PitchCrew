import { z } from 'zod';

export const packetSchema = z.object({
  resume: z.string().min(1).max(20000),
  coverLetter: z.string().min(1).max(12000),
  formAnswers: z.string().max(12000),
  note: z.string().max(5000),
  claims: z
    .array(
      z.object({
        claim: z.string().min(1).max(2000),
        source: z.string().min(1).max(200),
        quote: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(80),
});
export type Packet = z.infer<typeof packetSchema>;

// Formatted exports lay out headings, lists and links; plain exports print the Markdown literally.
export type ArtifactLayout = 'formatted' | 'plain';
export interface PacketArtifact {
  name: 'resume.pdf' | 'resume.docx' | 'cover_letter.pdf' | 'cover_letter.docx';
  mimeType: string;
  digest: string;
  bytes: string;
  source: 'resume' | 'coverLetter';
}
