# External-agent support: T3 Code comparison

Reviewed 2026-11-10 against the local T3 Code checkout at `D:\CodeStuff\t3code` and Pitchcrew's current external MCP implementation. Source inspection establishes implemented behavior; it does not prove every advertised third-party client works.

## The blunt assessment

T3 has a complete connection product. Pitchcrew had two permission switches and JSON. Its boundary enforcement is useful, but users could not tell whether another app had actually reached it, and a lost crew-send response exposed them to duplicate paid work despite the app already having durable receipt infrastructure.

The largest capability gap remains: T3 supports remote HTTP MCP with OAuth. Pitchcrew supports local stdio only. No amount of setup styling makes a cloud-hosted Grok Bot work with Pitchcrew's current transport.

## How T3 works

- `apps/web/src/components/mcp/UseInAnotherAppDialog.tsx` offers App → Access → Connect, reachable from Settings and the command palette. It reports missing reachability, sign-in and tunnel states.
- `apps/web/src/components/mcp/mcpApps.ts` gives Grok Bot a public MCP URL prompt and opens `grokbot://app` with a website fallback. Claude gets a connector form; other clients get their appropriate URL or command instructions. Grok has no special bypass into T3.
- `apps/server/src/mcp/McpHttpServer.ts` exposes `/mcp`; `auth/McpOAuth.ts` implements discovery, redirect/resource validation, S256 PKCE, single-use authorization codes and separately revocable app sessions. `auth/EnvironmentAuth.ts` persists sessions.
- `mcp/McpToolAccess.ts` and `McpInvocationContext.ts` enforce permission ceilings server-side. External callers cannot obtain internal running-thread preview/device authority simply by passing a header.
- `mcp/OrchestratorMcpService.ts`, `orchestration-v2/ThreadManagementService.ts` and `mcp/toolkits/thread/tools.ts` route external work through the same durable services as UI work: discovery, send, read, wait, interrupt, queue and schedule. Stable request IDs, receipts and links make recovery possible.
- `apps/web/src/components/settings/AuthorizedClientsSettings.tsx` lists independently authorized apps and revokes them individually.

## What this version changes

1. Local setup states its compatibility limit before access is enabled, explains shared permissions and reconnection, generates JSON or Codex TOML and supplies a harmless check prompt. A successful tool call proves a request reached this daemon; authenticated failed/read-only attempts receive recovery guidance. Evidence refreshes while the page is visible and never claims an app is still connected.
2. An uncertain permission save removes stale controls until a fresh access read succeeds.
3. External crew messages can use the existing durable client UUID/digest mechanism. A read-only receipt tool reconciles acceptance without reposting, exposing only identity. Existing clients can omit the UUID for compatibility.
4. Latest success and attempt evidence stay in one bounded in-memory grant slot. They contain no arguments, results, errors, client names or stored user content and reset on restart/rotation. Old in-flight grants cannot overwrite current-grant evidence. Invalid credentials and unknown actions cannot spoof verification.

## Remaining improvements, ranked

1. **Remote HTTP MCP and per-app grants.** This is the real prerequisite for cloud Grok Bot/ChatGPT connections. It needs a public reachability strategy, OAuth consent, per-client revocation, permission ceilings and recovery UX. Do not expose the private loopback JSON bridge or weaken its Host/Origin/session protections as a shortcut.
2. **Verified client-specific setup.** Generic JSON still requires users to understand their client's MCP format. Add only formats/commands exercised against installed apps. A brand picker without working installation/handoff is cosmetic.
3. **Focused work tracking and control.** External clients still combine queue/run/conversation reads to follow deliveries and human blockers. A bounded wait/status contract and scoped stop can improve this, but require explicit semantics for multi-agent conversations and paid work.
4. **Per-app activity.** Shared grant activity cannot identify the caller. Individual app management belongs with individual credentials, rather than invented client names from untrusted request labels.

Do not copy T3's unconditional Done button as proof of connection, or its default Auto grant as Pitchcrew's least-privilege default. T3's source also hides Gemini for compatibility problems; advertised client counts are not quality evidence.

## Review and verification record

Independent review reports and the normal-user audit are saved beside this report. Scores apply to the reviewed scope and version, not to the entire app. Final validation and remaining limitations are recorded after the iteration loop.

- Codex: [v1](external-agents-codex-v1.md) scored 8/10 and reproduced the old-grant race; [v2](external-agents-codex-v2.md) and [v3](external-agents-codex-v3.md) scored 9.2/10 after fixes, with no unresolved actionable source findings.
- Claude Opus 5.5: [v1](external-agents-claude-v1.md) scored 6.5/10; [v2](external-agents-claude-v2.md) scored 8.5/10 and confirmed actual rendered success, rejection and rotation feedback; [v3](external-agents-claude-v3.md) scored **9.1/10** after live desktop/mobile/dark checks, with no blockers. This score applies to the local external-agent setup flow, not the entire app or remote connectivity.
- A real SDK stdio client launched the generated Bun command, discovered nine read-only tools and called `pitchcrew_status` successfully. The installed Codex CLI parsed the generated TOML command/arguments unchanged through temporary command-line overrides; no user client configuration changed.
- Final focused validation passed **11 tests**: 4 API/helper tests, 3 desktop copy-helper tests and 4 Settings browser tests, including automatic success/rejection feedback, ambiguous-save reconciliation, format/clipboard state and clipboard failures. Tests use production-mode fixtures or disabled dispatch, with no Demo runtime execution. Earlier browser attempts had startup/cleanup timeouts, and one retry collided with the prior fixture port. The final complete browser group passed on a fresh port using the existing port-remap setting, without increasing timeouts. This does not claim the underlying shared test-harness flakiness was fixed.
- Typecheck, lint and the production UI build passed. The build retains existing CSS highlight, large-chunk and PDF import warnings.

## Normal-user audit outcome

The separate [Codex computer-use audit](external-agents-computer-use.md) used the visible web UI and Windows fallback, created a fictional job and completed a real installed Codex / GPT-6.1 Sol / Medium turn. Run `8b89ac31-16dc-4a53-91c0-d15742f9b7c7` completed in about 27 seconds. A Grok attempt stopped before launch with the app's missing `XAI_API_KEY` recovery message; no successful Grok turn is claimed. No Demo was used.

It found two unresolved issues outside this setup change: compact navigation leaves its drawer/scrim over the destination (P2), and the Grok model menu offers the Codex agent's default model (P3; an invalid launch was not attempted). These should be the next small UX fixes. The audit also confirmed draft preservation, explicit stale-asset reload recovery and cancellation of the blocked message. Job edit/move, phone use, active Stop and outward approvals remain unchecked.

Audit cleanup restored paused roles and the default conversation runtime, cancelled blocked work and revoked external access. Fictional data remains in the isolated temporary workspace for reproduction; the task's daemon and browser tabs were closed afterward. No real user workspace or client configuration was changed.
