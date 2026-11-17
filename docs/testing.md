# Testing rules

Rules for contributors and coding agents. If a change makes anything here false, update this file in the same change.

Development UI daemons keep Vite dependency caches separate by data folder. Deliberate development-UI tests use `uiCache: 'temporary'`; backend-only fixtures use `ui: false`. Temporary cache cleanup stays inside its validated cache boundary and waits for optimization to settle.

`packages/ui/test/browser-native-job-panel.test.ts` covers a job conversation's browser panel (tools in Page settings, fixed approval reservation, the taller automatic-steps tray in every mode that acts on its own, site access in Autonomous preparation only, manual control, Packet | Browser parking and the expanded view) with the same fake native bridge as `browser-native.test.ts`, which covers the agent DM panel's page tools, profiles, approvals and guest mounting in depth.

The adapter spawn fixtures `packages/adapters/test/fixtures/runtime-cli.ts` and `acp-cli.ts` have a `tool-calls` mode (`contextFor(runtime, 'tool-calls')` from `packages/adapters/test/helpers/runtime.ts`, read as `PITCHCREW_FIXTURE_MODE`) that emits real-shaped native tool calls through each runtime's real spawn path. `cli-runtime.test.ts` uses it to check, for every runtime it covers, that a failed command echoing the run token shows only `[redacted]`; `kiro-runtime.test.ts` checks Kiro's Pitchcrew outcomes in CLI v3 and V2-engine shapes; and `acp-tool-failures.test.ts` checks that a run without steps receives only closed failures.
