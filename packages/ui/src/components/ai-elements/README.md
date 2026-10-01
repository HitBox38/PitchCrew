# AI Elements in Pitchcrew

These components are adapted from the [Vercel AI Elements registry](https://elements.ai-sdk.dev/) (MIT license, fetched 2026-10-01):

- `conversation.tsx`: Conversation, content, empty state and scroll button. Instant scrolling respects reduced motion. Download controls are omitted.
- `message.tsx`: Message, content, actions and memoized Streamdown response. Optional code/math/diagram plugins and branching controls are omitted.
- `prompt-input.tsx`: Text composer, body, header/footer, tools, textarea and submit control. Uses Pitchcrew’s Base UI input group; attachment, screenshot and provider helpers are omitted. Controlled text clears only after a successful request.

Pitchcrew uses its local runtime adapters and board API; AI SDK types support these UI primitives without introducing a provider loop. Styling is supplied by the app’s existing theme and chat selectors in `styles.css`.
