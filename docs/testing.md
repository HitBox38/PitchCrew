# Testing rules

Rules for contributors and coding agents. If a change makes anything here false, update this file in the same change.

Development UI daemons keep Vite dependency caches separate by data folder. Deliberate development-UI tests use `uiCache: 'temporary'`; backend-only fixtures use `ui: false`. Temporary cache cleanup stays inside its validated cache boundary and waits for optimization to settle.

`packages/ui/test/browser-native-job-panel.test.ts` covers a job conversation's browser panel (tools in Page settings, fixed approval reservation, site access, manual control, Packet | Browser parking and the expanded view) with the same fake native bridge as `browser-native.test.ts`, which covers the agent DM panel's page tools, profiles, approvals and guest mounting in depth.
