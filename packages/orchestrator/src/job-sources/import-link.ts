import { recordLinkedJobIfNew } from '@pitchcrew/board';
import { cardInput, jobLookupInput, type JobLinkImportResult } from '@pitchcrew/core';
import { lookupJobLink, type LookupDependencies } from './lookup.ts';

/** Import one recognized posting, with authorization checked before fetching and committing. */
export async function importJobLink(
  value: unknown,
  dependencies: LookupDependencies & { actor: string; authorize: () => void },
): Promise<JobLinkImportResult> {
  const { signal, authorize, actor, board } = dependencies;
  authorize();
  signal.throwIfAborted();
  const input = jobLookupInput.parse(value);
  const result = await lookupJobLink(input, dependencies);
  authorize();
  signal.throwIfAborted();
  if (result.status !== 'found') return result;
  const { prefill } = result;
  const fields = cardInput.safeParse(prefill);
  if (!fields.success)
    return { status: 'failed', reason: 'This posting is missing usable job details.' };
  const { card, duplicates } = recordLinkedJobIfNew(
    board,
    fields.data,
    prefill.provenance,
    actor,
    input.url,
  );
  if (!card)
    return { status: 'duplicate', duplicates: duplicates.map(({ id, state }) => ({ id, state })) };
  return {
    status: 'added',
    lead: {
      id: card.id,
      company: card.company,
      title: card.title,
      location: card.location,
      url: card.url,
      excerpt: card.description.slice(0, 1500),
    },
  };
}
