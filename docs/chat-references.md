# Inline chat references

The chat composer offers local suggestions at the caret. `@` searches current conversation participants, `$` searches shared and role-assigned skills available to the message recipients, and `/` lists Pitchcrew actions followed by those skills. Exact and prefix matches precede fuzzy matches. Paused, retired or unavailable participants remain visible with an explanation. A selected agent inserts its canonical role ID rather than its display name.

Arrow keys navigate the list; Enter or Tab chooses a suggestion without sending. Escape closes it without changing the draft. Enter with no matching suggestion does not submit. Shift+Enter inserts a line break, and the existing modified-Enter queue/interrupt choice remains. The editor preserves per-conversation drafts, attachments, cancellation and send-failure recovery. Suggestions use the existing paper surface, primary selection tint and popup shadow. When a question tray is present, suggestions occupy layout space rather than covering the question.

`/attach` opens the existing file picker, `/job` opens the existing job picker (including its conversation lock), and `/skills` enters the focused skill list. `/hiring-panel` inserts an action reference at the start of the message, after optional agent mentions, and keeps the existing managed deep-review/job-confirmation flow. None of these suggestions grants tools, approves actions or submits the message automatically.

## Draft and transcript presentation

A small Lexical plain-text editor supports atomic reference nodes. It continues to store readable Markdown and portable `@role-id`, `$skill-name` or `/hiring-panel` text. Selected references display inline as compact icon/name chips: primary blue for agents, plum for skills, and a neutral surface for actions. Draft references can be inspected and removed, selected and deleted as one item, and restored through undo. Same-namespace Lexical clipboard data preserves chip identity between Pitchcrew drafts; plain-text copying retains the canonical token.

Saved messages render the same chip family through the shared Streamdown path. A reference records selection, not proof of execution. Its details explain that distinction; actual work remains in the existing activity trace. Sent chips cannot remove or rerun anything. Native transcript text copying substitutes readable tokens for complete selected chips. Other Markdown, link confirmation and remote-image placeholders remain unchanged.

Code, links, URLs, paths, email addresses, escaped symbols and currency amounts do not produce references. Unknown tokens in older messages remain ordinary text. The renderer decorates only persisted occurrences, using their original labels instead of reinterpreting history against the current catalog. A missing target stays readable with a dashed chip; a changed skill explains that an earlier version was selected.

## Contracts and dispatch

Event version 22 adds optional references to messages and queued requests, retaining decoders for versions 1–21. Offsets are UTF-16 positions in canonical trimmed text. Reference identity includes kind, target ID, token and occurrence range; labels are server-owned snapshots. Skill references also capture their revision and a SHA-256 digest of name, description and instructions. Duplicate normalized skill names receive ID-suffixed tokens in suggestions.

The daemon validates every supplied occurrence against context-aware tokens, conversation membership and skill assignments. Typed unambiguous skill tokens resolve through the same path. It never accepts client-provided instruction content or display labels. An explicit selection cannot silently become an unavailable or unassigned skill. Group messages pass each role only the selected skills assigned to that role.

Before a queued turn or managed deep-review stage starts, selected skill revisions/digests are checked again. A change, deletion or reassignment fails the queued work with a recovery message instead of silently adopting other instructions. An unstarted failed request can be edited and resumed; editing preserves a paused request's state and revalidates its targets and references. Shared adapter prompts identify the explicit selections for that turn while retaining the existing full assigned instructions and capability boundaries. Live provider calls remain outside automated verification.

## Verification

Pure tests cover token boundaries, protected contexts and matching. Loopback HTTP tests cover recipient routing, server-owned reference snapshots, assignment enforcement, projection rebuilds, queued instruction changes and reviewed retry. Headless Chromium tests exercise keyboard selection, atomic deletion, copying, sent chips, detail popovers, slash aliases, no-match behavior, newlines and failed-send retention. The isolated hidden desktop smoke workflow uses the new editable surface while preserving the existing attachment, question and stream checks.

The design follows T3 Code's compact context chips and durable reference model, adapted to Pitchcrew's materials and agent semantics: [composer context references](https://github.com/pingdotgg/t3code/blob/main/docs/internals/composer-context-references.md), [shared chip styling](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/components/ContextChip.tsx), and [skill rendering](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/components/chat/SkillInlineText.tsx).
