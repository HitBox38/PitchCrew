import { rename, writeFile } from 'node:fs/promises';
import { afterEach, expect, test, vi } from 'vitest';
import { writeNativeCommand } from './fixtures/native-browser-command.ts';

vi.mock('node:fs/promises', () => ({ rename: vi.fn(), writeFile: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
});

test.each(['EPERM', 'EBUSY'])(
  'retries %s without rewriting or partially publishing the command',
  async (code) => {
    const locked = Object.assign(new Error('Destination is being read'), { code });
    vi.mocked(rename).mockRejectedValueOnce(locked).mockResolvedValue();
    await expect(
      writeNativeCommand('/fixture/command.json', '{"nonce":"next"}'),
    ).resolves.toBeUndefined();
    expect(writeFile).toHaveBeenCalledExactlyOnceWith(
      '/fixture/command.json.pending',
      '{"nonce":"next"}',
    );
    expect(rename).toHaveBeenCalledTimes(2);
    for (const args of vi.mocked(rename).mock.calls)
      expect(args).toEqual(['/fixture/command.json.pending', '/fixture/command.json']);
  },
);

test('fails permanent non-sharing errors immediately', async () => {
  const failure = Object.assign(new Error('Disk failure'), { code: 'EIO' });
  vi.mocked(rename).mockRejectedValue(failure);
  await expect(writeNativeCommand('/fixture/command.json', '{}')).rejects.toBe(failure);
  expect(rename).toHaveBeenCalledOnce();
});

test('bounds retries when the destination stays locked', async () => {
  const locked = Object.assign(new Error('Locked'), { code: 'EPERM' });
  vi.mocked(rename).mockRejectedValue(locked);
  await expect(writeNativeCommand('/fixture/command.json', '{}')).rejects.toBe(locked);
  expect(rename).toHaveBeenCalledTimes(20);
});
