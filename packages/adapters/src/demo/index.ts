import { setTimeout } from 'node:timers/promises';
import type { RuntimeAdapter, Packet } from '@pitchcrew/core';
import { lintPacket } from '@pitchcrew/packet';
export const demo: RuntimeAdapter = {
  id: 'demo',
  detect: async () => ({
    id: 'demo',
    available: true,
    version: 'Built in',
    detail: 'Deterministic example workflow. No AI calls.',
  }),
  async run(context) {
    context.onMessage('Running the deterministic demo workflow.');
    await setTimeout(850, undefined, { signal: context.signal });
    if (context.role.id === 'scout') {
      const words = context.card.description
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4);
      const profile = context.profile.map((p) => p.content.toLowerCase()).join(' ');
      const matches = new Set(words.filter((w) => profile.includes(w))).size;
      return {
        role: 'scout',
        fit: Math.min(96, 60 + matches * 4),
        reasons: [
          'Demo fit score based on keywords in your profile and this job.',
          'Review the job details before shortlisting.',
        ],
      };
    }
    if (context.role.id === 'reviewer') {
      if (!context.card.packet) throw new Error('Draft a packet first.');
      const feedback = lintPacket(context.card.packet, context.profile);
      return { role: 'reviewer', passed: feedback.length === 0, feedback };
    }
    const facts = context.profile
      .flatMap((file) =>
        file.content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('- '))
          .map((line) => ({ claim: line.slice(2), quote: line.slice(2), source: file.name })),
      )
      .slice(0, 6);
    if (!facts.length)
      throw new Error('Add at least one bullet point to your profile before drafting.');
    const name =
      context.profile
        .flatMap((file) => file.content.split('\n'))
        .find((line) => /^# /.test(line))
        ?.slice(2) ?? 'Candidate';
    const packet: Packet = {
      resume: `# ${name}\n\n## Application for ${context.card.title}\n\n${facts.map((f) => `- ${f.claim}`).join('\n')}`,
      coverLetter: `Dear ${context.card.company} team,\n\nI am interested in the ${context.card.title} opportunity.\n\n${facts
        .slice(0, 3)
        .map((f) => f.claim)
        .join('\n\n')}\n\nI would welcome a conversation about the role.\n\n${name}`,
      formAnswers: 'Availability and compensation: confirm with the candidate before applying.',
      note: `Application packet for ${context.card.company}. Review the source-backed experience and personalize this demo draft before using it.`,
      claims: facts,
    };
    return { role: 'writer', packet };
  },
};
