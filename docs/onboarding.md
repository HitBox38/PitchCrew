# Onboarding

Rules for contributors and coding agents. If a change makes anything here false, update this file in the same change.

**Onboarding.** Fresh data directories show a two-screen introduction to the crew and approval flow, followed by a Board setup checklist for nonblank profile notes, enabled and available agents in all three workflow seats, and a real (non-demo) job card. Other pages show compact setup progress linking back to Board. Users can defer setup or explicitly finish it, reopen the setup checklist from Getting started in the sidebar, and reopen the introduction from Show introduction in the command palette or Settings > General. The introduction is a centred 600px clay sheet, and the Board setup checklist sits inside the Needs you deck with three 64px rows for the real criteria. Versioned onboarding preferences live in `onboarding.json` in the data directory and synchronize through snapshots across browser/Electron; they do not change board events, role capabilities or approvals. Existing databases default to deferred onboarding on upgrade.

When the checklist is the only Board content, it scrolls within the available work area so its actions and Set up later stay reachable in short windows and phone landscape.
