# Runtime checks and updates

Implemented product design and engineering reference. Current behavior and the supported installer/authentication matrix are documented in [runtime setup](runtimes.md). See [current runtime setup](runtimes.md) and [Pitchcrew app updates](app-updates.md) for existing behavior.

## Agreed scope

- Extend runtime checks to report installation, compatibility and authentication status. Distinguish confirmed authentication, missing authentication and inability to verify authentication. These checks do not make an inference request or establish model entitlement.
- A current check that reliably establishes missing authentication blocks new work using that authentication configuration. Inability to verify authentication shows a nonblocking notice and permits an attempt. Authentication checks must reflect Pitchcrew's actual runtime launch settings and environment; a separate interactive terminal login alone is not evidence that an isolated Pitchcrew run can authenticate.
- Refresh authentication at startup, on **Recheck**, after a runtime update, and before starting work if the cached result is more than five minutes old. Share checks across agents using the same authentication configuration. A user retry after fixing sign-in forces a fresh check rather than reusing a cached signed-out result.
- When authentication is missing, show runtime-specific native setup instructions, **Copy command** where applicable, and **Recheck**. Instructions must match Pitchcrew's supported authentication configuration, including environment setup where a terminal login is insufficient. Starting or hosting sign-in flows inside Pitchcrew is outside this version's scope.
- Show the user when a runtime update is available.
- Let the user initiate a runtime update with a button in Pitchcrew and see its progress and outcome.
- Runtime updates continue in the background when the user leaves Settings. Show progress on the runtime's Settings row and retain a notification linking back to it. Present the current stage (preparing, updating, verifying), expandable installer output and a clear success or failure result.
- If normal desktop quitting would stop an in-progress runtime update, defer quitting until the update finishes. Show **Finishing runtime update…** and allow the user to cancel quitting. When the existing background service owns the daemon, closing the desktop does not stop the update.
- Preserve the runtime's installation method when updating. Use the owning installer when identifiable, or a supported native updater that handles its installation method. When neither is reliable, show manual update instructions instead of attempting an upgrade through another installer. Respect deliberately pinned installations.
- In-app updates run with the current user's permissions. If an installer requires administrator access or interactive input, explain the limitation and provide the appropriate manual instructions. Pitchcrew does not collect passwords, request elevation or leave an installer waiting invisibly for input.
- Update targets the latest stable release available through the existing installer, without a version picker in this version. Never downgrade a newer installation. Withhold one-click updates to versions known to be incompatible with Pitchcrew; being newer and untested alone does not establish incompatibility.
- Disable Update while crew work is using that runtime, and explain which work is using it. The user can retry when it is idle; do not schedule an automatic update for later.
- A running deep review reserves its participating runtimes across stages, including gaps between Writer, Reviewer and subagent execution. A review paused for user input releases those reservations once no CLI process is running; recheck the runtime before continuing after an update. Queued work alone does not make a runtime busy.
- Once updating begins, hold new work for that runtime until the update and verification finish. Work using other runtimes continues normally.
- After a failed update, recheck the installed runtime's version, compatibility and authentication. Resume eligible waiting work automatically if the installed runtime still passes the agreed checks, including when the previous version remains. Keep the update marked failed and offer Retry. If the runtime no longer passes, hold its waiting work and show repair instructions. Do not automatically downgrade or reinstall it.
- Check installed runtimes for updates when the app opens, then once every 24 hours while open. A separate **Check runtime updates automatically** preference defaults on. **Check for updates** refreshes immediately; when release checks are disabled, **Recheck installations** still refreshes installation and sign-in status. Checks never install updates; installation requires the user's Update action.

## Implementation plan

### Runtime contracts and authentication

Extend the runtime contracts in `packages/core/src/runtime.ts` with separate installation/compatibility, authentication and maintenance information. Preserve the distinction between an installed runtime and whether a particular configuration may start work. Do not use a single runtime-wide signed-out flag to block unrelated model providers supported by the same CLI.

Add bounded authentication probes under `packages/adapters/src/`, using the same isolation and environment rules as real runs. Reuse existing metadata initialization where it can safely provide authentication status without a turn. A model catalog, a present API-key variable or a successful version command alone must not establish authenticated account access. If a runtime has no reliable noninteractive probe, report unknown and explain what could not be checked. Never inspect or copy provider credential files to improve detection.

Key the five-minute cache by the effective authentication configuration, without exposing or persisting secrets. Deduplicate checks, bound output and duration, invalidate after relevant changes and updates, and cancel probes when the daemon closes. Record when the result was checked. Startup checks must not trigger sign-in, inference, ambient hooks or unrestricted MCP discovery.

Integrate the same preflight policy across ordinary chat, board workflows, source extraction, routines, crew follow-ups, deep-review stages and temporary subagents. Preserve queued requests when maintenance or authentication holds them; do not convert a temporary hold into a failed or completed run. A refreshed configuration must still pass its normal authorization, cancellation and context checks before work starts.

### Installer ownership and update execution

Create an adapter-owned support matrix for all twelve production runtime integrations. For each runtime, verify the official executable/package identity, supported native updater, stable-version source and available noninteractive authentication probe. Verify Windows launch behavior as well as macOS/Linux. Record which installation methods can be proven from the resolved executable and its real path. Unsupported or ambiguous installations retain manual instructions; do not guess a package or install a second CLI copy.

The owning installer's release source determines availability: for example, a package-manager installation must not be advertised as outdated merely because a different distribution channel published first. Re-resolve installation ownership immediately before execution. If the executable, installation method or target changed since the notice, refresh the notice instead of executing stale instructions. Keep version comparisons and compatibility decisions separate from authentication.

Put daemon-owned maintenance operations in a dedicated orchestrator module and expose user-session-protected routes under `packages/orchestrator/src/http/routes/`. The UI selects a known runtime/action; it does not supply arbitrary executable paths, shell commands, download URLs or updater arguments. Runtime maintenance is a user action and receives no agent gateway or MCP equivalent.

Use fixed argument vectors for verified commands, close interactive input, hide Windows consoles, sanitize bounded output and handle prompt/elevation failures explicitly. Define bounded check and update deadlines, with clear timeout outcomes. Serialize overlapping updates to the same installation and respect shared installer locks. Repeated clicks or concurrent browser/Electron clients must share the current operation rather than start duplicate installers.

Acquire the runtime reservation before starting the updater and atomically exclude new launches. Include startup preparation and active metadata helpers that use the installation, as well as live CLI processes. Deep-review reservations follow the agreed active-versus-waiting policy. Release the maintenance reservation only after the installer is no longer running and verification has finished.

### Verification and restart recovery

An installer exit code alone does not prove an update succeeded. Re-resolve the active executable, read its installed version and confirm the intended stable target or a newer acceptable version was reached. An unchanged version must not be reported as an update success when a newer target was expected. Refresh runtime checks and invalidate the model catalog after a change. Report installation outcome separately from authentication readiness so a successful installation with missing sign-in is described accurately.

Persist enough maintenance metadata to retain update notices, the automatic-check preference, operation identity and terminal/interrupted outcomes across daemon restarts. Follow the existing maintenance-file pattern outside board events; exclude secrets and unbounded installer logs. Runtime maintenance state and progress must participate in `crew/snapshot-revision.ts` so conditional snapshots remain correct.

After a crash or forced shutdown, an unfinished operation is interrupted, not successful. Do not automatically rerun its installer. Reconcile any surviving owned updater before releasing its reservation or offering Retry, then recheck the installation before allowing waiting work to resume. Preserve the existing daemon ownership rules and the existing handling of crew work interrupted by daemon shutdown.

### Shared UI and desktop lifecycle

Extend Settings > Runtimes with separate version/compatibility and authentication status, last-check information, setup instructions, Recheck, available-update details, Update and progress/result presentation. Keep manual instructions available when updating from Pitchcrew is unsupported. Use the shared controls and SourceBlock for commands and bounded installer output; keep each production TSX file within the repository's size limit.

Use the mounted workspace shell for daily automatic requests, with daemon-side deduplication and throttling shared across tabs and renderers. Persist the separate default-on preference. Ordinary status reads must not initiate network checks or updates. Offline failures retain the last successful check and known update notice while clearly marking freshness; they must not claim the runtime is current.

Notifications link to the exact runtime's current maintenance state and remain useful when Settings is closed or the user reconnects. Reflect authentication holds near the affected agent action with a route to setup; retain the user's draft and queued work. Progress is based on actual stages and installer output, with numeric percentages only when reliable progress is available.

Add the narrow desktop lifecycle coordination needed to defer an owned-daemon quit during maintenance and let the user cancel quitting. Apply it to both source and packaged launchers without changing service ownership. Coordinate Pitchcrew's own install-and-restart path with runtime maintenance, since it also stops the daemon. Browser disconnects and leaving Settings must not cancel a daemon-owned runtime update.

### Validation and documentation

Use deterministic subprocess and release-metadata fixtures. Automated tests must not authenticate real accounts, call models, update installed CLIs, invoke real elevation or change the user's package-manager state.

- Adapter contracts: signed in, signed out, unknown, custom provider, isolated configuration, missing executable, unsupported version, malformed output, timeout, cancellation and bounded diagnostics.
- Ownership and update contracts: native and package-manager installs, symlinks, Windows shims and spaces, pinned/ambiguous installs, stable-channel comparison, changed ownership, duplicate clicks, prompt/elevation failure, unchanged version, failed update with usable old version, broken install and interrupted recovery.
- Orchestrator workflows: atomic launch/update exclusion, held queues, authentication refresh on retry, other runtimes continuing, routines/follow-ups/source extraction, deep-review stages, waiting questions and subagents.
- HTTP and synchronization: user-only authorization, fixed server-owned actions, daily caching, concurrent clients, persisted preferences, offline notices and conditional snapshot invalidation during progress.
- UI and desktop: setup/recheck flow, update progress while navigating, notification links, result recovery after reconnect, hidden source/packaged quit deferral and service-owned close behavior. Preserve the hidden desktop smoke workflow.

Run the relevant adapter, orchestrator, UI and desktop checks as those layers change, plus repository lint, formatting, types and production builds. Update `AGENTS.md`, `docs/runtimes.md`, `docs/model-discovery.md` and the relevant lifecycle documentation when the implementation changes their current behavior. Keep the supported authentication and installer matrix current when extending this feature.

## Reference

[T3 Code provider constraints](https://github.com/pingdotgg/t3code/blob/main/docs/internals/providers.md) describes checking installation ownership before running the owning installer and verifying the resulting runtime version. Preserving the installation method is agreed above; its particular resolver, runner and verification mechanisms remain references for the discussion.
