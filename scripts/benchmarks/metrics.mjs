import { Agent, get } from 'node:http';
import { performance } from 'node:perf_hooks';
import { percentile } from './process.mjs';

export function load(autocannon, options) {
  return new Promise((resolve, reject) =>
    autocannon(options, (error, result) => {
      if (error) return reject(error);
      if (result.errors || result.timeouts || result.non2xx)
        return reject(
          new Error(
            `Load failures: ${JSON.stringify({ errors: result.errors, timeouts: result.timeouts, non2xx: result.non2xx })}`,
          ),
        );
      resolve(result);
    }),
  );
}
export function firstSse(url, headers) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const request = get(`${url}/api/chat/stream`, { headers }, (response) => {
      if (response.statusCode !== 200) {
        request.destroy();
        return reject(new Error(`SSE status ${response.statusCode}`));
      }
      response.setEncoding('utf8');
      let buffer = '';
      response.on('data', (chunk) => {
        buffer += chunk;
        const end = buffer.indexOf('\n\n');
        if (end < 0) return;
        try {
          const state = JSON.parse(buffer.slice(6, end));
          if (state.messages.length !== 200) throw new Error('Unexpected SSE fixture');
          resolve(performance.now() - start);
        } catch (error) {
          reject(error);
        }
        request.destroy();
      });
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('SSE timed out')));
  });
}
export async function quietLatency(url, headers) {
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  const samples = [];
  try {
    for (let i = 0; i < 310; i++) {
      const start = performance.now();
      await new Promise((resolve, reject) => {
        const request = get(url, { headers, agent }, (response) => {
          if (response.statusCode !== 200) {
            request.destroy();
            return reject(new Error(`HTTP status ${response.statusCode}`));
          }
          response.resume();
          response.on('end', resolve);
          response.on('error', reject);
        });
        request.on('error', reject);
        request.setTimeout(5000, () => request.destroy(new Error('Latency request timed out')));
      });
      if (i >= 10) samples.push(performance.now() - start);
    }
    return {
      samples: samples.length,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p50Ms: percentile(samples, 0.5),
      p99Ms: percentile(samples, 0.99),
    };
  } finally {
    agent.destroy();
  }
}
