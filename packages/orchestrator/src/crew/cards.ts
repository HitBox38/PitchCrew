import { adapters } from '@pitchcrew/adapters';
import {
  digestPacket,
  jobSourceRevision,
  recordLinkedJob,
  saveApplicationContext,
} from '@pitchcrew/board';
import {
  cardInput,
  jobLinkProvenance,
  type Approval,
  type Card,
  type CardState,
  type ProfileFile,
  type Role,
} from '@pitchcrew/core';
import { exportApprovedPacket } from '@pitchcrew/mcp';
import { readProfile, writePacket } from '@pitchcrew/packet';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exampleProfile, examples } from '../../test/fixtures/examples.ts';
import type { CrewContext } from './types.ts';
import { assertProfileReady, changeProfile } from '../profile-sources/mutation.ts';
export const createCard = (context: CrewContext, data: unknown): Card => {
  const { provenance, ...input } = newCard.parse(data);
  return provenance
    ? recordLinkedJob(context.board, input, provenance)
    : context.board.createCard(input);
};
export const moveCard = (context: CrewContext, id: string, state: CardState): Card => {
  if (context.board.hasActiveRun(id))
    throw new Error('Wait for the active run or cancel it before moving this card.');
  const card = context.board.get<Card>('card', id);
  if (['drafting', 'in_review', 'agreed', 'awaiting_approval'].includes(state))
    throw new Error('Use the crew workflow for this transition.');
  if (
    state === 'submitted' &&
    !context.board
      .list<Approval>('approval')
      .some(
        (a) =>
          a.cardId === id &&
          a.status === 'consumed' &&
          a.exportDirectory &&
          card.packet &&
          a.digest === digestPacket(id, card.packet),
      )
  )
    throw new Error('Approve and export the reviewed packet before recording a manual submission.');
  const next = context.board.move(
    id,
    state,
    'user',
    state === 'submitted' ? 'User recorded a manual submission' : undefined,
  );
  if (state === 'changes_requested')
    for (const approval of context.board
      .list<Approval>('approval')
      .filter((a) => a.cardId === card.id && ['pending', 'approved'].includes(a.status)))
      context.board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: new Date().toISOString() },
        'user',
        'Invalidated approval after requesting changes',
      );
  return next;
};
export const saveProfile = async (
  context: CrewContext,
  name: string,
  content: string,
): Promise<ProfileFile[]> => {
  if (!/^[\w.-]+\.md$/.test(name) || name.includes('..'))
    throw new Error('Use a simple Markdown filename.');
  assertProfileReady(context);
  return changeProfile(context, async () => {
    await writeFile(join(context.directory, 'profile', name), content, 'utf8');
    return readProfile(context.directory);
  });
};
export const loadExamples = async (context: CrewContext): Promise<void> => {
  if (!context.dev) throw new Error('Example data is only available in development mode.');
  if (context.board.list<Card>('card').some((c) => c.sample))
    throw new Error('Example opportunities have already been loaded.');
  const profile = await readProfile(context.directory);
  if (profile.length)
    throw new Error(
      'Example data uses a fictional profile. Try it in a separate PITCHCREW_HOME to keep your current profile intact.',
    );
  await context.saveProfile('example.md', exampleProfile);
  const cards = examples.map((input) => context.board.createCard(input, true));
  for (const card of cards)
    saveApplicationContext(
      context.board,
      card.id,
      jobSourceRevision(card),
      null,
      {
        brief: {
          companyContext: 'Fictional demo employer. This example uses simulated confirmation.',
          responsibilities: ['Build interfaces.'],
          qualifications: ['React and TypeScript.'],
          constraints: [],
        },
        requirements: [],
        flagged: [],
      },
      true,
    );
  const packetFor = async (card: Card) => {
    const role = context.board.get<Role>('role', 'writer');
    const result = await adapters.demo.run({
      card,
      role,
      profile: await readProfile(context.directory),
      directory: context.directory,
      mcp: { command: '', args: [], env: {} },
      signal: new AbortController().signal,
      onMessage: () => {},
    });
    if (result.role !== 'writer') throw new Error('Expected writer result.');
    return result.packet;
  };
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    context.board.updateCard(card.id, { fit: 88 - i * 3 }, 'demo', 'Example fit score');
    context.board.move(card.id, 'shortlisted', 'demo');
    if (i >= 2) {
      context.board.move(card.id, 'drafting', 'demo');
      const packet = await packetFor(card);
      await writePacket(context.directory, card.id, packet);
      context.board.updateCard(card.id, { packet }, 'demo', 'Created a fictional sample packet');
      context.board.move(card.id, 'in_review', 'demo');
    }
    if (i >= 3) {
      const current = context.board.get<Card>('card', card.id);
      const revision = current.applicationContext!.revision;
      context.board.updateCard(
        card.id,
        {
          packetContextRevision: revision,
          packetReview: {
            contextRevision: revision,
            packetDigest: digestPacket(card.id, current.packet!),
            runId: 'fictional-demo-review',
            reviewedAt: new Date().toISOString(),
          },
        },
        'demo',
        'Simulated review of the fictional example brief',
      );
      context.board.move(card.id, 'agreed', 'demo');
    }
    if (i === 4) context.board.requestApproval(card.id);
    if (i === 5) {
      const approval = context.board.requestApproval(card.id);
      context.board.decideApproval(approval.id, true);
      await exportApprovedPacket(context.board, context.directory, approval.id);
      context.board.move(card.id, 'submitted', 'demo', 'Example of a manually tracked submission');
      context.board.move(card.id, 'interviewing', 'demo', 'Example interview stage');
    }
  }
};
export const exportPacket = async (
  context: CrewContext,
  id: string,
  assertActive?: () => void,
): Promise<string> => {
  const profileRevision = context.profileRevision;
  const rulesRevision = JSON.stringify(context.packetRules.current());
  const approval = context.board.get<Approval>('approval', id);
  const { errors } = await context.packetRules.check(
    approval.packet,
    await readProfile(context.directory),
  );
  if (context.profileWriting || context.profileRevision !== profileRevision)
    throw new Error('Profile changed while checking the packet. Check it again before exporting.');
  assertActive?.();
  if (errors.length)
    throw new Error(
      `This packet no longer passes its checks. Request changes and review it again.\n${errors.join('\n')}`,
    );
  return exportApprovedPacket(context.board, context.directory, id, () => {
    assertActive?.();
    if (
      context.profileWriting ||
      context.profileRevision !== profileRevision ||
      JSON.stringify(context.packetRules.current()) !== rulesRevision
    )
      throw new Error(
        'Profile or packet rules changed during document verification. Check again before exporting.',
      );
  });
};

/** A user-added job; `provenance` is present when the user fetched it from a posting link. */
const newCard = cardInput.extend({ provenance: jobLinkProvenance.optional() });
