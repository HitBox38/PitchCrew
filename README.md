# Pitchcrew

A local-first job-search workbench with a crew of role agents. Each role can use Demo, Claude Code, Codex, Gemini CLI, OpenCode, GitHub Copilot CLI, Cursor Agent, Goose, or Kiro CLI. The same shadcn-based React interface runs in a browser and a sandboxed Electron window.

**Status: working MVP.** Add opportunities, evaluate fit, draft and review packets, approve local exports, and track your applications. See [AGENTS.md](AGENTS.md) for architectural invariants and [docs/mvp-design.md](docs/mvp-design.md) for design decisions.

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

In **Your crew**, select a runtime, optional model, instructions, and whether a role is enabled. Real runtimes must already be installed on PATH with their native authentication configured. Detection runs only `--version`; starting a real role is an explicit action and may use your provider account. Real provider executions have not been exercised during automated verification.

| Runtime                                                                                                        | Executable     | Model setting                                    |
| -------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------ |
| Claude Code                                                                                                    | `claude`       | CLI model name, or empty for its default         |
| Codex                                                                                                          | `codex`        | CLI model name, or empty for its default         |
| [Gemini CLI](https://geminicli.com/docs/cli/headless/)                                                         | `gemini`       | CLI model name, or empty for its default         |
| [OpenCode](https://opencode.ai/docs/cli/)                                                                      | `opencode`     | `provider/model`, or empty for its default       |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) | `copilot`      | CLI model name, or empty for its default         |
| [Cursor Agent](https://cursor.com/docs/cli/reference/parameters)                                               | `cursor-agent` | CLI model name, or empty for its default         |
| [Goose](https://block.github.io/goose/docs/guides/goose-cli-commands/)                                         | `goose`        | `provider/model`, or native environment defaults |
| [Kiro CLI](https://kiro.dev/docs/cli/acp/)                                                                     | `kiro-cli`     | CLI model name, or empty for its default         |

Gemini CLI uses per-run system settings to disable built-in tools, extensions, skills and hooks, and allow only Pitchcrew MCP. OpenCode uses an isolated configuration directory, a fresh session, `--pure` to disable external plugins, and permissions that deny every tool except `pitchcrew_*`. Automatic session sharing is disabled. OpenCode's user configuration (including custom provider definitions) is not loaded; built-in providers use the CLI's existing sign-in or environment configuration. These adapters target Gemini CLI 0.62 and OpenCode 1.18; older versions may need an upgrade. Neither adapter reads or copies provider credentials.

GitHub Copilot CLI receives an isolated `COPILOT_HOME`, only `pitchcrew/*` tools available, built-in MCP disabled, hooks disabled in run settings, and session export disabled. Its native keychain or native authentication environment must supply sign-in; fallback tokens stored in the user's Copilot configuration file are not imported. This adapter targets Copilot CLI 1.0.91.

Cursor Agent receives isolated CLI settings and project MCP configuration, an explicit permission allowlist for `Mcp(pitchcrew:*)`, and denials for shell, file reads/writes and web fetching. It runs without `--force` or automatic tool review. MCP server approval permits connection; it does not bypass tool permissions. Cursor Agent 2026.09.26 or newer is required: older builds do not isolate global MCP discovery, so they appear unavailable with upgrade instructions. Native credential/data locations remain unchanged. Runtime-managed enterprise policies and account extensions remain subject to the runtime's behavior.

Goose uses an isolated `GOOSE_PATH_ROOT` and an explicit recipe containing only Pitchcrew MCP, with no saved session. Its user configuration, plugins and hooks are not imported. Set the model to `provider/model` using `openai`, `anthropic`, `google`, `ollama` or `openrouter`; alternatively, set `GOOSE_PROVIDER` and `GOOSE_MODEL` in the daemon environment. Providers that launch another agent CLI are excluded because they can expose tools outside this recipe. Native keyring/environment authentication stays with Goose; file-based credentials in the user configuration are not imported. This adapter targets Goose 1.44.0.

Kiro CLI runs one fresh ACP session using the V2 engine and an isolated `KIRO_HOME`. The generated custom agent exposes and trusts only `@pitchcrew/*`, disables external MCP discovery and powers, and has no resources or hooks. Pitchcrew declines ACP permission requests and provides no filesystem or terminal client capabilities. Configure native headless authentication using `KIRO_API_KEY` in the daemon environment; existing login files are not imported. This adapter targets Kiro CLI 2.26.1. See [Kiro headless authentication](https://kiro.dev/docs/cli/headless/).

These integrations have subprocess contract coverage; live provider runs have not been verified.

## Your data

By default, everything is stored outside the repository:

```text
~/.pitchcrew/
  pitchcrew.db                    # SQLite projections and append-only event log
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

| Package        | Responsibility                                                                    |
| -------------- | --------------------------------------------------------------------------------- |
| `core`         | Strict TypeScript contracts, Zod validation, card transitions                     |
| `board`        | SQLite event log, projections, exact-payload approval tokens                      |
| `orchestrator` | Loopback daemon, explicit role launches, cancellation, scoped run capabilities    |
| `adapters`     | Demo and native CLI/ACP runtime integrations                                      |
| `mcp`          | Official SDK stdio server, card/profile/history/lint tools, approval-gated export |
| `packet`       | Source-quote and word-cap checks, versioned Markdown files                        |
| `ui`           | React, shadcn/ui, Tailwind, locally bundled fonts, Vite                           |
| `desktop`      | Sandboxed Electron host for the shared renderer                                   |

Agent tools are scoped to the assigned card. Agents cannot approve actions, modify roles, or use another role's runtime session. Approval binds the exact packet and is consumed once in the MCP export gate. A revised packet requires a fresh approval. The daemon recovers interrupted runs and releases their card claims after restart.

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

Tests use fictional fixtures and temporary workspaces. They cover transitions, append-only history and projection replay, stale/reused approvals, evidence checks, concurrent claims, cancellation, HTTP boundaries, mock CLI parsing, and the real MCP stdio connection. They make no paid provider calls. The desktop test saves a screenshot and JSON evidence in a temporary directory.

## MVP boundaries

Discovery is manual and roles launch on demand. Exports are local Markdown files: there is no email sender, application submitter, PDF/one-page builder, schedule engine, custom-role creation, or automatic coaching. Desktop installers, auto-updates and further runtimes are deferred.

Packet lint checks registered claims against exact source quotes and enforces word caps. It cannot prove every free-form sentence is factual; the independent reviewer and the user still need to inspect the complete packet.
