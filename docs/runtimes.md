# Runtime setup

Pitchcrew starts an installed agent CLI for each chat or workflow run. Install the runtime on `PATH`, configure its native authentication, then select it in Crew settings. **Settings > Runtimes** shows whether Pitchcrew can detect it.

Pitchcrew never reads, copies or stores provider credentials. Authentication remains with the CLI, including supported environment variables inherited from the daemon. Isolated runtime configuration can exclude existing login or configuration files; see the notes below before assuming that an interactive CLI login will also work in Pitchcrew.

These integrations have subprocess contract coverage. Live provider executions are not part of automated verification.

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

Crew settings provide a searchable model picker. Native catalogs are loaded where supported and cached for five minutes; **Refresh models** forces a new check. Curated suggestions are labeled separately. Changing runtimes resets the model to the CLI default. Saved model names remain visible even when absent from the current catalog.

Health checks only check the CLI version. Model discovery does not start an inference turn, and a listed model does not guarantee that your account can use it. See [model discovery](model-discovery.md) for commands, fallbacks and limits.

## Runtime-specific notes

### Claude Code and Codex

Configure the CLI's native authentication before launching runs. Select a model or leave the setting empty for its default. Provider-specific launch configuration lives in [the adapters package](../packages/adapters/src).

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

Both inherit native provider authentication environment variables, such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. User auth files, OAuth login files and custom provider configuration are not imported. Leave the model empty for the runtime default or use `provider/model`.

## Demo

Demo is a deterministic fixture runtime with no model, authentication or AI calls. It is available only when the daemon starts with `--dev`. Existing Demo roles retain their history in production but cannot run until you select a real runtime.

Return to the [README](../README.md) for workspace setup and the application workflow.
