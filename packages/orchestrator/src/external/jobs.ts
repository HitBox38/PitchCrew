import { saveReadJobLink } from '@pitchcrew/board';
import { cardInput, recognizeJobLink, type JobLinkProvenance } from '@pitchcrew/core';
import { externalTools } from '@pitchcrew/mcp/external/tools';
import type { CrewContext } from '../crew/types.ts';

/** External link creation uses the same bounded lookup as the Add job form. */
export const createExternalJob = async (context: CrewContext, data: unknown) => {
  const input = externalTools.create_job.schema.parse(data);
  if (input.url) {
    const recognized = recognizeJobLink(input.url);
    const url = recognized.recognized ? recognized.link.url : input.url;
    if (
      !recognized.recognized &&
      /(^|\.)(comeet\.co|comeet\.com)$/.test(new URL(url).hostname) &&
      new URL(url).search
    )
      throw new Error('Use a hosted Comeet posting link without API tokens.');
    const result = await context.jobSources.lookup({ url: input.url });
    let posting = { ...input, url };
    let provenance: JobLinkProvenance | undefined;
    if (result.status === 'found') {
      posting = { ...result.prefill, tags: input.tags };
      provenance = result.prefill.provenance;
    } else if (!input.company || !input.title || !input.description)
      return {
        status: 'needs_details',
        url,
        reason: result.reason,
        instruction:
          'Nothing was saved. Supply company, title and the full original job description copied verbatim into description. Preserve wording, order, paragraphs and bullets; do not summarize, rewrite, translate or truncate. If unreadable, ask the user to paste the complete posting text.',
      };
    const saved = saveReadJobLink(context.board, {
      input: cardInput.parse(posting),
      provenance,
      pastedUrl: input.url,
      actor: 'external-mcp',
    });
    if (!saved.card)
      return {
        status: 'duplicate',
        duplicates: saved.duplicates.map(({ id, state }) => ({ id, state })),
      };
    const { sourceHtml: _sourceHtml, ...card } = saved.card;
    return { card };
  }
  return { card: context.board.createCard(cardInput.parse(input), false, 'external-mcp') };
};
