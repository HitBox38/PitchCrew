import { adapters } from '@pitchcrew/adapters';
import { digestPacket } from '@pitchcrew/board';
import {
  cardInput,
  type Approval,
  type Card,
  type CardState,
  type ProfileFile,
  type Role,
} from '@pitchcrew/core';
import { exportApprovedPacket } from '@pitchcrew/mcp';
import { lintPacket, readProfile, writePacket } from '@pitchcrew/packet';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exampleProfile, examples } from '../../test/fixtures/examples.ts';
import type { CrewContext } from './types.ts';

export function createCard(this: CrewContext, data: unknown): Card {
  return this.board.createCard(cardInput.parse(data));
}
export function moveCard(this: CrewContext, id: string, state: CardState): Card {
  if (this.board.hasActiveRun(id))
    throw new Error('Wait for the active run or cancel it before moving this card.');
  const card = this.board.get<Card>('card', id);
  if (['drafting', 'in_review', 'agreed', 'awaiting_approval'].includes(state))
    throw new Error('Use the crew workflow for this transition.');
  if (
    state === 'submitted' &&
    !this.board
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
  const next = this.board.move(
    id,
    state,
    'user',
    state === 'submitted' ? 'User recorded a manual submission' : undefined,
  );
  if (state === 'changes_requested')
    for (const approval of this.board
      .list<Approval>('approval')
      .filter((a) => a.cardId === card.id && ['pending', 'approved'].includes(a.status)))
      this.board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: new Date().toISOString() },
        'user',
        'Invalidated approval after requesting changes',
      );
  return next;
}
export async function saveProfile(
  this: CrewContext,
  name: string,
  content: string,
): Promise<ProfileFile[]> {
  if (!/^[\w.-]+\.md$/.test(name) || name.includes('..'))
    throw new Error('Use a simple Markdown filename.');
  if (this.controllers.size)
    throw new Error('Wait for active runs to finish before changing their source profile.');
  await writeFile(join(this.directory, 'profile', name), content, 'utf8');
  return readProfile(this.directory);
}
export async function loadExamples(this: CrewContext): Promise<void> {
  if (this.board.list<Card>('card').some((c) => c.sample))
    throw new Error('Example opportunities have already been loaded.');
  const profile = await readProfile(this.directory);
  if (profile.length)
    throw new Error(
      'Example data uses a fictional profile. Try it in a separate PITCHCREW_HOME to keep your current profile intact.',
    );
  await this.saveProfile('example.md', exampleProfile);
  const cards = examples.map((input) => this.board.createCard(input, true));
  const packetFor = async (card: Card) => {
    const role = this.board.get<Role>('role', 'writer');
    const result = await adapters.demo.run({
      card,
      role,
      profile: await readProfile(this.directory),
      directory: this.directory,
      mcp: { command: '', args: [], env: {} },
      signal: new AbortController().signal,
      onMessage: () => {},
    });
    if (result.role !== 'writer') throw new Error('Expected writer result.');
    return result.packet;
  };
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    this.board.updateCard(card.id, { fit: 88 - i * 3 }, 'demo', 'Example fit score');
    this.board.move(card.id, 'shortlisted', 'demo');
    if (i >= 2) {
      this.board.move(card.id, 'drafting', 'demo');
      const packet = await packetFor(card);
      await writePacket(this.directory, card.id, packet);
      this.board.updateCard(card.id, { packet }, 'demo', 'Created a fictional sample packet');
      this.board.move(card.id, 'in_review', 'demo');
    }
    if (i >= 3) this.board.move(card.id, 'agreed', 'demo');
    if (i === 4) this.board.requestApproval(card.id);
    if (i === 5) {
      const approval = this.board.requestApproval(card.id);
      this.board.decideApproval(approval.id, true);
      await exportApprovedPacket(this.board, this.directory, approval.id);
      this.board.move(card.id, 'submitted', 'demo', 'Example of a manually tracked submission');
      this.board.move(card.id, 'interviewing', 'demo', 'Example interview stage');
    }
  }
}
export async function exportPacket(this: CrewContext, id: string): Promise<string> {
  const approval = this.board.get<Approval>('approval', id);
  const problems = lintPacket(approval.packet, await readProfile(this.directory));
  if (problems.length)
    throw new Error('Profile evidence changed. Request changes and review the packet again.');
  return exportApprovedPacket(this.board, this.directory, id);
}
