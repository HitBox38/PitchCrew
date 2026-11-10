# Normal-user computer-use audit

Date: 2026-11-10. Scope: isolated production-mode workspace at `http://127.0.0.1:14581`, with fictional data and installed runtimes. No Demo runtime, direct database writes or HTTP mutation shortcuts.

## Status

Finished as a bounded normal-user pass. The first pass was stopped by the user's physical Escape key; the user explicitly authorized resuming it. One real Codex turn completed; a Grok send was blocked before launch because this isolated workspace had no credential. No result was mocked.

## Observed so far

- Settings → Find a setting → `grok` found **External agent MCP access** and opened the matching control.
- Keyboard selection switched JSON to Codex TOML. **Copy configuration** showed its copied feedback. Switching back and disabling access worked, with the nearby access-off confirmation.
- Opening Add job after the parent replaced production assets showed the explicit stale-download recovery. Reload required confirmation about unsaved drafts; the confirmation worked. This was an induced asset-replacement scenario, not an unexplained fresh-session failure.
- After reload, T3 shared-preview snapshots twice returned `Preview automation snapshot timed out after 15000ms`, although preview status reported the page loaded. This is an automation-tool limitation, not evidence that Pitchcrew itself failed. The audit switched to the Windows computer-use fallback.
- The first fallback was stopped by physical Escape before navigation completed. External access had already been revoked; no roles were enabled.

## Completed flow observations

After resuming with Windows CUA, **Acme Audit / Frontend Engineer** saved through the real Add job form. The fictional description explicitly disclaims a real employer/application. The compact browser viewport kept the Add job footer reachable while the form scrolled.

Scout was resumed through Crew → Scout menu → Resume Scout. Its state became Idle; Scout chat showed **GPT-6.1 Sol · Medium**. The requested harmless prompt completed: the settled turn showed **Worked 27s · 1 step**, header **Ready**, activity **Checking crew**, and the reply “I can read this fictional workspace, and I have not modified data or taken outward actions.”

An unsent follow-up survived navigation to Board and browser Back unchanged. That draft was later deliberately replaced by the second test prompt.

For the second attempt, Conversation runtime → Grok Build → reported **grok-4.6** saved successfully. Sending was blocked before runtime launch: **XAI_API_KEY is missing from the daemon environment**, with **Open runtime settings** and **1 not sent · Waiting**. The recovery link opened the Grok runtime section, which reported **Sign-in needed** and explained setting a daemon/service key and restarting; no credentials were entered and no authentication flow was automated. This is an environment/setup blocker, not a failed model reply.

Cleanup used the UI: Scout was paused, the never-started Grok queue item was removed through its menu and remained in history as **Not sent · cancelled**, then the conversation override was restored to **Use agent default (Codex / GPT-6.1 Sol / Medium)**. No retry or third turn occurred. External access was already off. Only this audit's Zen tab and T3 preview tab were closed; the user's pre-existing tabs were retained.

## Observed issues

1. **P2 — Compact navigation keeps its modal drawer over the new page.** At the approximately 700px-wide app content area in Zen, open the hamburger drawer and choose Crew or Board. The URL and content change, but the drawer and dark scrim stay open until × is pressed. Reproduced for Board → Crew and Scout chat → Board; browser Back also retained the open drawer. Expected: a successful destination selection closes compact navigation so the chosen page can be used immediately. No data loss observed.
2. **P3 — Cross-runtime model menu offers the other runtime's default model.** With Scout's Codex default, open Conversation runtime, choose Grok Build, then open Model. It offers **Use agent default (gpt-6.1-sol)** alongside CLI default and Grok models. The selected safe value initially becomes CLI default; the suspicious option was not selected, so this audit establishes misleading cross-runtime labeling, not a proven invalid launch. Expected: inherited choices clearly distinguish the original agent runtime or are omitted when incompatible.

## Runtime and fixture evidence

The run was observed in the UI before this read-only diagnostic lookup. A subsequent session-protected snapshot confirmed:

| Item                        | Recorded value                                                                 |
| --------------------------- | ------------------------------------------------------------------------------ |
| Codex run                   | `8b89ac31-16dc-4a53-91c0-d15742f9b7c7`                                         |
| Conversation / role         | `scout` / `scout`                                                              |
| Runtime / model / reasoning | Installed Codex / `gpt-6.1-sol` / Medium                                       |
| Result                      | `completed`                                                                    |
| Started                     | `2026-11-10T12:05:00.488Z`                                                     |
| Finished                    | `2026-11-10T12:05:27.894Z`                                                     |
| Grok attempt                | `grok-4.6`, blocked before runtime launch; no Grok run ID exists               |
| Fictional card              | `d3dce12d-8f33-4e14-be20-0cd426ea9703`, Acme Audit / Frontend Engineer, `lead` |

Native Windows screenshots of the navigation drawer, actual reply, missing-key note and cancellation were inspected in the computer-use transcript. They were not exported as standalone image artifacts. An initial empty-board shared-preview capture is at `C:\Users\spide\.t3\userdata\browser-artifacts\browser-screenshot-127-0-0-1-mwamqf10-662a76b5.png`; it is context, not proof of the later findings.

## Unchecked and limits

Job editing/moving, a narrow phone-width pass, simultaneous paid runs, in-flight Stop, outward approvals, provider sign-in and an actual external-app MCP connection were not checked in this bounded pass. The compact browser width exercised the app's drawer layout, not a touch device. No Claude installation failure was investigated; the roster's unavailable state alone is insufficient to establish a detection bug. No real external client connection is claimed by this audit.

The two UX findings above are outside the external-agent setup change. No implementation code was changed during this audit. Final cleanup left Scout paused, no active runtime runs, no pending audit delivery, default conversation runtime restored and external access disabled; the fictional card and conversation history remain for reproduction.
