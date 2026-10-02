# AGENTS.md

Instructions for coding agents and contributors working on Pitchcrew. If a change makes anything here false, update this file with the change.

## What Pitchcrew is

A local-first job-search app with a crew of role agents. Pitchcrew starts runtime CLIs, gives them scoped MCP tools, and keeps shared state on a board. It does not implement a provider agent loop. See [README.md](README.md) for setup and the product view.

## Status

Working MVP with a shared browser/Electron UI, Scout/Writer/Reviewer runs, persistent role and crew chats with AI Elements, shared and role-assigned Markdown skills with skills.sh imports and user-reviewed chat suggestions, bounded agent-triggered follow-ups, user-approved role change proposals, source-backed Markdown packets, approval-gated local export, manual application tracking, approval-gated local Chromium computer use, and role-scoped read-only GitHub/Google Workspace connectors. Demo is deterministic. Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Cursor Agent, Goose, Kiro CLI, Grok Build, Pi and oh-my-pi adapters are implemented; live provider runs are not part of automated verification. Scheduling, automatic discovery, PDFs, outreach, whole-desktop control, and custom roles are deferred.

## Stack

- Strict TypeScript, Node 22.18+ or 24.11+ (supported LTS), pnpm 11 workspaces. Follow pnpm-lock.yaml and root engines.
- SQLite through better-sqlite3; versioned append-only events and projections.
- Official TypeScript MCP SDK with stdio transport and per-run capabilities.
- React and shadcn/ui (Base UI primitives), Tailwind, Vite 8, shared browser/Electron renderer. Compose with `render`, not `asChild`; `Button` defaults to `type="button"`, so submit buttons need `type="submit"`; menu labels sit inside `DropdownMenuGroup`.
- Motion for React supplies spring presses, pointer-driven clay card tilt, board layout changes, view and panel transitions, and new chat message reveals. The shared `AppMotion` provider loads Motion features and respects system reduced motion; pointer-driven effects also use its reduced-motion context. Base UI retains dialog semantics and focus management.
- TanStack Router with a typed code-based route tree and browser history for both renderers. The shared workspace shell stays mounted around lazy page outlets. Board lives at `/`; other views use named paths, chat threads use `/chat/<thread>`, and skill assignments use `/skills?filter=<assignment>`. The daemon serves the SPA entry for deep links in development and production.
- Zustand owns the renderer workspace snapshot, shared UI state and API actions in `packages/ui/src/WorkspaceStore/index.ts`. Pages use selectors; the mounted shell owns polling and chat-stream cleanup. Route state stays in TanStack Router; component-only form state stays local.
- Oxlint for linting and Oxfmt for formatting. Do not add ESLint or Prettier.
- Oxc transforms / Rolldown in Vite, tsdown / Rolldown for Electron's main process.
- Electron uses a paper-themed draggable title bar with native macOS traffic lights and Windows/Linux window-control overlays. Its sandboxed CommonJS preload synchronizes the renderer theme through a main-frame, origin-checked IPC channel without exposing Electron APIs to the page. Explicit Google PKCE sign-in links with a loopback callback open in the system browser through a narrow main-process URL allowlist; other external navigation is denied.
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
    src/gemini-cli/
    src/opencode/
    src/copilot-cli/
    src/cursor-agent/
    src/goose/
    src/kiro-cli/
    src/grok/
    src/pi/
    src/oh-my-pi/
  mcp/            # stdio tools, read-only connector clients/auth and shared export/browser gates
  packet/         # source quotation checks, word caps, versioned Markdown files
  ui/             # shared React renderer, shadcn components in src/components/ui
  desktop/        # sandboxed Electron main process
scripts/          # desktop launcher and isolated desktop smoke test
docs/             # design decisions
```

## Code organization

- Keep React component files at most 100 lines after formatting. `pnpm lint` checks every production TSX file.
- Put each feature in a named folder with `index.tsx` as its public entry, `components/` for sections, `hooks/` for state/effects, and `__tests__/` for colocated tests. Use `types.ts`, `helpers.ts`, `constants.ts` and `api.ts` when the feature needs them; do not create empty placeholders.
- Keep components focused on rendering. Put pure transformations in helpers, network operations in API modules, and reusable stateful behavior in hooks. Name handlers as actions; reserve `use` prefixes for hooks.
- Share repeated domain labels, formatting and status calculations under `packages/ui/src/lib/`. Keep shadcn and AI Elements families under `components/ui/` and `components/ai-elements/` with explicit public exports.
- Backend entry points preserve their public contracts and compose private modules by domain: `board/`, orchestrator `crew/` and `http/`, adapter `process/`, MCP `tools/`, connector `auth/` and computer modules. Keep transactions and approval checks together.
- Styles live in ordered feature files under `packages/ui/src/styles/`; `styles.css` preserves their cascade order. See [docs/code-organization.md](docs/code-organization.md).

## Commands

```sh
pnpm install
pnpm dev          # daemon + hot-reloading UI at http://127.0.0.1:4417
pnpm desktop      # build Electron main process; reuse or launch development daemon
pnpm build        # UI and Electron main bundles
pnpm icon:build   # regenerate Electron's PNG from the canonical favicon SVG
pnpm start        # daemon serving built UI
pnpm desktop:prod # build and launch Electron with built UI
pnpm browser:install # install Chromium for browser tools and tests
pnpm test         # fixtures, loopback HTTP, MCP and isolated Chromium; no provider calls
pnpm test:desktop # isolated production daemon + actual Electron renderer check
pnpm lint         # Oxlint; warnings fail
pnpm format       # Oxfmt
pnpm format:check
pnpm typecheck
pnpm check        # lint, typecheck, tests, build
```

The UI has hot reload; restart the daemon after backend changes. The default data directory is ~/.pitchcrew, optionally PITCHCREW_HOME outside the repository. PITCHCREW_PORT defaults to 4417. Tests use temporary directories outside the repository and fictional fixtures under packages/*/test/fixtures/.

## Core concepts

- **Role.** A stored Scout, Writer, or Reviewer configuration with runtime, model, enabled flag, instructions and agent capabilities. Edit a role in a full-height side panel with a scrolling form and persistent save actions, opened from Crew, chat, the sidebar or command palette. Settings produce AGENTS.md and CLAUDE.md under the data directory. Each run gets an isolated subfolder and MCP configuration. Change instructions and capabilities through Crew settings or approve an agent’s proposal in chat; generated files are refreshed on startup.
- **Skill.** A user-managed Markdown instruction with a name, description and assignment to all agents or selected roles. Manage skills on the Skills page or open it from role settings. Skills display a Made by label: the GitHub source owner for imports, the originating role for approved custom agent suggestions, or You for user-created skills. Creator and repository names are searchable. Skill creation, updates and deletion append version 6 board events; deletion uses a tombstone so replay retains history. Each chat/workflow run snapshots its assigned skills into the runtime context, prompt and isolated `skills/<skill-id>/SKILL.md` files. Edits affect future runs only, including follow-ups; active runs retain their original copy. Import public GitHub-backed skills.sh links in the editor, review the loaded Markdown and assignment, then save; imported skills can explicitly refresh their source instructions. The bounded public GitHub reader uses immutable blobs, no credentials, no CLI installer and no redirects, and copies only SKILL.md instructions. Imported skills retain source URL, path and blob SHA. Skills grant no capabilities. Agents can discuss skills in user and crew chats and persist up to three suggestions per run through `pitchcrew_propose_skill`; suggestions appear in Crew work with their reason, assignment and exact instructions. Only a user decision adds the stored proposal snapshot, atomically with its decision; approval never re-fetches the source. Bundled scripts, assets, private repositories and non-GitHub skills.sh sources are deferred.
- **Notifications.** Saved agent messages and pending packet/browser/role/skill approvals feed the notification bell, unread history and shadcn/Base UI Toast alerts. Up to three toasts stack in a portaled viewport; Base UI manages hover/focus timer pauses, keyboard access, announcements and swipe dismissal. Alert actions are typed router links. Message toasts show a headline and action only; attention toasts add a normalized preview of at most 96 characters and two visible lines. Full messages remain in chat. Notification context comes from saved entities: messages, user-input questions, packet/browser approvals and role/skill proposals each have their own icon and action label; questions use ochre, approvals teal, proposals plum and messages blue accents, using theme tokens in light and dark modes. Message and attention requests have distinct sounds; sounds can be disabled in the notification panel. History never plays alerts on initial load, and repeated snapshots/stream updates do not repeat alerts. Scoped `pitchcrew_notify_user` saves an exact user-facing message with `message` or `attention` priority (three per run), without granting approval, queuing work or pausing a run. Agents finish their turn when asking for input and continue on the user’s reply. Notification clicks open chat or Inbox, never decide requests. Notifications and sounds stay inside the browser/Electron renderer; no native OS alerts or notification IPC bridge are used.
- **Chat and crew tasks.** User messages launch isolated chat turns. User and crew chat replies stream through a session-protected HTTP channel, using native CLI text updates when available (some CLIs emit only complete messages). Live previews are transient; only validated final replies are persisted and passed to agents. Reconnecting restores active previews and saved messages; cancellation or failure clears unfinished text. Agents can message roles, invoke themselves or others, and update the attached job through scoped board tools. Follow-ups wait for their parent to finish, obey enabled roles/capabilities and the card state machine, and are capped at six per user-started chain. Cancelling a run stops its chain. Interrupted queued work is marked failed on restart.
- **Starter skills.** On startup, the daemon loads missing starter skills from the latest public GitHub HEAD into the board before serving the workspace. The ten-entry schema-free `@pitchcrew/core/base-skills` catalog stores source paths and default role assignments, never supplied version hashes. Renamed catalog repositories use explicit canonical aliases (article-writing now uses affaan-m/ECC). Writing skills default to Writer, research/questioning to Scout, and humanizer/PDF review to Reviewer. Existing matching skills and deleted tombstones prevent automatic reinstallation; edits and renames preserve source identity. Missing or offline sources are reported on the Skills page and can be retried without restoring deletions. All loads resolve HEAD afresh and only immutable blobs are cached; proposals still approve their exact reviewed snapshot. Individual skills allow up to 50,000 characters; assigned skills still total at most 60,000 characters per role. view-pdf requires separate viewer tooling. Set PITCHCREW_SEED_SKILLS=0 to skip automatic seeding, as isolated automated tests do.
- **Connector.** GitHub fine-grained tokens and Google Desktop OAuth provide read-only repository, Gmail, Drive/Docs, Sheets and Calendar access through the scoped MCP gateway. Accounts connect in Crew settings; each service is disabled per role until the user enables it. Credentials live outside the repo in connectors/credentials.json, never in board events, snapshots, prompts or MCP configuration. Google OAuth client environment variables are filtered from role CLI environments. Disconnect aborts requests and removes local credentials; provider revocation is separate. External content is untrusted data; packet evidence still requires verified local profile quotations. See [docs/connectors.md](docs/connectors.md).
- **Runtime adapter.** Implements detect(), run(context) and chat(context), supplies fallback model suggestions and optional listModels(signal) discovery for the searchable Crew settings picker, parses CLI output into validated RunResult or ChatResult values and emits progress messages. Native catalogs load on demand, are cached in memory for five minutes and can be refreshed explicitly; the UI labels runtime results and fallback suggestions. Demo has no models. Discovery uses only bounded native model-list operations, never starts a conversation or inference turn, never reads provider credentials directly and remains separate from health detection. Provider-specific commands and model catalogs belong only in adapters. See [docs/model-discovery.md](docs/model-discovery.md).
- **Computer use.** Opt-in per role; shared MCP tools open a visible isolated Chromium browser per run. Inspect returns page text and a screenshot. Every navigation, click, fill, selection, keypress and exported-packet upload requires an exact-action single-use user approval from Inbox, checked and consumed in the MCP gate against the current page and run. Computer-enabled CLI/ACP runs have a 30-minute limit; other runs keep three minutes. Agents wait using bounded execute calls; pending approvals expire and browsers close when the run ends or the daemon restarts. No arbitrary JS, filesystem upload or desktop control. Public network checks block local/private URLs; website scripts remain untrusted and this is not an OS network sandbox. See [docs/computer-use.md](docs/computer-use.md).
- **Board.** One card per application. Allowed transitions live in core. Agents coordinate through persistent board state; launches start with user actions and can continue through bounded board-backed agent tasks.
- **Event log.** Version 7 adds optional message notification priority; versions 1–6 remain decodable and replayable. Version 6 adds computer-use capability and browser action approvals; versions 1–5 remain decodable and replayable. Version 5 added skill provenance and skill proposals. Version 4 added managed skills and version 3 added optional connector capabilities. Every card, role, skill, skill proposal, run, approval, computer approval, message, role proposal and task update appends a versioned event and changes its projection atomically. Rebuild replays events in order.
- **Profile.** User Markdown files under the data directory's profile folder. Registered packet claims must be exact supported quotations. Mechanical lint is not a complete semantic fact checker.
- **Packet.** Versioned resume.md, cover_letter.md, form_answers.md, note.md and claims.json. The job post is stored on its card. PDF generation is deferred.
- **Approval.** Exact packet snapshot and SHA-256 digest bound to a card and export action. It is single-use; export calls enter the shared MCP gate. Agents have no approval tool. Successfully exported current packets allow users to record manual submissions.

## Invariants

These must stay true. A change that breaks one is a bug even if tests pass.

1. **No outward action without approval.** Anything that sends, submits, posts or emails must go through a gated MCP tool checking an unused approval bound to the exact payload. The check belongs in MCP, not in prompts or UI. Browser interactions use an exact-action approval bound to run, role, card, page fingerprint and upload contents; website-controlled scripts remain outside payload verification. Local export also uses its gate.
2. **Provider code stays in packages/adapters/.** The orchestrator, board and UI see only the runtime interface and normalized results/progress.
3. **Agents coordinate through the board only.** Internal messages and invocations are persisted board entities with scoped MCP tools; no adapter-to-adapter messaging and no shared runtime sessions across roles.
4. **Events are append-only and stay decodable.** Never rewrite or delete stored events. Schema changes add a new version and retain a decoder for every old version.
5. **Health checks have no side effects.** detect() never signs in, creates a session or spends tokens.
6. **Credentials stay with the runtime.** Pitchcrew never reads, copies or stores provider tokens. Adapters rely on the CLI's native authentication, including its environment configuration.
7. **The daemon binds to 127.0.0.1 only.** Keep origin/Host checks and user-session/run-capability boundaries intact.
8. **User data never enters the repo.** Profile notes, packets and DB live outside it. Tests use fictional fixtures and checked temporary cleanup paths.
9. **Rules change only with user approval.** Agents propose their own instruction/capability changes in chat and never apply them directly. Only user settings or an explicit user decision on a proposal updates roles; skills are added or changed only through startup defaults, user settings or user-approved skill proposals; rules.yaml is deferred.

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

Scout evaluates an existing lead; the user shortlists it. Writer drafts, Reviewer agrees or requests changes. Approval exports files locally; the user submits independently or approves browser interactions, then verifies confirmation and records the outcome. Keep active-run ownership, revised-packet approvals, cancellation and interrupted-run recovery covered when modifying this flow.
