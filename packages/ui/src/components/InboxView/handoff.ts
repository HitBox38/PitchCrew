import type { Approval, Card, PacketArtifact, Snapshot } from '@pitchcrew/core';

const reviewerOf = (runId: string | undefined, data: Pick<Snapshot, 'runs' | 'roles'>) => {
  const run = runId ? data.runs.find((item) => item.id === runId) : undefined;
  const reviewer = data.roles.find((role) => role.id === run?.roleId);
  return { id: reviewer?.id ?? 'reviewer', name: reviewer?.name ?? 'Reviewer' };
};

export type PacketHandoffData = ReturnType<typeof packetHandoff>;

/** Reviewer's summary and Writer's change notes, only when they describe this exact packet. */
export const packetHandoff = (approval: Approval, data: Snapshot) => {
  const card = data.cards.find((item) => item.id === approval.cardId);
  const review =
    card?.packetReview?.packetDigest === approval.digest ? card.packetReview : undefined;
  return {
    reviewed: Boolean(review),
    reviewedAt: review?.reviewedAt,
    summary: review?.summary,
    reviewer: reviewerOf(review?.runId, data),
    changes: card?.packetChanges?.packetDigest === approval.digest ? card.packetChanges.notes : [],
  };
};

/**
 * The same handoff for a job's current packet. A new Writer draft clears the review, so a
 * saved review always describes the current packet; change notes must match it when present.
 */
export const cardHandoff = (card: Card, data: Pick<Snapshot, 'runs' | 'roles'>) => {
  const review = card.packetReview;
  const changes = card.packetChanges;
  return {
    reviewed: Boolean(review),
    reviewedAt: review?.reviewedAt,
    summary: review?.summary,
    reviewer: reviewerOf(review?.runId, data),
    changes:
      changes && (!review || changes.packetDigest === review.packetDigest) ? changes.notes : [],
  } satisfies PacketHandoffData;
};

export type NeededFile = {
  label: string;
  required: boolean;
  accept: string;
  status: 'covered' | 'format' | 'export' | 'yours';
  files: string[];
};
const sourceFor = (label: string): PacketArtifact['source'] | null =>
  /cover/iu.test(label)
    ? 'coverLetter'
    : /r[eé]sum[eé]|\bcv\b|curriculum/iu.test(label)
      ? 'resume'
      : null;
export const acceptsFile = (
  accept: string,
  artifact: Pick<PacketArtifact, 'name' | 'mimeType'>,
) => {
  const types = accept
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);
  return (
    !types.length ||
    types.some((type) =>
      type === '*/*'
        ? true
        : type.startsWith('.')
          ? artifact.name.toLowerCase().endsWith(type)
          : type.endsWith('/*')
            ? artifact.mimeType.startsWith(type.slice(0, -1))
            : artifact.mimeType === type,
    )
  );
};

/** Uploads the confirmed form asks for, matched to the packet's frozen files by their labels. */
export const neededFiles = (card: Card | undefined, approval: Approval): NeededFile[] | null => {
  const form = card?.applicationContext?.form;
  if (form?.status !== 'inspected') return null;
  return form.fields
    .filter((field) => field.type === 'file' && field.visible && !field.disabled)
    .map((field) => {
      const source = sourceFor(field.label);
      const exported = (approval.artifacts ?? []).filter((item) => item.source === source);
      const files = exported.filter((item) => acceptsFile(field.accept, item)).map((f) => f.name);
      return {
        label: field.label,
        required: field.required,
        accept: field.accept,
        files,
        status: !source
          ? 'yours'
          : files.length
            ? 'covered'
            : exported.length
              ? 'format'
              : 'export',
      };
    });
};
