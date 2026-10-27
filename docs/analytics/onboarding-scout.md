# Workspace onboarding readiness scout

The team-owned PostHog skill `signals-scout-workspace-onboarding-readiness` lives in the project's Skills Store, independently of Pitchcrew's application and role skills. Its reviewed body is `posthog/scouts/workspace-onboarding-readiness/SKILL.md`; its bundled gate comes from `scripts/posthog/readiness.ts`. This fixes the [Inbox report](https://eu.posthog.com/project/295060/inbox/reports/5b1393a3-0caa-4cbd-ac3a-0f6ac3b405d0); it does not change application telemetry or other scouts.

The original v1 skill required events absent from the live taxonomy and an unqualified 7-day/21-day comparison. The replacement discovers schema first, treats related events as optional, labels launch/session observation rates accurately, and permits a labeled 7–20-day partial baseline. The bundled deterministic gate rejects stale capture, sparse activity, low counts and unsteady observations per calendar day. Eligibility alone never establishes a regression. The thresholds are conservative operational rules, not significance tests.

Run focused regression coverage with:

```sh
node --import tsx --test scripts/posthog/readiness.test.ts
```

The tests exercise the bundled gate and its actual CLI using fictional aggregate fixtures, including partial history, the capture-stop pattern, activity concentrated on two days, unequal window lengths, weighted rates, malformed counts and calendar labels across Jerusalem DST. They do not prove an LLM will follow every instruction or that production readiness has recovered. Live evidence remains subject to consent and capture coverage.

## Publish through PostHog MCP

Read the current skill with `skill-get` and retain its latest version. Compare its body and file manifest with this bundle; reconcile concurrent edits before publishing. Use `skill-update` with that `base_version`, the Markdown body after frontmatter, and the contents of `scripts/posthog/readiness.ts` published at the bundle path `scripts/readiness.ts` (`content_type: text/plain`). Only pass `files` when it contains the complete reconciled manifest: it replaces all existing files. Preserve the skill's owners, allowed tools, schedule, model and emit configuration. Supply a short `version_description` referencing the report. Read the saved skill and file back to verify the exact contents.

The gate accepts `endDate` (exclusive project-local date), a separately verified `firstSeen`, and `daily` aggregate rows containing `day`, `observations`, `allReady`, `profileMissing`, `crewMissing`, and `jobMissing`. No identity or raw event content is needed. Derive query boundaries with the project timezone; UTC arithmetic inside the script only handles calendar labels. A short query's earliest returned row is not sufficient proof of first-seen history.

Attach the implementation PR to the report using its current claim ID. Leave the report unresolved while the PR is open. If PostHog cannot observe the eventual merge, resolve it only after confirming that the fix landed and the saved skill still matches the bundle.

## Publication verification — October 27, 2026

Published version 2 through `skill-update` using `base_version: 1`; v1 had no bundled files. Fresh `skill-get` and `skill-file-get` reads matched the reviewed body and script after the server's trailing-newline trimming, with no skill specification problems. Existing owners and allowed tools were preserved. No scout configuration or scheduling writes were made. The gate returned `skip` / `capture_gap` on fresh complete-day aggregate evidence; this validates withholding a readiness verdict, not recovery of application capture. The report remains unresolved pending its implementation PR.
