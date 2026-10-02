for await (const _chunk of process.stdin) {
  /* Drain the fictional prompt. */
}
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
const delta = (text) => ({
  type: 'stream_event',
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
});
emit({
  type: 'stream_event',
  event: {
    type: 'content_block_delta',
    delta: { type: 'thinking_delta', thinking: 'Private fixture reasoning.' },
  },
});
emit(delta('{"reply":"Hello'));
await new Promise((resolve) => setTimeout(resolve, 200));
const encoded = Buffer.from(JSON.stringify(delta(' café\\n\\"quoted\\" \\uD83D\\uDE80"}')) + '\n');
const split = encoded.indexOf(Buffer.from('é')) + 1;
process.stdout.write(encoded.subarray(0, split));
await new Promise((resolve) => setTimeout(resolve, 20));
process.stdout.write(encoded.subarray(split));
await new Promise((resolve) => setTimeout(resolve, 50));
// A final complete event without a trailing newline.
process.stdout.write(
  JSON.stringify({ type: 'result', result: JSON.stringify({ reply: 'Hello café\n"quoted" 🚀' }) }),
);
