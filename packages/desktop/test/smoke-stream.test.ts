import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { afterEach, expect, test, vi } from 'vitest';
import { smokeStreamPartials, streamSmokeReply } from '../src/smoke-stream.ts';
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-smoke-stream-'));
  directories.push(directory);
  return join(directory, 'ack.txt');
};

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

test('holds each partial until the slow renderer acknowledges that exact checkpoint', async () => {
  const acknowledgement = await fixture();
  const onReply = vi.fn();
  const controller = new AbortController();
  const reply = streamSmokeReply({ onReply, signal: controller.signal }, acknowledgement);
  try {
    await setTimeout(150);
    expect(onReply.mock.calls).toEqual([[smokeStreamPartials[0]]]);
    await writeFile(acknowledgement, smokeStreamPartials[0]);
    await vi.waitFor(() => expect(onReply).toHaveBeenCalledTimes(2));
    // A duplicate acknowledgement cannot complete the next streaming phase.
    await setTimeout(150);
    expect(onReply.mock.calls).toEqual(smokeStreamPartials.map((partial) => [partial]));
    await writeFile(acknowledgement, smokeStreamPartials[1]);
    expect(await reply).toEqual({ reply: `${smokeStreamPartials[1]} This is a demo reply.` });
    expect(onReply).toHaveBeenCalledTimes(3);
  } finally {
    controller.abort();
    await reply.catch(() => {});
  }
});

test('cancellation terminates a fixture waiting for the renderer', async () => {
  const acknowledgement = await fixture();
  const onReply = vi.fn();
  const controller = new AbortController();
  const reply = streamSmokeReply({ onReply, signal: controller.signal }, acknowledgement);
  const rejected = expect(reply).rejects.toThrow();
  controller.abort();
  await rejected;
  expect(onReply).toHaveBeenCalledOnce();
});

test('a missing renderer acknowledgement fails rather than silently completing', async () => {
  const acknowledgement = await fixture();
  const onReply = vi.fn();
  await expect(
    streamSmokeReply({ onReply, signal: new AbortController().signal }, acknowledgement),
  ).rejects.toThrow('Electron did not render the streaming checkpoint:');
  expect(onReply.mock.calls).toEqual([[smokeStreamPartials[0]]]);
});
