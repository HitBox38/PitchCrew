export {};
for await (const _chunk of process.stdin) {
  /* Drain the fictional prompt. */
}
// A fictional Claude Code turn: one shell call that prints the run token it was given and fails
// quoting it.
const token = process.env.PITCHCREW_RUN_TOKEN ?? '';
const line = (event: unknown) => JSON.stringify(event) + '\n';
const output =
  line({
    type: 'assistant',
    parent_tool_use_id: null,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_fixture',
          name: 'Bash',
          input: { command: `echo ${token}` },
        },
      ],
    },
  }) +
  line({
    type: 'user',
    parent_tool_use_id: null,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_fixture',
          is_error: true,
          content: `Exit code 1\nrejected ${token}`,
        },
      ],
    },
  }) +
  // A final complete event without a trailing newline.
  JSON.stringify({ type: 'result', subtype: 'success', result: '{"reply":"Done."}' });
// Split inside the token: redaction must see whole lines, never chunks.
const split = output.indexOf(token) + 4;
process.stdout.write(output.slice(0, split));
await new Promise((resolve) => setTimeout(resolve, 20));
process.stdout.write(output.slice(split));
