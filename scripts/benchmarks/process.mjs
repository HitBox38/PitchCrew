import { once } from 'node:events';

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const median = (values) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
};
export const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

export function message(child, predicate, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off('message', received);
      child.off('exit', exited);
    };
    const received = (value) => {
      if (predicate(value)) {
        cleanup();
        resolve(value);
      }
    };
    const exited = (code) => {
      cleanup();
      reject(new Error(`Benchmark daemon exited with ${code}`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Benchmark daemon timed out'));
    }, timeout);
    child.on('message', received);
    child.once('exit', exited);
  });
}
export async function memory(child) {
  const readings = [];
  for (let id = 0; id < 5; id++) {
    const pending = message(child, (value) => value.type === 'memory' && value.id === id);
    child.send({ type: 'memory', id });
    readings.push(await pending);
    await delay(100);
  }
  return {
    rssBytes: median(readings.map((x) => x.rss)),
    heapUsedBytes: median(readings.map((x) => x.heapUsed)),
  };
}
export async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try {
    const [code, signal] = await ended;
    if (code !== 0 || signal) throw new Error(`Unclean benchmark shutdown: ${code ?? signal}`);
  } finally {
    clearTimeout(timer);
  }
}
