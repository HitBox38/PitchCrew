# Pitchcrew

A local-first job-search workbench with a crew of role agents. Each role can use Demo, Claude Code, or Codex. The same shadcn-based React interface runs in a browser and a sandboxed Electron window.

**Status: working MVP.** Add opportunities, evaluate fit, draft and review packets, approve local exports, track your applications, and chat with each role or follow the crew conversation. See [AGENTS.md](AGENTS.md) for architectural invariants and [docs/mvp-design.md](docs/mvp-design.md) for design decisions.

## Run

Requires Node **22.18+ or 24.11+** (supported LTS lines) and **pnpm 11**. Windows is the verified development platform. Native SQLite and Electron dependencies may need build tooling if a prebuilt binary is unavailable.

```sh
pnpm install
pnpm dev
```

Open **http://127.0.0.1:4417**. Use the printed loopback address, including the port. The UI has hot reload; restart `pnpm dev` after daemon or adapter changes.

Open the desktop view with:

```sh
pnpm desktop
```

The desktop launcher reuses an existing daemon on the configured port, or starts one and stops it when the desktop app closes. Both views share the daemon's workspace.

For the built UI:

```sh
pnpm build
pnpm start
# Or launch the built UI in Electron:
pnpm desktop:prod
```

## Try the workflow

1. Choose **Try an example board** on the empty board for six fictional opportunities and a fictional profile, or add your own Markdown notes under **Your profile**. Demo drafting expects a name heading and factual bullet points.
2. Add an opportunity with its job description. Run **Evaluate fit**, then **Shortlist**.
3. Run **Draft application**, then **Review packet**. Inspect the resume, letter, form answers, note, source evidence, and history in the opportunity sheet.
4. Request export approval. In **Approval inbox**, inspect the exact packet, approve it, then export it. The export directory appears in decision history.
5. Apply yourself, then record the manual submission and track screening, interviews, and outcomes.

**Demo makes no AI calls.** Its fit scores are keyword examples and its drafts reuse profile bullets; they need personalization before use. Loading examples is explicit and refuses to overwrite an existing profile.

In **Your crew**, select a runtime, optional model, instructions, agent capabilities, and whether a role is enabled. Claude Code and Codex must already be installed on PATH and signed in using their own CLIs. Detection runs only `--version`; chat turns and workflow runs may use your provider account, including agent-requested follow-ups. Real provider executions have not been exercised during this MVP's verification.

## Connect GitHub and Google Workspace

In **Your crew → Connected accounts**, connect GitHub with a fine-grained token or Google Workspace with Desktop OAuth browser sign-in. Then enable GitHub, Gmail, Drive/Docs, Calendar or Sheets in each role’s settings. Access defaults to disabled. Agents can use these read-only MCP tools for company research, portfolio evidence, recruiter email and interview preparation in both chat and card workflows. Sending mail, editing files and posting still require future approval-gated tools. See [connector setup and available tools](docs/connectors.md).

## Chat with your crew

Open **Chat** or click a role in the sidebar. Talk privately with Scout, Writer or Reviewer, or join the **Crew conversation** to see agent messages and handoffs. Attach a job to give a turn application context. AI Elements provides the conversation, Markdown messages and composer in Pitchcrew’s visual style.

Claude Code and Codex can use board-backed tools to message another agent, invoke themselves or another role, shortlist the attached lead, request packet changes, and queue drafting/review runs. Every exchange and task is visible in chat. Follow-ups wait for the current turn to finish and are limited to six per user-started chain; **Stop** cancels that chain. Paused roles and disabled capabilities are enforced by the daemon. Demo chat is scripted and does not reason or call tools.

Agents can propose changes to their own instructions or capabilities. Inspect the proposed values in chat and choose **Apply changes** or **Decline**. Applying waits for that role’s active runs to finish. Agents cannot apply these changes themselves, approve exports, or record submissions.

## Your data

By default, everything is stored outside the repository:

```text
~/.pitchcrew/
  pitchcrew.db                    # SQLite projections and append-only event log
  connectors/credentials.json    # local GitHub/Google connector credentials
  profile/*.md                   # factual source notes
  roles/<role>/AGENTS.md          # instructions managed in Crew settings
  roles/<role>/CLAUDE.md          # imports AGENTS.md
  roles/<role>/runs/<run-id>/     # isolated runtime working folders
  packets/<card-id>/try-*/        # immutable Markdown packet versions and claims.json
```

Runtime MCP configuration is passed per run. Pitchcrew does not read or store provider credentials. To keep a demo separate, use PowerShell before starting the daemon:

```powershell
$env:PITCHCREW_HOME = "$env:USERPROFILE\.pitchcrew-demo"
$env:PITCHCREW_PORT = '4418'
pnpm dev
```

`PITCHCREW_HOME` must be outside this repository. Edit role instructions through Crew settings; the daemon regenerates instruction files from stored settings on startup. Profile files can also be edited directly while no roles are running.

## Architecture

| Package        | Responsibility                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `core`         | Strict TypeScript contracts, Zod validation, card transitions, connector capabilities                               |
| `board`        | SQLite event log, projections, exact-payload approval tokens                                                        |
| `orchestrator` | Loopback daemon, chat/workflow launches, bounded crew tasks, scoped capabilities                                    |
| `adapters`     | Demo and headless Claude Code/Codex process integrations                                                            |
| `mcp`          | Official SDK stdio server, card/profile/chat/workflow tools, proposals, read-only connectors, approval-gated export |
| `packet`       | Source-quote and word-cap checks, versioned Markdown files                                                          |
| `ui`           | React, shadcn/ui, AI Elements, Tailwind, locally bundled fonts, Vite                                                |
| `desktop`      | Sandboxed Electron host for the shared renderer                                                                     |

Agent application tools are scoped to the attached card; conversation reads are scoped to the role’s own chat and the shared crew chat. Messages, proposals and follow-up tasks are persisted in the board. Agents cannot approve actions, apply their own role changes, or use another role's runtime session. Approval binds the exact packet and is consumed once in the MCP export gate. A revised packet requires a fresh approval. The daemon recovers interrupted runs, releases their card claims, and marks interrupted queued tasks failed after restart.

The UI polls the daemon every two seconds. HTTP APIs use a local session, application header, origin checks, and host checks. Production assets use a content security policy. Electron disables Node integration, isolates the renderer, and denies permissions and external navigation.

## Tooling and verification

**Oxlint** replaces ESLint, and **Oxfmt** handles formatting. Vite 8 / its React plugin use Oxc transforms and Rolldown; **tsdown** builds the Electron main process with Rolldown. TypeScript remains the type checker.

```sh
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm check          # lint, typecheck, tests, build
pnpm test:desktop   # built UI + isolated Electron renderer/daemon smoke test
```

Tests use fictional fixtures and temporary workspaces. They cover transitions, append-only history and projection replay, stale/reused approvals, evidence checks, concurrent claims, cancellation, HTTP boundaries, mock CLI parsing, and the real MCP stdio connection. They make no paid provider calls. The desktop test sends a demo chat through the production renderer and saves a screenshot and JSON evidence in a temporary directory.

## MVP boundaries

Discovery is manual. Roles launch from user chat/workflow actions and bounded crew follow-ups. Exports are local Markdown files: there is no email sender, application submitter, PDF/one-page builder, schedule engine, custom-role creation, or automatic coaching. OpenCode and other runtimes are future adapters. Desktop installers and auto-updates are also deferred.

Packet lint checks registered claims against exact source quotes and enforces word caps. It cannot prove every free-form sentence is factual; the independent reviewer and the user still need to inspect the complete packet.
