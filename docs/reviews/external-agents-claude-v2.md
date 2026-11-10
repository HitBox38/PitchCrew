# External agents settings: independent design/UX review (Claude, v2)

Date: 2026-11-10 · Scope: uncommitted v2 changes on `t3/external-agent-ux-review` (Settings > Accounts > External agents, `lastRequest`/`lastAttempt`, Codex TOML, labelled copy). This is a fresh review, not a continuation of v1. It's read-only and I applied no fixes.

**Score: 8.5 / 10**

v2 fixes every blocker from v1 (lint shape, native disclosure, one-format-fits-all configuration, icon-only copy, manual-only verification, success-only evidence), and the live flow now works end to end. It isn't above 9 yet. Two material problems remain, both small: the copy buttons' visible labels aren't part of their accessible names, and the "Access saved" confirmation sits far from the switch that triggered it, which breaks the Settings autosave rule in AGENTS.md. Fixing those two would put this at 9 or a little above; nothing else is blocking.

## How it was checked

- **Source:** `ExternalMcpSettings/index.tsx`, `components/{ExternalAccess,ConnectApp,VerifyConnection,ConnectionEvidence}.tsx`, `hooks/useExternalMcp.ts`, `configuration.ts` and its test, shared `components/SourceBlock`, `CodeBlockCopyButton` (the `label` diff), the `settings.css` diff, `SettingRow`, `FormSelect`, the orchestrator `routes/external-mcp.ts` and `external/configuration.ts`, and the `mcp/src/external/client.ts` error text. Every component is under 100 lines and the disclosure is now `AccordionSection`. I didn't rerun lint because the root agent owns the automated checks.
- **Live:** my own preview tab on `http://127.0.0.1:14581/settings?section=accounts`. This is the isolated production-mode daemon with the fictional workspace `pitchcrew-external-review-20261110`, not Demo. I confirmed v2 was what rendered: the "Configuration for" selector, "Copy configuration"/"Copy prompt" labels and the scope fact "This workspace · Read-only" were all present. Checked at 1280×800 light and 390×844 dark. I opened the tab, closed it when done, and started no daemon.
- **Flow I ran:**
  1. Switched JSON → Codex and checked the TOML.
  2. Using this isolated workspace's own `external-mcp.json` token, POSTed `status` to `/api/external-mcp` → 200. Within about 3 s, with no click, the page showed **"Request received · pitchcrew_status 1:38 PM"**.
  3. POSTed `create_job` with `{}` (rejected by the read-only gate before parsing, so nothing was created) → 403. The page auto-updated to **"Request blocked: changes are off"** with reconnect guidance.
  4. Turned **Allow changes and crew messages** on → header fact "Job changes + crew", **"Access saved: job changes and crew messages. Reconnect your apps."**, and the evidence reset to "Waiting for your app's first request" (new grant).
  5. Reused the old token → 403 "disabled or revoked. Check Settings > Accounts > External agents…, then reconnect this app". As designed, the page kept showing Waiting.
  6. Turned changes back off. The final state is read-only, the same level I found, but with a rotated token.
- **What was not tested:** no real external app (Claude Desktop/Code, Codex, Cursor) was connected, and no stdio `mcp serve` process ran. The "connection" was plain authenticated HTTP to the bridge using the fixture workspace's token. I didn't paste the TOML into a real Codex. I relied on the root's report that the local CLI help confirmed the format, plus my own check that the escaping is valid TOML (JSON string escapes are valid TOML basic-string escapes, and the unit test covers spaces, quotes and non-ASCII). No paid runs and no `send_message`.

## Resolved since v1 (verified)

| v1 item                                        | v2 evidence                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 162-line component, native `<details>`         | Split into four components plus a hook, all ≤ 86 lines. "No request received?" is `AccordionSection` (44px trigger on mobile).                                                                                                                                 |
| One JSON for every app                         | `FormSelect` "Configuration for": JSON configuration / Codex. Each option has its own merge instructions ("replace that entry; keep your other settings. Restart Codex afterward."). The TOML is generated from the same `info.configuration` and unit-tested. |
| 24px icon-only copy                            | Labelled "Copy configuration" / "Copy prompt" that switch to "Copied" when done. Measured 160×32 and 124×32 on desktop, 44px tall on mobile. A failed copy shows manual-copy guidance.                                                                         |
| 350px config                                   | `max-h-40` (160px) and wrapped.                                                                                                                                                                                                                                |
| Installation path warning only in hidden help  | Shown under the block: "These paths belong to this installation and workspace; moving or deleting its executable, checkout or data folder breaks the connection."                                                                                              |
| No automatic verification; two refresh buttons | Polls `GET /access` every 3 s while access is on and the tab is visible, skipping while a save is pending. Measured: 43997, 46991, 49994, 52992 ms. Header "Check again" now appears only on load error, leaving one "Check for requests" button.              |
| Successes only                                 | `lastAttempt` with `succeeded` / `read-only` / `failed`, each with its own headline and next step. Both live paths verified.                                                                                                                                   |
| Grant race                                     | Activity is keyed by token. In-flight calls from an old grant write into a detached object, and `externalMcpInfo` returns evidence only when `token === access.token`. Verified live: rotation reset the evidence.                                             |
| Client error pointed the wrong way             | "Keep Pitchcrew running. After changing access, reconnect this app." `send_message` with a `clientRequestId` points the agent to `pitchcrew_read_message_receipt`.                                                                                             |
| No state summary or saved feedback             | Scope fact "This workspace · Off / Read-only / Job changes + crew". A `<output>` "Access saved: … Reconnect your apps." or "Access off. New calls are blocked…".                                                                                               |
| `role="status"` wrapped the button             | The live `<output>` now contains only the evidence text; the button sits outside it.                                                                                                                                                                           |
| Mobile targets                                 | The rows are `<label htmlFor>`, so the whole row toggles. A coarse-pointer `::after` extends the switch. No horizontal scroll at 390px (`scrollWidth` 390).                                                                                                    |

Not showing anonymous or old-token rejections is a deliberate choice: it keeps unauthenticated callers from writing evidence into the page. The copy states the limit plainly ("Rejected old connections cannot appear here; reconnect if your app reports revoked access"), and the bridge's 403 text sends the user back to this page. I agree with the trade-off.

## Remaining material problems (block > 9)

### 1. Copy buttons' accessible names don't contain their visible labels (WCAG 2.5.3)

`SourceBlock` always sets `aria-label={`Copy ${label}`}`, so the buttons are announced as **"Copy Pitchcrew MCP configuration"** and **"Copy Connection check prompt"** while the visible text is "Copy configuration" and "Copy prompt". A voice-control user who says "click Copy configuration" may not hit the step's main action. After copying, the visible text becomes "Copied" but the name doesn't change (the separate polite live region does announce it, which is fine).
**Fix (shared, one line):** in `SourceBlock`, use `aria-label={copyLabel ? undefined : `Copy ${label}`}` so labelled buttons take their name from the visible text. Icon-only callers stay unchanged.

### 2. Saved confirmation is far from the control that changed

The `<output>` renders at the top of the section, under the description. Measured on desktop: confirmation at y=162–170 and the write switch at y=422–430, about 260px apart. On a phone it sits above the "Local apps only" paragraph and is often off-screen when the user is looking at the switches. AGENTS.md says: "Autosave confirmation follows the specific changed control." The first save also inserts a line above the switches, a small layout shift.
**Fix:** render `saved` inside the "Choose access" step, directly below `ExternalAccess`, for example as a `settings-callout` that says "Reconnect Pitchcrew in each app". Keep `<output>`. Reserve its space, or accept the shift since it now appears below the controls.

## Minor (do not block 9)

- **Raw configuration is still a nested scroller.** It's 160px, but on a phone it's a scroll area inside the scrolling page with mostly path noise. A one-line summary with the copy button in front and the raw text behind an `AccordionSection` ("Show configuration") would be calmer. Optional now that the copy button is labelled and primary.
- **Temporary path is not called out specifically.** The generic lifetime warning is accurate. This run's `command` is `…\AppData\Local\Temp\pitchcrew-bun-1.4.4\…\bun.exe` plus a worktree checkout, which can disappear without the user moving anything. A conditional sentence when `command`/`args` sit under the OS temp folder or a source checkout would be more honest. It only affects source launches; packaged installs use the bundled runtime.
- **Heading order.** The `AccordionSection` header renders as `h3` under the step `h4` headings (Base UI's default `Accordion.Header`). This is a shared-primitive issue; pass a heading level or `render={<h5 />}` if the primitive supports it.
- **Mobile title truncation.** "Pitchcrew MCP configur…" truncates beside the 160px copy button at 390px. A shorter label ("MCP configuration") or wrapping the header would fix it.
- **Polling never stops.** It keeps going after a request arrives, as long as the section is mounted, access is on and the tab is visible. It's cheap (one `no-store` GET every 3 s) and keeps rejection evidence fresh, so this is acceptable. Note it in case Settings gets more pollers.
- **A newer failure hides the earlier success.** After a blocked write, the earlier successful `status` is no longer shown. That's the right priority, but "Earlier request received at …" as a secondary line would reassure users that the connection itself works.

## Score rationale

My v1 ceiling without fixes for lint, per-app configuration and verification was about 8. v2 clears all three and adds the grant-race guard and labelled copy. Hierarchy, honesty of scope and cost, revocation truth and live verification are now strong, and I watched success, blocked and rotated states each render correctly against a real daemon. What keeps it at 8.5 instead of 9+ is one accessibility defect on the step's main action and one break of a written Settings rule. Both are a few lines and neither needs a redesign. The score is not averaged or rounded up.
