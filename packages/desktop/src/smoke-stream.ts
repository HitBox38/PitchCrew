import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

export const smokeStreamInputRequest = 'Pitchcrew smoke insert stream request';
export const smokeStreamRequest = 'Fixture: verify streamed reply.';
export const smokeStreamPrefix = 'Pitchcrew smoke rendered: ';
export const smokeStreamPartials = [
  'First streaming checkpoint.',
  'First streaming checkpoint. Second streaming checkpoint.',
];

export const smokeStreamAckFile = (evidence: string) => join(dirname(evidence), 'stream-ack.txt');

/** The isolated provider waits for DOM evidence instead of racing a short demo stream. */
export async function streamSmokeReply(
  context: { onReply?: (text: string) => void; signal: AbortSignal },
  acknowledgement: string,
) {
  for (const partial of smokeStreamPartials) {
    context.signal.throwIfAborted();
    context.onReply?.(partial);
    let rendered = false;
    for (let attempt = 0; attempt < 160; attempt++) {
      context.signal.throwIfAborted();
      if ((await readFile(acknowledgement, 'utf8').catch(() => '')) === partial) {
        rendered = true;
        break;
      }
      await setTimeout(50, undefined, { signal: context.signal });
    }
    if (!rendered) throw new Error(`Electron did not render the streaming checkpoint: ${partial}`);
  }
  const reply = `${smokeStreamPartials[1]} This is a demo reply.`;
  context.onReply?.(reply);
  return { reply };
}
