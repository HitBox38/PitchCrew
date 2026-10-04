import type { Packet, PacketRules, ProfileFile } from '@pitchcrew/core';
import { checkPacket, type PacketCheck } from '@pitchcrew/packet';
import { Worker } from 'node:worker_threads';

export const packetRulesTimeoutMs = 2000;
const bootstrap = `
import { parentPort, workerData } from 'node:worker_threads';
import { register } from ${JSON.stringify(import.meta.resolve('tsx/esm/api'))};
register();
const { checkPacket } = await import(workerData.module);
parentPort.postMessage(checkPacket(workerData.packet, workerData.profile, workerData.rules));
`;

const failed = (message: string): PacketCheck => ({
  findings: [{ ruleId: 'packet-rules', severity: 'error', document: 'rules', message }],
  errors: [message],
  warnings: [],
});

/** Regex heuristics cannot prove bounded execution. Keep pattern checks off the daemon thread. */
export function boundedPacketCheck(
  packet: Packet,
  profile: ProfileFile[],
  rules: PacketRules,
): Promise<PacketCheck> {
  const patterns = rules.rules.some(
    (rule) => rule.kind !== 'word_limit' && (rule.kind !== 'max_bullets' || rule.heading),
  );
  if (!patterns) return Promise.resolve(checkPacket(packet, profile, rules));
  return new Promise((resolve) => {
    const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), {
      execArgv: [],
      workerData: {
        module: new URL('./rules.ts', import.meta.resolve('@pitchcrew/packet')).href,
        packet,
        profile,
        rules,
      },
    });
    let settled = false;
    const finish = (result: PacketCheck) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Resolve only after the isolated execution has stopped, including on timeout.
      void worker.terminate().then(
        () => resolve(result),
        () => resolve(failed('Packet rule checks could not stop. Try again before continuing.')),
      );
    };
    const timer = setTimeout(
      () =>
        finish(
          failed(
            'Packet rule checks timed out. Simplify the patterns in Settings before continuing.',
          ),
        ),
      packetRulesTimeoutMs,
    );
    worker.once('message', (result: PacketCheck) => finish(result));
    worker.once('error', () =>
      finish(failed('Packet rule checks failed. Try again before continuing.')),
    );
    worker.once('exit', () =>
      finish(failed('Packet rule checks stopped before completing. Try again before continuing.')),
    );
  });
}
