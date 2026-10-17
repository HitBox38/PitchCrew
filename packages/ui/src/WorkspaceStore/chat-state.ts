import type { ChatStreamState, Snapshot } from '@pitchcrew/core';

/** A newer persisted projection also recovers messages written outside this stream. */
export function mergeChatState(snapshot: Snapshot, state: ChatStreamState | null): Snapshot {
  const persisted = snapshot.messageHistory;
  const streamed = state?.messageHistory;
  if (
    state &&
    persisted &&
    streamed &&
    Number(persisted.revision.split(':')[0]) > Number(streamed.revision.split(':')[0])
  ) {
    return {
      ...snapshot,
      ...state,
      messages: snapshot.messages,
      notificationMessages: snapshot.notificationMessages,
      messageHistory: persisted,
      userInputs: snapshot.userInputs,
    };
  }
  return { ...snapshot, ...state };
}
