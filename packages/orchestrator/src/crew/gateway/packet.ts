import { packetSchema, resumeReviewPacketSchema } from '@pitchcrew/core';
import { checkLayout, readProfile, systemFonts } from '@pitchcrew/packet';
import { join } from 'node:path';
import { inspectPacketDocuments } from '../../quality/documents.ts';
import type { CrewContext } from '../types.ts';

/** Scope comes from the authenticated run, never caller-controlled tool arguments. */
export const lintRunPacket = async (context: CrewContext, input: unknown, resumeOnly: boolean) => {
  const packet = (resumeOnly ? resumeReviewPacketSchema : packetSchema).parse(input);
  const sources = resumeOnly ? (['resume'] as const) : (['resume', 'coverLetter'] as const);
  const check = await context.packetRules.check(
    packet,
    await readProfile(context.directory),
    resumeOnly ? ['resume'] : undefined,
  );
  return {
    scope: resumeOnly ? 'resume' : 'packet',
    problems: check.errors,
    warnings: check.warnings,
    findings: check.findings,
    documents: await inspectPacketDocuments(context.directory, packet, [...sources]),
    layout: await checkLayout(packet, {
      sources: [...sources],
      fonts: systemFonts({ folders: [join(context.directory, 'fonts')] }),
    }),
  };
};
