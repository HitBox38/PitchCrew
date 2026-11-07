# Final Codex runtime functionality review

Read-only independent review, 2026-11-07. This is the seventh fresh Codex review of the functionality follow-up; the preceding visual settings review is recorded separately.

**9.4/10. No P0–P2 findings. Ship after the current regression run passes.**

The latest change preserves the intended separation:

- Preference GETs read the latest known catalog without launching a CLI.
- Opening and explicit refresh still use native discovery.
- Custom definitions, corruption recovery and native reasoning remain intact.
- Existing response-generation guards still protect newer preferences.
- Installation recovery actions and sign-in controls now read in the right order.

Source review only; I ran no tests or live authentication/install operations. Actual OAuth completion and managed installation remain unverified.

The prior V6 review also scored 9.4/10 with no P0–P2 findings. It confirmed that typed read failures preserve native discovery and reasoning without overwriting a damaged file, the preferences endpoint reports explicit recovery state while blocking writes, and missing custom definitions gain no invented reasoning support. T3's provider instances, secret sources and remote scopes remain documented scope differences.

After this review, the parent synchronized the setup step's native count with the displayed catalog and added a regression for a refreshed fourth native model. Final verification is recorded in the [review record](../runtime-setup-review.md).
