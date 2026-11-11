# AGENTS.md

Instructions for coding agents and contributors working on Pitchcrew. If a change makes anything here or in a linked `docs/` topic file false, update it in the same change. Before changing a feature, read its topic doc from the list at the end of this file.

## What Pitchcrew is

A local-first job-search app with a crew of role agents. Pitchcrew starts runtime CLIs, gives them scoped MCP tools, and keeps shared state on a board. It does not implement a provider agent loop. See [README.md](README.md) for setup and the product view.

## Status

See [docs/status.md](docs/status.md) for the current feature inventory and [docs/external-mcp.md](docs/external-mcp.md) for external and remote agent access.

## Branch and release workflow

- `dev` is the integration branch for all development. Create every feature, fix, refactor, documentation and maintenance branch from the latest `dev`, and target `dev` when opening its pull request.
- `main` is the production release branch. Release through a pull request with `dev` as the head and `main` as the base; individual work branches must not target `main`.
- Every release pull request must include a version bump above the current `main` version. Prepare the bump on `dev` (directly or through a preparation branch merged into `dev`) before opening the release pull request. The root `package.json` supplies the installer version; keep workspace package versions in sync with it.
- Use semantic versioning (`MAJOR.MINOR.PATCH`): patch for fixes, minor for backward-compatible features, and major for breaking changes. Select and explain the bump in each `dev` → `main` release pull request based on the changes since the previous release.
- Include the chosen version, a summary of changes and validation in the release pull request. Required CI must pass before merging. Merging into `main` triggers the existing verified-installer publication workflow with `build-<full commit SHA>` tags.
- After a release, merge `main` back into `dev` so subsequent work includes the release merge and version history. Preserve the shared branches and their history.

## Stack

- Daemon, MCP and utility entry points use Bun and strict TypeScript and are included in the root typecheck. Vitest and build CLIs retain Node; bounded extraction/verification workers run in genuine Node helpers with the existing `tsx` loader and V8 heap limits, because Bun does not enforce `worker_threads.resourceLimits`. Never silently remove these limits. Electron compiles its main/preload and icon utility to JavaScript. The early UI theme initializer is TypeScript compiled by Vite to a blocking `/theme.js` asset in development and production. NSIS/PowerShell installer sources and the Next.js PostCSS configuration retain their required formats.
- Strict TypeScript, Bun 1.4.4 workspaces and Node 22.18+ or 24.11+ (supported LTS; Node 24 for packaging). Follow `.bun-version`, `bun.lock`, root `workspaces`, explicit trusted dependency builds, root engines and `patchedDependencies` (`patches/`; the `@shadcn/react` patch lets `scrollToMessage` take `keepPreviousPeek` and pin anchored, as the scroller pins a new last message; edit it with `bun patch`). Use `bun run <script>` for package scripts so Bun built-ins such as `test` and `build` do not bypass them.
- SQLite through better-sqlite3; versioned append-only events and projections.
- Document rendering engines and Playwright load on first document/browser use rather than daemon import. Snapshots containing frozen PDF artifacts still load the PDF reader to count their pages.
- Fastify serves the loopback HTTP API and production UI; request hooks enforce Host, Origin and local sessions before body parsing. Encapsulated route plugins compose the orchestration services. Development uses Vite through @fastify/middie; chat SSE retains Node response backpressure and disconnect cleanup.
- Official TypeScript MCP SDK with stdio transport and per-run capabilities.
- Oxlint for linting and Oxfmt for formatting. Do not add ESLint or Prettier.
- Oxc transforms / Rolldown in Vite, tsdown / Rolldown for Electron's main process.
- Vitest for unit, HTTP workflow, adapter contract, and actual MCP stdio tests.

## Layout

```text
packages/
  core/           # contracts, Zod schemas, card state machine, event decoder
  board/          # SQLite append-only events, projections, approval state
  orchestrator/   # loopback HTTP daemon, role launches, scoped agent gateway, job source fetcher, background service
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
    src/hermes/
  mcp/            # stdio tools, read-only connector clients/auth and shared export/browser gates
  packet/         # source quotation checks, packet rule evaluation, versioned Markdown files, PDF/DOCX rendering
  design-system/  # reusable React primitives, utilities and shared theme for app and landing
  ui/             # browser/Electron React renderer and app-specific AI Elements compositions
  landing/        # standalone public Next.js website; Vercel deployment is separate
  desktop/        # sandboxed Electron main process
scripts/          # desktop launcher, isolated desktop smoke test and legacy tracker converter
docs/             # design decisions
```

## Code organization

- Use `const` arrow functions for standalone functions, callbacks, object actions and owned class methods. Pass shared backend context as an explicit first argument; context factories close over their instance. Preserve constructors, accessors and library-required prototype methods or dynamically bound hooks (Lexical nodes, dnd-kit modifiers and Vite plugin hooks).
- Keep React component files at most 100 lines after formatting. `bun run lint` checks every production TSX file.
- App disclosure controls must use the shared shadcn/Base UI `Accordion` family for grouped rows, `AccordionSection` for a standalone section, or `Collapsible` for custom triggers. Never add native `<details>`/`<summary>` to `packages/ui/src` or `packages/design-system/src`; `bun run lint` rejects them. Import from `@pitchcrew/design-system/accordion` or `@pitchcrew/design-system/collapsible`, preserve initial expansion and independent row expansion, keep form drafts mounted, and use `onOpenChange` for lazy preview resources. Do not recreate disclosure behavior with ad hoc buttons and hidden panels.
- Put each feature in a named folder with `index.tsx` as its public entry, `components/` for sections, `hooks/` for state/effects, and `__tests__/` for colocated tests. Use `types.ts`, `helpers.ts`, `constants.ts` and `api.ts` when the feature needs them; do not create empty placeholders.
- Keep components focused on rendering. Put pure transformations in helpers, network operations in API modules, and reusable stateful behavior in hooks. Name handlers as actions; reserve `use` prefixes for hooks.
- Share repeated domain labels, formatting and status calculations under `packages/ui/src/lib/`. Keep reusable shadcn primitives in `packages/design-system/src/components/` with explicit per-family package exports; app-specific AI Elements compositions stay under `packages/ui/src/components/ai-elements/`. The design system must not depend on app state, routes, daemon or domain models. Both app and landing import `@pitchcrew/design-system/styles.css` for Tailwind, shared tokens, primitive materials and source scanning; each owns its feature styles and font loading. See [packages/design-system/README.md](packages/design-system/README.md).
- Backend entry points preserve their public contracts and compose private modules by domain: `board/`, orchestrator `crew/` and `http/`, adapter `process/`, MCP `tools/`, connector `auth/` and computer modules. Keep transactions and approval checks together.
- Use ordinary Tailwind utilities for routine feature layout and spacing. App and landing base layers default borders (including pseudo-elements) to the theme hairline; shared border recipes must still specify a border color, and meaningful warning/error colors and keyboard focus stay explicit.
- Keep app-specific materials and complex selectors in ordered feature files under `packages/ui/src/styles/`; reusable primitive materials and shared motion live in `packages/design-system/src/styles/`.
- Never style descendants through a `:has()` on an ancestor (Tailwind `group-has-*`, `:root:has(…) …`, `.a:has(…) .b`) or test emptiness inside `:has()` (`:has(…:empty)`, `:not(:has(> *))`): Chrome rechecks such rules after DOM changes anywhere on the page, which once made every chat update restyle 350–850 elements. A `:has()` that styles the element it is on (`has-*` utilities) is fine.
- Use `:empty` or sibling selectors, or a rendered attribute: `createPresence` (`design-system/src/lib/presence.ts`) sets `data-has-<slot>` on a group's root (menu item action, code block header, an inset sidebar on its wrapper; in chat, `ChatView/presence.ts` marks the workspace's side panel and docked browser and the panel's question dock, welcome and hidden composer; apps import it from `@pitchcrew/design-system/presence`), `useRootFlag` (`lib/use-root-flag.ts`) sets page-wide flags on the document element (`data-app-bar`, `data-browser-expanded`), and `TabsList` sets `data-indicator` when it holds a `TabsIndicator`.
- Shared UI and AI Elements defaults use the `primitive:` variant: `styles.css` orders `base`, `primitives` and `components` below ordinary, unlayered caller utilities. Keep the utility import unlayered so the variant emits into the top-level `primitives` layer. Feature files load in the `components` layer, so they lose to unlayered third-party styles whatever their specificity: overrides of CodeMirror theme rules and Streamdown utilities must use `!important`.
- Theme tokens and named responsive thresholds live in `packages/design-system/src/styles/theme.css`; remaining feature CSS uses those thresholds through `@variant`. Oxfmt sorts classes, including `cn` and CVA arguments. See [docs/code-organization.md](docs/code-organization.md).

## Commands

```sh
bun install
bun run dev          # daemon + hot-reloading UI at http://127.0.0.1:4417
bun run landing:dev  # public Next.js landing page at http://127.0.0.1:3000
bun run landing:build # production landing page build, separate from desktop packaging
bun run landing:start # serve the built landing page locally
bun run desktop      # build Electron main process; reuse a daemon, start the installed service or launch a development daemon
bun run build        # UI and Electron main bundles
bun run icon:build   # regenerate Electron's PNG from the canonical favicon SVG
bun run start        # daemon serving built UI
bun run service install # per-user login service for the production daemon; also uninstall, status, start, stop, logs
bun run mcp enable --write # opt in to external desktop-agent reads and writes; omit --write for reads
bun run mcp config # print stdio MCP client configuration; disable revokes all connections
bun run desktop:prod # build and launch Electron with built UI
bun run desktop:package # build standalone installers for the current platform and architecture
bun run test:packaged # verify the unpacked app with its bundled runtime and isolated data
bun run test:installer # Windows: verify compiled NSIS process handling with isolated fixtures after packaging
bun run browser:install # install Chromium for browser tools and tests
bun --no-env-file scripts/convert-legacy-tracker.ts <tracker.db> [applications.json] # legacy SQLite tracker to import JSON
bun run test         # Node Vitest: fixtures, loopback HTTP, MCP and isolated Chromium; no provider calls
bun x --no-install vitest run <path> # one test file; add --project unit-and-api or --project ui to pick a project
bun run test:bun     # actual Bun daemon, MCP and bounded Node-helper integration
bun run test:e2e     # built UI, real Bun daemon, Electron guests and scoped MCP browser journeys
bun run test:desktop # E2E journeys, hidden Electron smoke and native-browser integration checks
bun --no-env-file --no-install packages/orchestrator/test/runtime-live.smoke.ts --live # manual real Codex/Claude check; spends four provider turns
bun run lint         # Oxlint; warnings fail
bun run format       # Oxfmt
bun run format:check
bun run typecheck
bun run docs:state-machines # regenerate docs/state-machines.md from the lifecycle tables
bun run check        # lint, format check, typecheck, tests, app build and landing page build
```

The UI has hot reload; restart the daemon after backend changes. The default data directory is ~/.pitchcrew, optionally PITCHCREW_HOME outside the repository. PITCHCREW_PORT defaults to 4417. Tests use temporary directories outside the repository and fictional fixtures under packages/*/test/fixtures/.

Local desktop and packaged smoke checks must stay hidden and never take focus. They use a hidden, non-focusable Electron window, background macOS activation and `capturePage` with `stayHidden`; evidence asserts the window was never shown or focused. Use `PITCHCREW_SMOKE_VISIBLE=1` only when the user explicitly requests a visible debugging run. Startup failures in hidden smoke mode go to stderr and exit with failure instead of opening a native dialog. Ordinary `bun run test` Chromium checks remain headless. Desktop smoke checks record native quit phases separately from parent-observed process exit and fail after a 10-second shutdown deadline; forced cleanup applies only to failed test children and never counts as success. See [docs/desktop-shutdown-performance.md](docs/desktop-shutdown-performance.md) for the isolated native exit diagnosis.

Vitest defaults to two workers, matching each CI shard, to keep browser and bounded-worker fixtures within host resources; `--maxWorkers` can override it. `expect.poll` waits up to 5 seconds, since fixtures that boot, reload or reopen a page share the host. Start slow fixtures in `beforeAll` rather than inside a test's 15-second budget: production daemons, first visits to Vite fixture pages and the first import of a route's page module.

Test daemons from `packages/orchestrator/test/helpers/daemon.ts` listen on OS-assigned ports (`setup()` returns `port`; `reservePort()` holds one for direct `createDaemon` calls), so parallel files never share a fixed port; never hard-code a listening port. `setup()` also replaces every non-Demo adapter's `detect`/`listModels` with an unavailable fixture (`isolateRuntimes()`, undone by `cleanup()`/`restoreRuntimes()`), so no test runs an installed provider CLI; adapters a test already mocked keep that mock, and `nativeRuntimes` names runtimes a test deliberately detects from fixture executables.

Vitest builds the production UI once when UI test files are selected. Full-app browser suites serve that build through the shared UI test fixture; backend fixtures serve APIs only, preserving the same Host, Origin and session checks. Development UI serving remains covered by dedicated Vite tests. The Vitest-only Demo fixture removes presentation delays while retaining asynchronous streaming and aborts; tests requiring in-flight work use explicit deferred gates. Ordinary development Demo timing is unchanged.

## Invariants

These must stay true. A change that breaks one is a bug even if tests pass.

1. **No outward action without approval.** Anything that sends, submits, posts or emails must go through a gated MCP tool checking an unused approval bound to the exact payload. The check belongs in MCP, not in prompts or UI. Browser interactions use an exact-action gate bound to run, role, card, page fingerprint and upload contents. User-approved task site browsing grants can authorize bounded HTTPS read navigation, hover and scroll, while separate preparation grants authorize only the bounded preparation rules described above; submission, buttons, keys, dialogs and unfamiliar controls always require an exact user decision. Website-controlled scripts remain outside payload verification. Local export also uses its gate. Configured anonymous app analytics follows the device opt-out preference described above; it never carries application content or grants agents an outward-action bypass.
2. **Provider code stays in packages/adapters/.** The orchestrator, board and UI see only the runtime interface and normalized results/progress.
3. **Agents coordinate through the board only.** Internal messages and invocations are persisted board entities with scoped MCP tools; no adapter-to-adapter messaging and no shared runtime sessions across roles.
4. **Events are append-only and stay decodable.** Never rewrite or delete stored events. Schema changes add a new version and retain a decoder for every old version.
5. **Health checks have no side effects.** detect() never signs in, creates a session or spends tokens.
6. **Runtime credentials stay private and user-controlled.** User settings can save allowlisted runtime secrets in the private credentials file; secret reads expose only source/configured status. Native account credentials remain with their CLI except the explicit managed Grok auth home and bounded private transport. Credentials, temporary auth interactions and secret backups never enter board events, snapshots, prompts, job run folders or agent tools. Adapters apply the selected runtime connection without broadening tool permissions.
7. **The daemon binds to 127.0.0.1 only.** Keep origin/Host checks and user-session/run-capability boundaries intact.
8. **User data never enters the repo.** Profile notes, packets and DB live outside it. Tests use fictional fixtures and checked temporary cleanup paths.
9. **Rules change only with user approval.** Agents propose their own instruction/capability changes, or capability-gated targeted crew changes tied to saved reviews, in chat and never apply them directly. Only user settings (including adopting a reviewed default instruction update) or an explicit user decision on a proposal updates roles; skills are added or changed only through startup defaults, user settings or user-approved skill proposals; packet rules change only through user Settings actions, and agents can only read them.

## Card states

The normal workflow transition graph is packages/core/src/states.ts, kept free of zod so the UI can import it from @pitchcrew/core/states (Oxlint allows only type imports of @pitchcrew/core in the UI).

Typical flow:

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

Scout evaluates an existing lead; the user shortlists it. Writer drafts, Reviewer agrees or requests changes. Packet approval authorizes local export; choosing a submission method exports the files. The user submits independently or explicitly starts agent preparation, approves the exact browser submission, then verifies confirmation and records the outcome. Keep active-run ownership, revised-packet approvals, cancellation and interrupted-run recovery covered when modifying this flow.

An uncertain submission can continue through a separately approved browser dialog only when `submissionAttemptId` binds the same run, card, current exported packet and observed dialog. The consumed continuation approval is saved on the attempt. No click, keypress or navigation retry is allowed.

## Topic docs

Read the matching file before changing the area; it holds the contributor rules for that feature.

### Workflow and board

| Before changing…                                                                                | Read                                                     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Board layout, drag, Move to… and the Needs you deck                                             | [docs/board.md](docs/board.md)                           |
| Board card menus, drag and status changes                                                       | [docs/board-card-actions.md](docs/board-card-actions.md) |
| Decisions, packet approval and history                                                          | [docs/inbox-redesign.md](docs/inbox-redesign.md)         |
| Job details sheet                                                                               | [docs/job-details.md](docs/job-details.md)               |
| Queue and workspace slots                                                                       | [docs/board-action-queue.md](docs/board-action-queue.md) |
| Roles, card states, workflow transitions and the execution budget                               | [docs/roles.md](docs/roles.md)                           |
| Job discovery, saved sources and Fetch from link                                                | [docs/job-discovery.md](docs/job-discovery.md)           |
| Application tracking and Gmail reconciliation                                                   | [docs/tracking.md](docs/tracking.md)                     |
| Learning signals and Insights                                                                   | [docs/insights.md](docs/insights.md)                     |
| Pipeline reviews and crew change proposals                                                      | [docs/pipeline-reviews.md](docs/pipeline-reviews.md)     |
| Routines and scheduled actions                                                                  | [docs/routines.md](docs/routines.md)                     |
| Background service                                                                              | [docs/background-service.md](docs/background-service.md) |
| Deep resume reviews                                                                             | [docs/deep-resume-review.md](docs/deep-resume-review.md) |
| Delegation rounds                                                                               | [docs/delegation-rounds.md](docs/delegation-rounds.md)   |
| Event log versions and decoding                                                                 | [docs/event-log.md](docs/event-log.md)                   |
| Persisted statuses, lifecycle tables and allowed moves                                          | [docs/lifecycles.md](docs/lifecycles.md)                 |
| Generated state-machine diagrams (generated by bun run docs:state-machines; never edit by hand) | [docs/state-machines.md](docs/state-machines.md)         |

### Chat

| Before changing…                                               | Read                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Chat sends, receipts, reconnection and uncertain drafts        | [docs/orchestrator-comparison.md](docs/orchestrator-comparison.md) |
| Conversations, groups, queued messages, files and agent memory | [docs/chat-redesign.md](docs/chat-redesign.md)                     |
| Chat references: @, $ and /                                    | [docs/chat-references.md](docs/chat-references.md)                 |
| Chat turn activity, questions and the composer                 | [docs/chat-turn-activity.md](docs/chat-turn-activity.md)           |
| Notifications, toasts and sounds                               | [docs/notifications.md](docs/notifications.md)                     |

### Browser and computer use

| Before changing…                                           | Read                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Browser tools, native guests, approvals and manual control | [docs/computer-use.md](docs/computer-use.md)                                       |
| Browser journeys end to end                                | [docs/browser-e2e.md](docs/browser-e2e.md)                                         |
| Browser panel responsiveness                               | [docs/browser-interaction-performance.md](docs/browser-interaction-performance.md) |
| Browser benchmark                                          | [docs/browser-benchmark.md](docs/browser-benchmark.md)                             |
| Browser review notes                                       | [docs/browser-t3code-review.md](docs/browser-t3code-review.md)                     |
| Native desktop browser decision                            | [docs/adr/0003-native-desktop-browser.md](docs/adr/0003-native-desktop-browser.md) |

### Runtimes and models

| Before changing…                               | Read                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Runtime adapters, launches and compatibility   | [docs/runtimes.md](docs/runtimes.md)                             |
| Runtime installation, sign-in and models setup | [docs/runtime-setup.md](docs/runtime-setup.md)                   |
| Runtime authentication and credentials         | [docs/runtime-authentication.md](docs/runtime-authentication.md) |
| Runtime health checks                          | [docs/runtime-checks.md](docs/runtime-checks.md)                 |
| Model discovery                                | [docs/model-discovery.md](docs/model-discovery.md)               |

### Skills, connectors and external access

| Before changing…                   | Read                                             |
| ---------------------------------- | ------------------------------------------------ |
| Skills, imports and starter skills | [docs/skills.md](docs/skills.md)                 |
| Bundled career skills              | [docs/hunter-skills.md](docs/hunter-skills.md)   |
| Agent and skill updates            | [docs/agent-updates.md](docs/agent-updates.md)   |
| Connectors (GitHub, Google)        | [docs/connectors.md](docs/connectors.md)         |
| External and remote agent access   | [docs/external-mcp.md](docs/external-mcp.md)     |
| Career Coach and career support    | [docs/career-support.md](docs/career-support.md) |

### Profile and packets

| Before changing…                                   | Read                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Profile workspace, notes and the editor            | [docs/profile.md](docs/profile.md)                                         |
| Profile sources dialog and imports                 | [docs/profile-sources-dialog.md](docs/profile-sources-dialog.md)           |
| Profile maintenance proposals                      | [docs/profile-maintenance.md](docs/profile-maintenance.md)                 |
| Packet files, rendering and export                 | [docs/packet-exports.md](docs/packet-exports.md)                           |
| Packet rules                                       | [docs/packet-rules.md](docs/packet-rules.md)                               |
| Application source safety and context confirmation | [docs/application-source-safety.md](docs/application-source-safety.md)     |
| Application writing quality and AI-text detectors  | [docs/application-writing-quality.md](docs/application-writing-quality.md) |
| Application process quality and career plans       | [docs/application-process-quality.md](docs/application-process-quality.md) |

### UI and desktop

| Before changing…                                      | Read                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Design language and clay materials                    | [docs/design-language.md](docs/design-language.md)                           |
| UI architecture, routing, app bar and chat components | [docs/ui-architecture.md](docs/ui-architecture.md)                           |
| Workspace snapshots and synchronization               | [docs/workspace-synchronization.md](docs/workspace-synchronization.md)       |
| Settings pages                                        | [docs/settings-redesign.md](docs/settings-redesign.md)                       |
| Context menus                                         | [docs/context-menus.md](docs/context-menus.md)                               |
| Onboarding and setup checklist                        | [docs/onboarding.md](docs/onboarding.md)                                     |
| Electron desktop shell                                | [docs/desktop-shell.md](docs/desktop-shell.md)                               |
| Desktop shutdown performance                          | [docs/desktop-shutdown-performance.md](docs/desktop-shutdown-performance.md) |
| Public landing page                                   | [docs/landing-page.md](docs/landing-page.md)                                 |

### Tooling, release and analytics

| Before changing…          | Read                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| Current feature inventory | [docs/status.md](docs/status.md)                                     |
| Code organization         | [docs/code-organization.md](docs/code-organization.md)               |
| Tests and fixtures        | [docs/testing.md](docs/testing.md)                                   |
| CI and desktop packaging  | [docs/ci-and-packaging.md](docs/ci-and-packaging.md)                 |
| App updates               | [docs/app-updates.md](docs/app-updates.md)                           |
| Usage analytics           | [docs/analytics.md](docs/analytics.md)                               |
| Error tracking reports    | [docs/analytics/error-tracking.md](docs/analytics/error-tracking.md) |
| Operational logs          | [docs/analytics/logs.md](docs/analytics/logs.md)                     |

These files carry the same authority as this one.
