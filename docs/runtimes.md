# Runtime setup

Pitchcrew starts an installed agent CLI for each chat or workflow run. Install the runtime on `PATH`, configure its native authentication, then select it in Crew settings. **Settings > Runtimes** shows installation/compatibility, authentication, and update status separately.

After installing a runtime while Pitchcrew is open, select **Check runtimes**. Checks, model discovery and agent runs also search `~/.local/bin`, `~/.grok/bin` and `~/.opencode/bin` after the inherited `PATH`, so native installations in those folders work without restarting the app. Installations in other newly added `PATH` folders require restarting the daemon or background service with the updated environment.

Pitchcrew never reads, copies or stores provider credentials. Authentication remains with the CLI, including supported environment variables inherited from the daemon. Isolated runtime configuration can exclude existing login or configuration files; see the notes below before assuming that an interactive CLI login will also work in Pitchcrew.

These integrations have subprocess contract coverage. Live provider executions are not part of automated verification.

Before launch, independent assigned-skill and instruction-file writes run concurrently and all settle before setup finishes, including on failure. Queue dispatch checks lane and workspace capacity before reading Profile prerequisites, then rechecks admission after asynchronous validation. Authentication and final state/permission checks still gate every launch.

## Executables and models

| Runtime            | Executable     | Model setting                                    |
| ------------------ | -------------- | ------------------------------------------------ |
| Claude Code        | `claude`       | CLI model name, or empty for its default         |
| Codex              | `codex`        | CLI model name, or empty for its default         |
| Gemini CLI         | `gemini`       | CLI model name, or empty for its default         |
| OpenCode           | `opencode`     | `provider/model`, or empty for its default       |
| GitHub Copilot CLI | `copilot`      | CLI model name, or empty for its default         |
| Cursor Agent       | `cursor-agent` | CLI model name, or empty for its default         |
| Goose              | `goose`        | `provider/model`, or native environment defaults |
| Kiro CLI           | `kiro-cli`     | CLI model name, or empty for its default         |
| Grok Build         | `grok`         | CLI model name, or empty for its default         |
| Pi                 | `pi`           | `provider/model`, or empty for its default       |
| oh-my-pi           | `omp`          | `provider/model`, or empty for its default       |
| Hermes Agent       | `hermes`       | `provider:model`, or native environment defaults |

Crew settings provide a searchable model picker. Native catalogs are loaded where supported and cached for five minutes; **Refresh models** forces a new check. Curated suggestions are labeled separately. Changing runtimes resets the model to the CLI default. Saved model names remain visible even when absent from the current catalog.

Installation checks read the CLI version. Authentication probes use native status/account metadata where available, without a model request. A reliably missing sign-in or required environment variable holds new work; an inconclusive check is labelled unverified and permits an attempt. Checks use Pitchcrew’s actual isolated authentication settings. A present API key is configured, not verified account access. Model discovery does not start an inference turn, and a listed model does not guarantee that your account can use it. See [model discovery](model-discovery.md) for commands, fallbacks and limits.

## Authentication checks and runtime updates

Authentication results are shared by runtime/model and effective authentication environment for five minutes. Startup, **Recheck**, post-update verification and stale preflight checks refresh them. Retrying after fixing sign-in forces a fresh check. Native setup instructions and copyable commands stay in Settings; sign-in flows remain owned by the CLI. Claude and Cursor have native status probes; Codex uses account metadata without creating a thread. Kiro and Grok require their documented daemon-environment keys. Pi, OMP and Hermes check missing keys for explicitly selected supported providers. Other inconclusive or unsupported probes report unknown. Provider credential files and secret values never enter maintenance state.

Installed runtimes check stable-release availability when the app opens and daily while open. **Check runtime updates automatically** is a separate default-on workspace preference; **Check runtimes** refreshes immediately. **Update** is always a user action. The daemon shares checks and update progress across browser tabs and Electron. Notifications quietly link to the exact runtime, including while an update runs and after its outcome.

Updates preserve the installation method and use the latest stable version from that distribution. Verified npm installations use their original prefix; verified Homebrew formulae/casks use Homebrew and its own stable release metadata. Deliberate pins and ambiguous installations stay manual. Known native Claude, Codex, OpenCode, Grok and Cursor layouts can use their native updaters. Other installer layouts show manual instructions. No elevation or interactive password collection is offered. A failed or unsupported check never claims a runtime is current.

The current release-source/installer coverage is:

- Claude, Codex, Gemini, OpenCode, Copilot, Grok, Pi and OMP: their exact official npm package, or the verified owning Homebrew distribution where configured. Proven native layouts use the same version train.
- Cursor Agent: its official installer’s published CLI version, with a native updater only for its recognized per-user layout. The installer script is read as bounded metadata and never executed by Pitchcrew.
- Goose and Hermes: their public stable GitHub release; Goose can update through a verified Homebrew install. Hermes source/native installs remain manual because its native updater follows a branch and can prompt for configuration.
- Kiro: verified Homebrew metadata/installations; other layouts retain setup/manual guidance when a stable update source cannot be verified.

Update is disabled while a runtime is in use. Active deep reviews reserve Writer, Reviewer and alternative runtimes between stages; waiting for user input releases them after all CLI work stops. Queued work alone is idle. New work waits while updating/verifying; other runtimes continue. Progress shows preparing, updating and verifying, with expandable bounded, redacted installer output. Navigate away and return through the notification without cancelling the operation.

An installer finishing successfully is insufficient: Pitchcrew verifies the active CLI’s compatible installed version reached the advertised target. Authentication remains a separate result. Failures recheck the installed runtime and resume eligible work if the old version remains usable. Otherwise work waits with repair instructions. There is no automatic downgrade, reinstall or replay of an interrupted updater. An installer worker holds a shared per-user SQLite OS lock until its subprocess stops; daemon disconnect cancels that owned subprocess. Restart recovery waits for a surviving worker and rechecks the installation before releasing work.

Quitting a desktop that owns its daemon waits for an in-progress update and offers **Cancel quitting**. Service-owned daemons continue after the desktop closes. Pitchcrew’s own install-and-restart also waits before stopping its daemon/service. Forced shutdowns are recovered as interrupted maintenance. Source and packaged launchers retain their existing ownership rules.

`runtime-maintenance.json` stores preferences, release/check metadata and bounded operation outcomes outside board events. Account tokens and credential files are excluded. Local authentication probes have a 15-second deadline, public metadata reads have a 10-second deadline and 256 KB bound, and installers have a ten-minute deadline. Daily release failures retain known notices and successful-check times. `PITCHCREW_RUNTIME_UPDATE_CHECKS=0` disables public runtime release checks and in-app updates; the general `PITCHCREW_UPDATE_CHECKS=0` switch also disables them. Direct `createDaemon()` construction keeps account/release probes off unless explicitly enabled, so fixtures stay isolated.

## Runtime-specific notes

### Claude Code and Codex

Configure the CLI's native authentication before launching runs. Select a model or leave the setting empty for its default. Provider-specific launch configuration lives in [the adapters package](../packages/adapters/src).

Codex turns, including resumed conversations, require the scoped Pitchcrew MCP server to initialize before execution. A server startup failure fails the run instead of allowing a reply without Pitchcrew tools. The adapter approves native calls only for that server (`mcp_servers.pitchcrew.default_tools_approval_mode="approve"`), so local job deletion does not hit an unanswerable CLI approval prompt. Pitchcrew still checks current role capabilities on every call and enforces its own packet export, browser interaction and settings proposal approvals. The read-only sandbox and disabled native shell tools remain in place.

Source extraction exposes no callable MCP tools. Its scoped server answers `tools/list` with an empty list so required-server discovery succeeds without granting access to profile, crew, browser or workflow actions.

### Gemini CLI and OpenCode

The adapters target Gemini CLI 0.62 and OpenCode 1.18; older versions may need an upgrade.

Gemini CLI receives per-run system settings that disable built-in tools, extensions, skills and hooks, allowing only Pitchcrew MCP.

OpenCode receives an isolated configuration directory, a fresh session and `--pure` to disable external plugins. Permissions deny tools except `pitchcrew_*`, and automatic session sharing is disabled. User configuration, including custom provider definitions, is not loaded. Built-in providers use the CLI's existing sign-in or environment configuration.

### GitHub Copilot CLI

The adapter targets Copilot CLI 1.0.91. It uses an isolated `COPILOT_HOME`, exposes only `pitchcrew/*` tools, and disables built-in MCP, hooks and session export.

Native keychain or native authentication environment configuration must supply sign-in. Fallback tokens stored in the user's Copilot configuration file are not imported.

### Cursor Agent

Cursor Agent **2026.09.26 or newer** is required. Older builds appear unavailable because they cannot isolate global MCP discovery.

The adapter uses isolated CLI settings and project MCP configuration, allows `Mcp(pitchcrew:*)`, and denies shell, file reads/writes and web fetching. It runs without `--force` or automatic tool review. Native credential and data locations remain unchanged. Runtime-managed enterprise policies and account extensions remain subject to the runtime's behavior.

### Goose

The adapter targets Goose 1.44.0. Choose `provider/model` with `openai`, `anthropic`, `google`, `ollama` or `openrouter`, or set `GOOSE_PROVIDER` and `GOOSE_MODEL` before starting the daemon. Providers that launch another agent CLI are excluded.

Goose receives an isolated `GOOSE_PATH_ROOT` and a recipe containing only Pitchcrew MCP, with no saved session. User configuration, plugins and hooks are not imported. Use native keyring or environment authentication; file-based credentials in user configuration are not imported.

### Kiro CLI

The adapter targets Kiro CLI 2.26.1. Set `KIRO_API_KEY` in the daemon environment for native headless authentication; existing login files are not imported.

Kiro runs a fresh ACP session with the V2 engine and isolated `KIRO_HOME`. The generated agent exposes only `@pitchcrew/*`, with external MCP discovery, powers, resources and hooks disabled. Pitchcrew declines ACP permission requests and provides no filesystem or terminal client capabilities.

### Grok Build

The official xAI Grok Build CLI **1.0.45 or newer** is required. Set `XAI_API_KEY` in the daemon environment; existing login files are not imported.

Grok receives an isolated `GROK_HOME` and a fresh headless session. Only Pitchcrew MCP and its native MCP search/call helpers are available. Native file reads, shell, editing, web and subagent tools are excluded; memory, compatibility discovery and automatic updates are disabled.

### Pi and oh-my-pi

Pi requires **1.0.0 or newer** from the current `earendil-works/pi` project, which includes native MCP support. Older packages without that support appear unavailable. The adapter uses an isolated `PI_CODING_AGENT_DIR`, loads only the built-in MCP extension, and disables built-in tools, ambient extensions, skills, prompt templates, context files and session persistence.

oh-my-pi requires **18.4.9 or newer**. It receives isolated configuration and data paths and exposes Pitchcrew MCP tools. Ambient plugins, foreign configuration discovery, native tools, rules, skills, memory and auto-learning are disabled. On Windows, the Pitchcrew data folder must be on the same drive as the user home so OMP can isolate its configuration root.

Ordinary oh-my-pi chat exposes the scoped LinkedIn draft checker and conversation,
memory, crew-message, user-question and progress tools needed by the bundled
career skills. These are Pitchcrew MCP tools, not native memory or shell tools;
the daemon rechecks run access and role permissions on every call.

Both inherit native provider authentication environment variables, such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. User auth files, OAuth login files and custom provider configuration are not imported. Leave the model empty for the runtime default or use `provider/model`.

### Hermes Agent

[Hermes Agent](https://hermes-agent.nousresearch.com/docs/reference/cli-commands/) **0.21.5 or newer** is required for structured one-shot output. The adapter runs `hermes chat --query-file - --oneshot --format stream-json` in an isolated `HERMES_HOME`, exposing only the `pitchcrew` toolset. User configuration, login files, plugins, ambient rules, memory and background self-improvement are not imported or enabled. Pitchcrew's role instructions and assigned skills arrive in the prompt.

Set native provider authentication variables in the daemon environment, such as `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. Credentials saved by `hermes model` in the user's `.env` or auth files are not imported. Use `provider:model` with `openrouter`, `anthropic`, `openai-api`, `gemini`, `nous`, `xai` or `lmstudio`. For example, `openrouter:anthropic/claude-sonnet-5-5` retains OpenRouter's full model selector. Bare model names and an empty model use `HERMES_INFERENCE_PROVIDER`, defaulting to `openrouter`; empty models use that provider's Hermes default. Agent CLI/ACP providers and MoA presets are excluded. Native model discovery is not supported; the picker shows curated OpenRouter suggestions and accepts custom selectors.

## Demo

Demo is a deterministic fixture runtime with no model, authentication or AI calls. It is available only when the daemon starts with `--dev`. Existing Demo roles retain their history in production but cannot run until you select a real runtime.

Return to the [README](../README.md) for workspace setup and the application workflow.

## Managed deep-review child runs

Codex, Claude Code and OpenCode advertise audited deep-review child support. Development Demo provides deterministic provider-free coverage. Pitchcrew starts each child as a fresh isolated CLI run with its own scoped MCP capability, run directory, cancellation signal and saved result; it does not enable native subagent, shell or filesystem tools or implement a provider agent loop. The capability describes launch isolation and a conservative four-child concurrent capacity per runtime per review, not provider quota or account entitlement. Other runtimes cannot silently substitute for an unsupported selection.

Children normally inherit the effective saved Reviewer runtime/model. User-configured per-review alternatives are explicit and do not rewrite Crew settings. Invocation permissions are rechecked on every child request. Unavailable/failed children are reported, while the parent can finish using available findings. Children see the candidate resume, confirmed job data and verified evidence without other readers’ notes; only the parent consolidates conclusions.

Deep-review phases and children share an initial 30-minute wall-clock budget. The parent can extend it by 1–30 minutes per scoped call with a concrete explanation, including considering a Writer time request in a separate parent decision turn. Existing CLI processes observe approved extensions. Children request time through the parent; they cannot extend deadlines or recursively delegate. Questions end execution and preserve remaining time for a fresh continuation. Stop always cancels the full workflow and child processes. Ordinary CLI/ACP turns retain the fixed 30-minute limit.
