# Runtime authentication

**Settings > Runtimes > Manage > Sign-in** connects the selected runtime through a supported native sign-in method or workspace authentication settings. Pitchcrew still starts the actual installed CLI for agent work. This page does not add a provider agent loop, arbitrary shell access or agent-controlled credentials.

## Supported methods

Every production runtime has an explicit allowlist of authentication variables. Native interactive methods are supported separately; a credential editor does not imply that every provider has in-app OAuth.

| Runtime            | Native interactive method                                                            | Credential scope and limits                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Codex              | ChatGPT browser sign-in through native app-server                                    | Native CLI account; `CODEX_API_KEY` and an optional compatible endpoint can be saved separately.                          |
| Claude Code        | Native browser sign-in, with a code field only when requested                        | Native CLI account; configured API keys, auth tokens or cloud-provider settings can take precedence.                      |
| Cursor Agent       | Native browser sign-in                                                               | Native CLI account; configured Cursor keys or tokens can take precedence.                                                 |
| OpenCode           | Dedicated real PTY running `opencode auth login`                                     | Native CLI provider chooser; custom provider definitions are not imported into isolated runs.                             |
| GitHub Copilot CLI | Dedicated real PTY running `copilot login`                                           | Native account/keychain behavior; Pitchcrew does not import fallback tokens from ambient CLI config.                      |
| Grok Build         | Dedicated device-login PTY; ACP browser methods when advertised by the installed CLI | Workspace-managed native auth home; its OAuth account takes precedence over `XAI_API_KEY`. Sign out to switch to the key. |
| Gemini CLI         | Allowlisted credentials and native external setup                                    | No in-app OAuth flow is integrated.                                                                                       |
| Goose              | Allowlisted credentials and native external setup                                    | Saved user config and file-based credentials are not imported into isolated runs.                                         |
| Kiro CLI           | `KIRO_API_KEY` setting or daemon environment                                         | Existing native login files are not imported.                                                                             |
| Pi                 | Allowlisted provider credentials                                                     | No auth-only native mode is integrated; Pitchcrew does not start an interactive chat to sign in.                          |
| oh-my-pi           | Allowlisted provider credentials                                                     | No auth-only native mode is integrated; user auth files are not imported.                                                 |
| Hermes Agent       | Allowlisted provider credentials                                                     | Dedicated native OAuth is not wired; a saved credential is configured, not verified access.                               |

Optional **Sign out** appears only when the adapter supports it for the current authentication. It has a confirmation describing native versus workspace scope, preserves conversation history and never runs automatically before sign-in. Native account changes can affect CLI use outside Pitchcrew. Grok sign-out instead clears the account managed by this workspace. Cancel is not a rollback of an account change that raced with a browser callback.

## Workspace credentials and provider settings

Open **Credentials and provider settings** to inspect the selected runtime's allowed fields. Secrets are write-only: GET responses show only whether a value is configured and its source. A reveal button reveals only a newly typed replacement, never the existing saved or inherited secret. Non-secret fields, such as supported endpoint or provider choices, can be returned for editing.

Each field reports one source:

| Source    | Meaning                                                                  |
| --------- | ------------------------------------------------------------------------ |
| Saved     | A non-empty workspace override applies to this runtime.                  |
| Inherited | No override exists; the daemon's current environment supplies the value. |
| Disabled  | An explicit empty override suppresses even an inherited value.           |
| Unset     | Neither a workspace override nor an inherited value is configured.       |

**Use daemon value** removes the override after saving (`null` in a change request). **Disable for this runtime** saves an empty string. Entering a value saves a replacement only after Save. Restarting the daemon may be necessary to change its inherited environment; saved overrides do not require editing system environment variables.

The adapter owns the field allowlist. Shared provider keys mean `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY` and `XAI_API_KEY`, only where listed for that runtime.

| Runtime            | Allowed settings                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex              | `CODEX_API_KEY`, `OPENAI_BASE_URL`                                                                                                                |
| Claude Code        | `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY` |
| Gemini CLI         | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`                                  |
| OpenCode           | Shared provider keys                                                                                                                              |
| GitHub Copilot CLI | `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`                                                                                                |
| Cursor Agent       | `CURSOR_API_KEY`, `CURSOR_AUTH_TOKEN`                                                                                                             |
| Goose              | Shared provider keys, `GOOSE_PROVIDER`, `GOOSE_MODEL`, `OLLAMA_HOST`                                                                              |
| Kiro CLI           | `KIRO_API_KEY`                                                                                                                                    |
| Grok Build         | `XAI_API_KEY`                                                                                                                                     |
| Pi and oh-my-pi    | Shared provider keys, `OPENAI_BASE_URL`                                                                                                           |
| Hermes Agent       | Shared provider keys, `NOUS_API_KEY`, `HERMES_INFERENCE_PROVIDER`, `OPENAI_BASE_URL`                                                              |

Values are bounded single lines. Endpoint settings accept HTTP/HTTPS URLs without embedded credentials, query parameters or fragments. Provider and cloud switches accept only their declared choices. The editor cannot override `PATH`, `HOME`, `NODE_OPTIONS`, runtime config paths, hooks, tools or startup commands. A compatible endpoint field does not create an arbitrary provider definition.

Clearing a typed secret replacement undoes that field's draft. A non-secret field stays blank while being edited and blocks Save until it has a value or the user chooses Undo or Disable. Only the explicit **Disable for this runtime** action suppresses an inherited value. Each variable shows its current source and pending changes, declared choices use selects, and fixed validation errors retain the draft. Invalid inherited non-secret values are reported as configured but hidden, so an endpoint containing credentials cannot be returned to the renderer.

For Codex exec, the canonical override is **`CODEX_API_KEY`**. This matches [official OpenAI non-interactive authentication guidance](https://learn.chatgpt.com/docs/non-interactive-mode#authenticate-in-automation). When that key is saved or inherited, Pitchcrew reports **Unverified** without using native ChatGPT account metadata as proof that the key works. Configured credentials and a listed model never prove account entitlement.

## Storage and operation scope

Workspace overrides are stored in `<data-directory>/runtime-connections/credentials.json`, outside board events, snapshots, prompts, run folders and MCP configuration. Files are created with mode `0600` and their directory with `0700`; this is filesystem permission protection, not OS-keychain encryption. Secret values, including inherited ones, are not returned by the settings read API. The read response uses an opaque revision, not a credential fingerprint. Stale writes receive HTTP 409 and keep the editor draft.

One asynchronous runtime scope supplies these values to native sign-in, readiness checks, model discovery and agent launches for that workspace and runtime. It does not mutate the process-wide environment or another workspace's connection. Installer execution remains separate. Credential changes require an idle runtime, reserve it synchronously, invalidate durable native conversation sessions and clear model/authentication caches before committing the new configuration.

Runtime credentials are distinct from connector credentials and AI-text detector keys. Internal role agents and external MCP clients cannot read or change them. User-session routes retain Host/Origin protections, `no-store` responses and `no-referrer` policy.

## Shared interaction contract

The server advertises bounded method IDs and method kinds: browser, device, code, terminal, credentials or external guidance. A running flow has its own ID and exposes only its current interaction. Responses must match that exact flow and interaction ID and the expected response type; old codes, terminal input and browser decisions cannot target a later flow.

Native authentication is explicit, runtime-exclusive, cancellable and bounded by a five-minute attempt limit. The limit measures the local attempt, not the provider URL's expiry. The current-state polling route reads state without launching a CLI probe. Method discovery is separate, deduplicated, cancellable and protected by the same reservation; Grok ACP discovery has a ten-second deadline. Closing the setup dialog leaves an active attempt available to resume or cancel, while daemon shutdown stops owned processes.

Browser URLs parsed by the browser adapters use runtime-specific HTTPS host allowlists. ACP URL elicitation requires a current browser-consent response. Native terminal device flows retain their native provider instructions. After a CLI finishes, Pitchcrew checks installation and account readiness without an inference request. A native flow can finish with readiness still **Unverified**; it does not become a fabricated signed-in result.

The shared ACP client supports authentication discovery, authentication and a no-prompt session handshake with no MCP servers. It advertises no filesystem or terminal capability, cancels permission requests and rejects filesystem, terminal and tool RPCs. It does not run a user prompt. The current integration is the fixed Grok adapter, not a general ACP registry, arbitrary command launcher or multiple named provider instances.

## Native sign-in terminal

OpenCode, Copilot and Grok device sign-in use a real pseudoterminal running a fixed auth-only command, not a shell or an agent conversation. The renderer loads xterm only for that private terminal. A genuine Node helper owns `node-pty`, including the Windows pseudoconsole implementation, so the native PTY dependency does not use Electron's addon ABI.

The terminal enforces a 256 KB total output bound, an approximately 16 KB retained tail, 4 KB per input message and 64 KB total input. Cancellation, deadline expiry and helper disconnect stop the owned PTY. Output filtering is incremental across chunks: OSC/DCS and related side channels are stripped, and known configured/inherited secrets are redacted even when split across VT sequences or output chunks. Temporary terminal output and input are not saved to board history or run artifacts.

The terminal follows the app theme with contrast-adjusted ANSI colors. Explicit sign-in links accept only declared HTTPS hosts for that runtime; other output stays plain text. Recognized device-code formats have copy buttons. Link/code extraction and **Copy terminal text** use the rendered xterm buffer, joining soft wraps and excluding obsolete redraw frames. Ctrl/Cmd+C copies an existing selection; Ctrl+C without one retains the CLI interrupt behavior. Stream and ACP execution failures also redact known runtime secrets before diagnostics can enter saved run errors, including across split stderr chunks and before truncation.

## Grok workspace OAuth

Grok's native `auth.json` is managed under `<data-directory>/runtime-auth/grok`, separately from ambient user login files. Auth-only methods use that private home with a server-owned safe configuration. Native OAuth takes precedence over an API key; removing an `XAI_API_KEY` override is not equivalent to signing out of the managed account.

OAuth-backed work copies only the workspace native credential file into a private temporary home outside job run folders, alongside the operation's scoped configuration. Refresh-token operations acquire an abortable FIFO lease. Refreshed credentials are written back only if the original digest still matches, so an intervening login or logout wins. Temporary homes are checked for containment and symbolic-link substitution and cleaned after bounded operations. Cleanup or refresh persistence failures are reported without claiming credentials were safely saved. API-key runs retain independent homes and can run in parallel.

## Unreadable credentials and recovery

An unreadable private credentials file returns a typed recovery state. The app remains usable, but operations needing that file do not silently discard it or launch with a different authentication environment. Authentication editing, sign-in and affected runtime work stay blocked until the user resolves it.

Installation health stays separate: the runtime row says recovery is needed, and Manage opens Sign-in with recovery expanded. A reserved version-only check can inspect installation health using the executable override and the daemon's inherited environment; it does not read or adopt the damaged workspace overrides, probe an account or start inference. Recovery never represents a damaged credentials file as a missing installation.

**Recover authentication settings** requires confirmation and idle runtime work across the workspace. It moves the damaged file to `runtime-connections/credentials.invalid-<id>.json` and resets **all runtime overrides**, invalidating cached readiness and native conversation sessions. The backup can contain secrets and stays in the private credentials directory. This does not log out native CLI accounts, delete the managed Grok `auth.json`, change saved agent/model selections or revoke provider credentials. Daemon environment inheritance applies again after reset.

## Verification limits

Read-only inspection used the actual installed CLI help and native metadata. The installed Grok CLI advertised authentication methods through an ACP `initialize` exchange with a private safe configuration; no authentication or inference was started. The T3 comparison was read-only source inspection, not a running T3 authentication test.

The initial settings review used installed Codex and Claude Opus 5.5 reviewers and fictional provider states in isolated production-mode automated services. A subsequent opt-in live validation completed two real Pitchcrew turns each for installed Codex and Claude Code, including scoped MCP reads and native session reuse using existing signed-in accounts. The manual check is separate from automated tests and uses no Demo runtime. No fresh OAuth/login/logout, runtime installation, forced token-refresh recovery, every-provider live-auth, human screen-reader or physical-phone audit is claimed. Native protocol/output changes and provider policies can still require external setup.

Implementation: [connection allowlist](../packages/adapters/src/process/runtime-connection-fields.ts), [private connection store](../packages/orchestrator/src/runtime-connections/store.ts), [connection routes](../packages/orchestrator/src/http/routes/runtime-connections.ts), [authentication manager](../packages/orchestrator/src/runtime-setup/auth.ts), [native methods](../packages/adapters/src/runtime-auth/methods.ts), [ACP authentication](../packages/adapters/src/runtime-auth/acp.ts), [PTY owner](../packages/adapters/src/process/sign-in-terminal.ts) and [Grok credential transport](../packages/adapters/src/process/auth-credentials.ts).
