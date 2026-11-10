import { describe, expect, it } from 'vitest';
import type { CrewContext } from '../src/crew/types.ts';
import { changeProfile } from '../src/profile-sources/mutation.ts';

const context = (proposals: { id: string; status: string }[]) =>
  ({
    board: { list: (kind: string) => (kind === 'profile_proposal' ? proposals : []) },
    controllers: new Map(),
    profileWriting: false,
    profileRevision: 0,
  }) as unknown as CrewContext;

describe('changeProfile', () => {
  it('lets only the interrupted approved update continue', async () => {
    const interrupted = context([
      { id: 'first', status: 'applying' },
      { id: 'second', status: 'pending' },
    ]);
    const write = async () => 'written';
    await expect(changeProfile(interrupted, write)).rejects.toThrow('Finish the approved');
    await expect(changeProfile(interrupted, write, { recovery: 'second' })).rejects.toThrow(
      'Finish the approved',
    );
    await expect(changeProfile(interrupted, write, { recovery: 'first' })).resolves.toBe('written');
    await expect(changeProfile(interrupted, write, { recovery: true })).resolves.toBe('written');
  });

  it('releases the queue when a write fails', async () => {
    const idle = context([]);
    await expect(
      changeProfile(idle, async () => {
        throw new Error('disk full');
      }),
    ).rejects.toThrow('disk full');
    await expect(changeProfile(idle, async () => 'next')).resolves.toBe('next');
  });
});
