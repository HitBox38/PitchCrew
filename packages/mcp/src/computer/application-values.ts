import { assertConfirmedContext, assertReviewedContext, type Board } from '@pitchcrew/board';
import type { Card } from '@pitchcrew/core';
import { bodyText, readProfile } from '@pitchcrew/packet';
const textValues = (text: string) => {
  const plain = bodyText(text).replace(/^\s*(?:#{1,6}|[-*+])\s+/gm, '');
  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return [
    plain,
    ...plain.split(/\n\s*\n/),
    ...lines,
    ...lines.flatMap((line) => (line.includes(':') ? [line.slice(line.indexOf(':') + 1)] : [])),
  ]
    .map(normalizedValue)
    .filter(Boolean);
};
/** Exact complete answers/paragraphs/lines, not arbitrary substrings of source text. */
export const applicationValues = async (board: Board, directory: string, cardId: string) => {
  const card = board.get<Card>('card', cardId);
  const context = assertConfirmedContext(card);
  const values = context.requirements
    .filter((requirement) => requirement.answer)
    .map((requirement) => normalizedValue(requirement.answer));
  for (const file of await readProfile(directory)) values.push(...textValues(file.content));
  if (card.packet && card.packetReview?.contextRevision === context.revision) {
    assertReviewedContext(card);
    for (const document of [card.packet.resume, card.packet.coverLetter, card.packet.formAnswers])
      values.push(...textValues(document));
  }
  if (assertConfirmedContext(board.get<Card>('card', cardId)).revision !== context.revision)
    throw new Error('Application context changed while checking form values.');
  return [...new Set(values)];
};

export const normalizedValue = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, ' ').trim();
