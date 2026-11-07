# Runtime setup and model choices

Settings > Runtimes manages installed agent CLIs, their account readiness, executable locations and model choices for the current workspace. Pitchcrew continues to launch the native runtime for each run; setup does not add a provider agent loop or grant agent tools.

## Setup flow

Open **Set up** or **Manage** for a runtime. The dialog has three independently accessible steps:

1. **Installation:** inspect compatibility, recheck the executable, install a missing supported runtime, update an existing installation or save an executable override.
2. **Sign-in:** use a supported native browser, code or real-terminal method, save allowlisted runtime credentials, or follow native external setup and recheck.
3. **Models:** refresh the catalog and manage favorites, picker visibility, ordering and custom definitions.

Each step reports its actual state. A compatible executable does not prove authentication, and an account-ready result does not prove access to every listed model. Unverified authentication remains distinct from a missing sign-in. Skipping to Models is allowed; it does not bypass launch-time readiness checks.

Step status distinguishes blocked sign-in, an active flow and its actual failure or expiry. The Models count identifies native catalog entries separately from custom definitions. Model-source and custom-definition explanations sit under **About model choices**. Phone and coarse-pointer icon targets are at least 44 by 44 pixels.

The dialog is hosted independently of the sorted runtime rows, so a runtime moving between installed, attention-needed and unavailable groups does not destroy the open setup flow. Executable, credential and model drafts survive step changes, and closing or following an agent-configuration link uses the unsaved-changes guard. The Models step manages available choices; agent defaults remain in Crew settings, and conversation overrides remain in the conversation runtime dialog.

An acknowledged action stays acknowledged if its following status refresh fails. The dialog reports the connection problem and offers **Retry connection**; it does not claim the save was rejected or retain an already-saved executable draft as unsaved. Finished installation results move under **Previous installation attempt** once the runtime is available, so an old failure does not replace current compatibility status.

See [the setup dialog](../packages/ui/src/RuntimeSetup/index.tsx), [readiness steps](../packages/ui/src/RuntimeSetup/components/SetupSections.tsx), [runtime setup routes](../packages/orchestrator/src/http/routes/runtime-setup.ts) and [runtime readiness and updates](runtimes.md).

## Executable location and diagnostics

Executable location shows the active path, resolved location when different, selection source and installer ownership. Selection can come from automatic detection, a user-saved custom path or a Pitchcrew-managed installation. Unknown ownership stays unverified; inspecting diagnostics does not authorize an update.

A custom executable must be an absolute file path without quotes, command arguments, newlines or control characters. The server checks file access and probes its version before selecting it. An incompatible reported version can remain visible for repair; a file that does not report a runtime version is rejected. Clearing the saved path returns to automatic detection. If a saved executable disappears, Pitchcrew reports it missing rather than silently switching to another executable on PATH.

Paths are saved in `runtime-setup.json` under the workspace data directory. They apply to all clients of that workspace, not just the current browser. Checks, native account probes, model discovery, authentication and future agent launches use the same selection. The adapter's [AsyncLocalStorage scope](../packages/adapters/src/process/executable.ts) carries a snapshot of the workspace's executable map through its asynchronous work, avoiding a process-global override that could affect another workspace. Native Windows executables run directly; supported npm command shims are resolved to their package entry and run through Node without a shell.

Path changes reserve the runtime synchronously and are rejected while runs, metadata checks, sign-in, setup or updates own it. Existing native conversation sessions and cached model/authentication/update metadata are invalidated before the new selection is committed. Failed validation keeps the previous path. A failed configuration write rolls back the in-memory path; invalidated sessions may require a fresh native session even when the path is kept.

Implementation: [setup manager](../packages/orchestrator/src/runtime-setup/index.ts), [setup storage](../packages/orchestrator/src/runtime-setup/store.ts) and [maintenance reservations](../packages/orchestrator/src/runtime-maintenance/index.ts).

## Managed first installation

Managed installation is available for a missing runtime when npm is available, in-app runtime maintenance is enabled and the runtime is idle. It does not replace an existing global installation or a saved executable selection.

| Runtime            | Managed official npm distribution |
| ------------------ | --------------------------------- |
| Claude Code        | `@anthropic-ai/claude-code`       |
| Codex              | `@openai/codex`                   |
| Gemini CLI         | `@google/gemini-cli`              |
| OpenCode           | `opencode-ai`                     |
| GitHub Copilot CLI | `@github/copilot`                 |
| Grok Build         | `@xai-official/grok`              |
| Pi                 | `@earendil-works/pi-coding-agent` |
| oh-my-pi           | `@oh-my-pi/pi-coding-agent`       |

Cursor Agent, Goose, Kiro CLI and Hermes Agent use manual first-install guidance. Their existing supported update mechanisms remain separate from first installation. No universal one-click installer is claimed.

The daemon verifies a compatible stable release from the allowlisted distribution, pins that version and invokes npm with server-owned arguments and the official registry. Installation goes into `<data-directory>/runtimes/<runtime-id>`, with containment and symbolic-link checks. It does not alter the system PATH. The installed package identity, launcher and compatible version must be verified before its executable is adopted.

The existing installer worker holds a shared per-user OS-backed lock for the installation prefix until its subprocess stops. Runtime reservations prevent agent work, metadata checks, sign-in, configuration changes and updates from racing with installation. Operations report preparing, installing, verifying and their final outcome. Output is redacted and bounded, execution has a ten-minute deadline, and interactive permission/password prompts are not accepted. Cancel stops the owned process before releasing the runtime. A daemon disconnect also cancels its worker-owned installer.

There is no automatic retry, rollback, downgrade or uninstall. Cancellation and failure can leave files in the dedicated prefix, but an unverified executable is not selected. Saved unfinished operations become interrupted on startup; recheck before retrying. If device storage fails, setup stops and reports that its outcome needs rechecking. A verified executable may already have been adopted even when its final status could not be saved; the message does not claim adoption was rolled back. Recheck the selected executable before retrying.

See [managed installer preparation](../packages/orchestrator/src/runtime-setup/managed-install.ts), [distribution allowlist](../packages/adapters/src/maintenance/catalog.ts) and [installer worker](../packages/orchestrator/src/runtime-maintenance/installer-worker.ts).

## Authentication

The Sign-in step offers the methods supported by the selected adapter:

- Codex, Claude Code and Cursor use native browser sign-in; Claude requests a one-time code only when its CLI requires it.
- OpenCode and Copilot use fixed auth-only commands in a real native PTY.
- Grok supports a native device-login PTY and browser methods advertised through its ACP authentication contract, using a private workspace auth home.
- All twelve production runtimes offer allowlisted credentials/provider settings. Gemini, Goose, Kiro, Pi, oh-my-pi and Hermes retain honest credential or external setup guidance; in-app OAuth is not implied. Pi/oh-my-pi do not start interactive chats for authentication, and Hermes native OAuth is not wired.

**Credentials and provider settings** stores write-only, per-runtime workspace overrides in the private `runtime-connections/credentials.json` file. Status reports saved, inherited, disabled or unset without returning saved or inherited secret values. Use daemon value removes an override; Disable saves an empty value that suppresses inheritance. This is permission-protected file storage, not OS-keychain encryption. It cannot change `PATH`, `HOME`, `NODE_OPTIONS`, hooks, tools, startup commands or arbitrary runtime configuration.

Sign-in, sign-out and credential changes are user-only and reserve an idle runtime. Existing native conversation sessions are invalidated before credentials can change; if that invalidation cannot be saved, the operation does not start. Optional Sign out is confirmed and describes whether it changes the native CLI account or the managed workspace account; Pitchcrew never signs out automatically before login. Cancellation clears cached readiness but cannot roll back an account change that raced with a browser callback.

The native sign-in child has a five-minute attempt limit. Its deadline is set immediately before launching the child and cleared when post-flow verification begins. The UI counts down the attempt, not the provider URL's validity. Current account readiness, rather than a historical successful flow, determines the step's signed-in state. A CLI can finish successfully while account readiness remains Unverified without a model request. Configured or inherited `CODEX_API_KEY` is reported Unverified rather than using native ChatGPT account metadata to claim that key works.

Temporary authorization URLs, code prompts, terminal output and entered codes stay in the private setup flow, outside board events, snapshots and run artifacts. Responses must match the exact current flow and interaction. Browser adapters validate supported HTTPS hosts; ACP browser consent is explicit, while filesystem, terminal, permission and tool RPCs remain denied. The real sign-in terminal has bounded input/output and a genuine Node worker owning its PTY. No user prompt or inference turn is started for authentication or verification.

Grok native OAuth is managed under the workspace's private `runtime-auth/grok` home and takes precedence over `XAI_API_KEY`. OAuth work uses minimal credential copies in private temporary homes outside job run folders, serialized refresh and conditional writeback. An unreadable credentials file blocks affected work while keeping the app usable; confirmed recovery keeps a private backup and resets all runtime overrides without logging out native accounts, deleting managed Grok authentication or changing agent selections.

See [runtime authentication](runtime-authentication.md) for the support matrix, allowed variables, storage and recovery contracts, native versus workspace scope, PTY/ACP boundaries and verification limits.

## Model management

The Models step combines the runtime's native or labeled fallback catalog with explicit custom definitions. Users can filter the list, favorite models, control picker visibility, reorder choices and add or edit custom selectors, labels and supported reasoning metadata. Favorites sort before other visible choices. Hiding affects picker presentation; it does not remove a saved agent or conversation selection. An already selected hidden model remains visible to that editor, and server validation retains hidden definitions.

Native discovery remains cached independently of these preferences. Refresh requests a new catalog; it does not verify account entitlement or make a model request. Custom definitions are explicitly unverified. They add a selector and optional reasoning metadata, not a provider connection, account grant or runtime capability. Reasoning controls are accepted only for adapters with an explicit supported reasoning argument: Codex, Claude Code, OpenCode, Copilot CLI, Pi and oh-my-pi. Native catalog entries take precedence if a custom selector later appears natively.

Preferences are per runtime within the workspace and stored in `runtime-model-preferences.json`, outside board events and native CLI configuration. Editing choices does not rewrite agent defaults or conversation overrides. Removing a custom definition, or removing reasoning support required by a saved selection, is rejected while an agent or conversation still uses it. Change that saved selection first.

Writes carry a revision fingerprint. A stale save receives HTTP 409, keeps the editor's draft and offers a review of the latest saved choices rather than overwriting another window. The file is bounded, schema-validated and replaced atomically with a private temporary file. An unreadable file is not silently replaced. Explicit recovery renames the whole preferences file to `runtime-model-preferences.invalid-<id>.json` in the data directory, then starts with default model choices for all runtimes. Saved agent/conversation model selectors are kept; custom models that need restored definitions may need repair from that backup.

An unreadable preferences file does not block native discovery. The user-session read response carries `readError: { code: "unreadable", message }`, default preferences, an empty revision and the native catalog. Models shows native choices read-only with one **Recover model choices** action; Add, Refresh and row writes are disabled until recovery. The backend omits custom definitions only for its typed `RuntimeModelPreferencesReadError`, without overwriting the damaged file or hiding unrelated errors. Agent and conversation pickers retain fresh native models and native reasoning, with a Settings recovery warning. Their selected unlisted selectors remain visible, but missing custom definitions supply no reasoning metadata.

Model errors clear after a successful reload. Opening a model list requests native discovery through its existing bounded cache; **Refresh models** bypasses that cache. Focus/visibility changes read saved preferences and the latest known catalog without starting a native process, even when the discovery cache has expired. Local saves update pickers immediately, and stale responses are ignored after a newer save or explicit refresh. If recovery succeeds but loading the new list fails, the recovery dialog says the reset already happened and retries only the read, without issuing another reset.

See [model management routes](../packages/orchestrator/src/http/routes/runtime-model-preferences.ts), [preference storage and recovery](../packages/orchestrator/src/runtime-model-preferences/store.ts), [used-definition guards](../packages/orchestrator/src/runtime-model-preferences/usage.ts), [picker composition](../packages/core/src/runtime-model-preferences-helpers.ts) and [native discovery](model-discovery.md).

## Access boundaries

Setup, executable configuration, installation, native authentication, credential settings and model-preference writes require the local user HTTP session and existing Host/Origin protections. Internal role agents and external MCP clients cannot invoke these actions. Setup does not add shell tools, broaden runtime permissions, change application approval gates or allow an agent to choose its own executable or credentials.

This is one local workspace's runtime setup. Multiple named provider instances, arbitrary launch arguments/environment editing beyond allowlisted authentication settings, general ACP-registry support and T3-style remote-environment administration are not implemented.

## Verification and limits

Read-only checks on installed Codex 0.167.0 and Claude Code 2.1.318 detected their executable paths and reported authenticated native account metadata. Native model discovery returned eight Codex models and thirteen Claude models during that inspection; those versions and counts are observations, not required versions, fixed catalogs or entitlement guarantees.

Read-only native CLI help and metadata inspection also verified the installed Grok ACP method-discovery contract against a private safe configuration. T3 was compared through source inspection, not a running T3 authentication test. No actual OAuth/login/logout, managed installation or inference request was executed. Automated setup, installer, native-auth protocol and UI coverage use fictional subprocess/account states and isolated production-mode data, without the Demo runtime. The final combined checks and independent review results are reported separately; this document does not claim a final test count or a live end-to-end OAuth/install pass.

Native login output and app-server protocols can change. Unsupported responses fail with retry/manual guidance. Some runtimes cannot verify authentication without an actual request, so unverified status remains advisory rather than a fabricated success. No human screen-reader, physical-phone keyboard or every-provider live execution audit is claimed.
