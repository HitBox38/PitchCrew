// Pi and its oh-my-pi fork share the native agent event protocol.
// Only a completed agent turn may supply the structured role result.
export function piResultExtractor() {
  let failed = false;
  return (event: Record<string, unknown>): string | null => {
    if (event.type === 'error') failed = true;
    if (failed) return 'The Pi runtime failed.';
    if (event.type !== 'agent_end') return null;
    const messages = event.messages;
    const last = Array.isArray(messages)
      ? (messages.at(-1) as
          | { role?: string; stopReason?: string; content?: { type?: string; text?: string }[] }
          | undefined)
      : undefined;
    if (last?.role !== 'assistant' || last.stopReason !== 'stop' || !Array.isArray(last.content)) {
      failed = true;
      return 'The Pi runtime did not complete its turn.';
    }
    return (
      last.content
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('') || 'The Pi runtime returned no assistant answer.'
    );
  };
}
