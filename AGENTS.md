# AGENTS.md

Instructions for coding agents and contributors working on Pitchcrew. If a change makes anything here false, update this file with the change.

## What Pitchcrew is

A local-first job-search app with a crew of role agents. Pitchcrew starts runtime CLIs, gives them scoped MCP tools, and keeps shared state on a board. It does not implement a provider agent loop. See [README.md](README.md) for setup and the product view.

## Status

Working MVP with a shared browser/Electron UI, Scout/Writer/Reviewer runs, persistent role and crew chats with AI Elements, bounded agent-triggered follow-ups, user-approved role change proposals, source-backed Markdown packets, approval-gated local export, and manual application tracking. Demo is deterministic. Claude Code and Codex adapters are implemented; live provider runs are not part of automated verification. Scheduling, automatic discovery, PDFs, outreach, submission, and custom roles are deferred.

## Stack

- Strict TypeScript, Node 22.18+ or 24.11+ (supported LTS), pnpm 11 workspaces. Follow pnpm-lock.yaml and root engines.
- SQLite through better-sqlite3; versioned append-only events and projections.
- Official TypeScript MCP SDK with stdio transport and per-run capabilities.
- React and shadcn/ui (Base UI primitives), Tailwind, Vite 8, shared browser/Electron renderer. Compose with `render`, not `asChild`; `Button` defaults to `type="button"`, so submit buttons need `type="submit"`; menu labels sit inside `DropdownMenuGroup`.
- Oxlint for linting and Oxfmt for formatting. Do not add ESLint or Prettier.
- Oxc transforms / Rolldown in Vite, tsdown / Rolldown for Electron's main process.
- Electron uses a paper-themed draggable title bar with native macOS traffic lights and Windows/Linux window-control overlays. Its sandboxed CommonJS preload synchronizes the renderer theme through a main-frame, origin-checked IPC channel without exposing Electron APIs to the page.
- Vitest for unit, HTTP workflow, adapter contract, and actual MCP stdio tests.

## Layout

```text
packages/
  core/           # contracts, Zod schemas, card state machine, event decoder
  board/          # SQLite append-only events, projections, approval state
  orchestrator/   # loopback HTTP daemon, role launches, scoped agent gateway
  adapters/       # all provider-specific logic
    src/demo/
    src/claude-code/
    src/codex/
  mcp/            # stdio tools and shared export gate
  packet/         # source quotation checks, word caps, versioned Markdown files
  ui/             # shared React renderer, shadcn components in src/components/ui
  desktop/        # sandboxed Electron main process
scripts/          # desktop launcher and isolated desktop smoke test
docs/             # design decisions
```

## Commands

```sh
pnpm install
pnpm dev          # daemon + hot-reloading UI at http://127.0.0.1:4417
pnpm desktop      # build Electron main process; reuse or launch development daemon
pnpm build        # UI and Electron main bundles
pnpm icon:build   # regenerate Electron's PNG from the canonical favicon SVG
pnpm start        # daemon serving built UI
pnpm desktop:prod # build and launch Electron with built UI
pnpm test         # fixtures, loopback HTTP and MCP; no external provider calls
pnpm test:desktop # isolated production daemon + actual Electron renderer check
pnpm lint         # Oxlint; warnings fail
pnpm format       # Oxfmt
pnpm format:check
pnpm typecheck
pnpm check        # lint, typecheck, tests, build
```

The UI has hot reload; restart the daemon after backend changes. The default data directory is ~/.pitchcrew, optionally PITCHCREW_HOME outside the repository. PITCHCREW_PORT defaults to 4417. Tests use temporary directories outside the repository and fictional fixtures under packages/*/test/fixtures/.

## Core concepts

- **Role.** A stored Scout, Writer, or Reviewer configuration with runtime, model, enabled flag, instructions and agent capabilities. Settings produce AGENTS.md and CLAUDE.md under the data directory. Each run gets an isolated subfolder and MCP configuration. Change instructions and capabilities through Crew settings or approve an agent’s proposal in chat; generated files are refreshed on startup.
- **Chat and crew tasks.** User messages launch isolated chat turns. Agents can message roles, invoke themselves or others, and update the attached job through scoped board tools. Follow-ups wait for their parent to finish, obey enabled roles/capabilities and the card state machine, and are capped at six per user-started chain. Cancelling a run stops its chain. Interrupted queued work is marked failed on restart.
- **Runtime adapter.** Implements detect(), run(context) and chat(context), parses CLI output into validated RunResult or ChatResult values and emits progress messages. Provider-specific commands belong only in adapters.
- **Board.** One card per application. Allowed transitions live in core. Agents coordinate through persistent board state; launches start with user actions and can continue through bounded board-backed agent tasks.
- **Event log.** Every card, role, run, approval, message, proposal and task update appends a versioned event and changes its projection atomically. Rebuild replays events in order.
- **Profile.** User Markdown files under the data directory's profile folder. Registered packet claims must be exact supported quotations. Mechanical lint is not a complete semantic fact checker.
- **Packet.** Versioned resume.md, cover_letter.md, form_answers.md, note.md and claims.json. The job post is stored on its card. PDF generation is deferred.
- **Approval.** Exact packet snapshot and SHA-256 digest bound to a card and export action. It is single-use; export calls enter the shared MCP gate. Agents have no approval tool. Successfully exported current packets allow users to record manual submissions.

## Invariants

These must stay true. A change that breaks one is a bug even if tests pass.

1. **No outward action without approval.** Anything that sends, submits, posts or emails must go through a gated MCP tool checking an unused approval bound to the exact payload. The check belongs in MCP, not in prompts or UI. The MVP has no such outward connector; local export also uses this gate.
2. **Provider code stays in packages/adapters/.** The orchestrator, board and UI see only the runtime interface and normalized results/progress.
3. **Agents coordinate through the board only.** Internal messages and invocations are persisted board entities with scoped MCP tools; no adapter-to-adapter messaging and no shared runtime sessions across roles.
4. **Events are append-only and stay decodable.** Never rewrite or delete stored events. Schema changes add a new version and retain a decoder for every old version.
5. **Health checks have no side effects.** detect() never signs in, creates a session or spends tokens.
6. **Credentials stay with the runtime.** Pitchcrew never reads, copies or stores provider tokens. Adapters rely on the CLI's own login.
7. **The daemon binds to 127.0.0.1 only.** Keep origin/Host checks and user-session/run-capability boundaries intact.
8. **User data never enters the repo.** Profile notes, packets and DB live outside it. Tests use fictional fixtures and checked temporary cleanup paths.
9. **Rules change only with user approval.** Agents propose their own instruction/capability changes in chat and never apply them directly. Only user settings or an explicit user decision on a proposal updates roles; rules.yaml is deferred.

## Card states

The authoritative transition graph is packages/core/src/states.ts, kept free of zod so the UI can import it from @pitchcrew/core/states (Oxlint allows only type imports of @pitchcrew/core in the UI). Typical flow:

```text
lead -> shortlisted -> drafting -> in_review -> agreed -> awaiting_approval
                            ^          |                        |
                            +-- changes_requested <-------------+
                                                                |
                                                            submitted
                                                                |
                                              screening -> interviewing -> offer
                                                  |             |
                                             rejected / withdrawn / ghosted
```

Scout evaluates an existing lead; the user shortlists it. Writer drafts, Reviewer agrees or requests changes. Approval exports files locally; the user submits independently and records the outcome. Keep active-run ownership, revised-packet approvals, cancellation and interrupted-run recovery covered when modifying this flow.
