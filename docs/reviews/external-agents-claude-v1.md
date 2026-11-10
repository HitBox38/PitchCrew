# External agents settings: independent design/UX review (Claude, v1)

Date: 2026-11-10 · Scope: uncommitted changes on `t3/external-agent-ux-review` (Settings > Accounts > External agents, `lastRequest` verification, `read_message_receipt` / `clientRequestId` tools). Read-only review; no fixes applied.

**Score: 6.5 / 10**

This is not good enough to ship yet. The copy about scope, cost and revocation is honest and better than T3's. The flow is clear, and the receipt-safe `send_message` contract is strong engineering. But the change fails the repo's own lint gate. It gives one generic JSON block for every app, even though several named apps can't use it as is. And the "Verify a request" step only partly does what its name says.

## How it was checked

- Code: `packages/ui/src/ExternalMcpSettings/index.tsx`, `hooks/useExternalMcp.ts`, `styles/settings.css`, the orchestrator route/configuration/gateway, `packages/mcp/src/external/{access,client,tools}.ts`.
- Reference: T3 `apps/web/src/components/mcp/UseInAnotherAppDialog.tsx` and `mcpApps.ts`.
- Live: `http://127.0.0.1:14581/settings?section=accounts`, production mode with an isolated, empty, fictional workspace (`pitchcrew-external-review-20261110`). Checked at 1280×800 and iPhone 12 Pro (390×844). I dismissed the intro with Set up later, turned **Allow external agents** on, inspected the page, then turned it off again. Nothing else changed. My tab is closed.
- `bun scripts/check-components.ts` run locally.

## What works

1. **Scope truth is good.** The read switch names what is exposed: "jobs, private Profile notes and saved conversations". The write switch names its cost: "may spend runtime credits". It also says "Approvals stay in Pitchcrew", which matches invariant 1. T3's "Runs commands and edits files without asking" is no clearer than this.
2. **Revocation copy matches the code.** "Turning this off blocks future calls; work already queued can continue" is accurate, because `readExternalAccess` runs on every bridge request. "Changing either switch requires every app to reconnect" is also accurate: `enableExternalAccess` rotates the token, and the stdio client captures `access` once at startup.
3. **Recovery after a lost write is correct.** `configure` sets `info` to `null` after a failed PUT, so a stale switch can't be toggled again until a fresh read. The write switch is disabled until read access is on, and it explains why.
4. **Verification is honest about its limits.** "It does not show whether an app is still connected" is stated. `lastRequest` is scoped to the current token, so a reconnect-required change resets it.
5. **The `send_message` idempotency contract is strong.** `clientRequestId` plus `read_message_receipt` covers the retry trap that external agents hit. T3 has nothing like it.
6. **Mobile layout.** No horizontal scroll at 390px. Copy and Check buttons reach 44px. Nothing pushes the page wider.
7. **Accessibility basics.** Switch names and descriptions resolve: `aria-labelledby` and `aria-describedby` point at existing ids, and screen readers announce "switch 'Allow external agents'". The section uses `aria-busy`, errors use `role="alert"`, and the timestamp uses `<time>`.

## Material problems (each one blocks a score above 9)

### P0: fails the repo's own gates

- `index.tsx` is **162 lines**. AGENTS.md caps React components at 100, and `bun run lint` (via `check-components.ts`) fails on it.
- It adds **native `<details>/<summary>`** ("No request received?"). AGENTS.md forbids that explicitly, and the check reports `index.tsx:140,141,148`. Use `AccordionSection` or `Collapsible` from `@pitchcrew/design-system`.
- Fix: split the file into `components/AccessStep.tsx`, `ConnectStep.tsx` and `VerifyStep.tsx`, then replace the disclosure.

### P1: one JSON block for every app is not practical

- The block is `mcpServers` JSON. The search keywords list `codex`, `grok` and `cursor`. Codex is configured in TOML (`~/.codex/config.toml` with `[mcp_servers.pitchcrew]`) or through `codex mcp add`, and Claude Code users would use `claude mcp add`. Those users get a format they must translate by hand, from double-escaped Windows paths. T3's `MCP_APPS` gives each app its own handoff (open, copy-url, copy-message or commands) and short steps. That is the largest gap against the reference.
- Fix: add a small app chooser in front of step 2 (Claude Desktop/Code, Codex, Cursor, Other). Each choice gets the right artifact: JSON, TOML, or a one-line `… mcp add` command. All of them come from the same `info.configuration`. Leave out logos and deep links; local stdio can't use them anyway.
- The rendered JSON is roughly 350px tall in a scroller nested inside the scrolling page (a second scroll trap on phones), and it's mostly path noise. Show a short summary line ("Runs Pitchcrew's bundled server for this workspace on port 14581"), make the copy button the main action, and put the raw text behind a disclosure.
- The copy control is only an icon, 24×24 on desktop, which is under the 32px desktop minimum. This is the main action of the step. Make it a labelled button ("Copy configuration") with visible copied feedback.
- In the run I checked, `command` points at `%TEMP%\pitchcrew-bun-1.4.4\bun.exe` and a worktree path. That's expected for a source launch, but the copy only says "If you moved or reinstalled Pitchcrew, copy a fresh configuration" inside the hidden help. When the configuration points into a temporary folder or a source checkout, say so next to the block, because that config can break without warning.

### P1: verification and feedback

- **Nothing updates on its own.** The user sends the prompt in another app, comes back, and has to press "Check for requests". There are also two refresh buttons with different labels: "Check again" in the header and "Check for requests". Poll `GET /access` every few seconds while step 3 is visible and the page is focused, stop once a request arrives, and keep one manual button.
- **Only successes are recorded.** `recordRequest` runs after a successful `externalCall`, so a 401 from a stale token after a switch change, a read-only 403, or a thrown call all leave the page on "Waiting for your app's first request". Those are exactly the cases where the user needs help. Record the last attempt and its outcome too: "Rejected: this app is using an old connection; reconnect it", or "Rejected: changes aren't allowed". Without this, the troubleshooting text is guesswork.
- **The stdio client's error points the wrong way.** On a 401 from rotated access, it tells the agent to "Ensure Pitchcrew is running and external MCP access is enabled". Both may already be true. Add "If access settings changed, reconnect this server" to that message.
- **Switch changes get no feedback.** Turning access on or off shows no toast and no inline "Saved". Turning it off removes the configuration and the verify step with no acknowledgement. The Settings autosave pattern in AGENTS.md calls for confirmation next to the changed control.
- Turning on write access rotates the token and silently breaks every connected app. The copy says so before the change, but there's no reminder afterwards. Add a one-time inline note after any switch change: "Reconnect Pitchcrew in each app."

### P2: hierarchy and clay integration

- Above step 1 the section has three paragraphs of prose: a description, the local-only note, and step 1's own note. Merge the local-only/cloud note into the description. Naming "Grok Bot and ChatGPT" as unsupported is useful but reads like a footnote; one short line is enough.
- The current state is never summarised. With access on there's no "On · read only" or "On · read and write" fact next to the "External agents" heading. Use the existing chip vocabulary so the state is visible without reading the switches.
- `role="status"` wraps the whole callout, including its button, so every refresh re-announces the full block. Put the live region on the status line only.
- Mobile: the switches are 24px tall, and only the switch is clickable, not the row. The `<summary>` target is 20px. Both are under the 44px minimum for coarse pointers.
- The numbered `<ol>` with h4 steps reads well, but it's a new local pattern (`.external-mcp-steps` with a muted marker). The rest of Settings uses trays and rows. That's acceptable, but it should be considered for `styles/system.css` if other settings get step flows.

## T3 comparison, briefly

|                  | T3 "Use in another app"                                  | Pitchcrew External agents                                |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Per-app handoff  | Yes (`MCP_APPS`: open, copy URL, copy message, commands) | No, one generic JSON block                               |
| Access choice    | Radio levels, each with a reason when unavailable        | Two switches; dependency explained                       |
| Scope/cost truth | Short                                                    | Better: data named, credits named, approvals stay        |
| Revocation truth | Manage access link                                       | Explicit and accurate                                    |
| Verification     | None                                                     | Last successful request (successes only, manual refresh) |
| Copy affordance  | Labelled rows with copied state, toasts                  | 24px icon only                                           |
| Presentation     | Focused wizard dialog, Back/Next/Done                    | Inline section on a long Accounts page                   |

An inline section is fine; it doesn't need to become T3's wizard dialog. The steps that would lift the score are: per-app artifacts, a labelled copy action, automatic verification that also reports rejections, and passing lint.

## Path above 9

1. Pass lint: split the component and replace `<details>` with the shared Collapsible or AccordionSection.
2. Add an app chooser in step 2 with JSON, TOML and `mcp add` artifacts, a labelled "Copy …" button with copied feedback, the raw config behind a disclosure, and a note when the config points at a temp or source path.
3. Make verification poll while visible, keep one refresh control, and record rejected attempts with a reason.
4. Show inline saved/reconnect feedback after switch changes, add a state chip in the header, and fix the reconnect hint in the client error.
5. Fix targets and the live region: rows or switches at least 44px on coarse pointers, and `role="status"` on the status line only.

Without items 1–3 the honest ceiling is about 8.
