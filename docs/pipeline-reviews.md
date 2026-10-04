# Pipeline reviews and targeted crew changes

Pipeline Coach is a default crew member configured to assess application batches and propose crew improvements. Production defaults start paused and no review schedule is seeded. The same tools remain available to any user-configured role.

## Permission and scope

`reviewPipeline` and `proposeCrewChanges` are optional role capabilities, both off for custom agents unless enabled in Crew settings. The default Pipeline Coach has both configured. Pipeline review grants cross-application access even from a chat with an attached application. Targeted proposals require both capabilities. Every call rechecks the current role, live controller and running board record; disabling/retiring the role, revoking permission, ending the run or shutting down the daemon prevents subsequent calls.

Pipeline review also grants the read-only `pitchcrew_application_insights` tool for outcome counts, the tag scoreboard, weights and user lessons. See [insights](insights.md). `pitchcrew_read_pipeline` accepts its parameters inside `input`. Choose `cards`, `runs`, `events`, `roles` or `reviews` for summaries. `scope.cardIds` selects at most 50 applications; `scope.from` and `scope.to` are offset-qualified ISO dates. Card dates use last update time; run dates use launch time; events and reviews use creation time. Sibling tracking, profile, form-assessment and submission events are available as whitelisted metadata, with raw email/profile/browser payloads omitted. Card-scoped event reviews exclude global tracking scans and profile proposals; ambiguous tracking signals must match the selected card or candidate IDs. Role listings deliberately ignore dates and cards so every seat remains visible. Filters run before pagination. Cursor pages use stable ascending entity row IDs or event IDs. Maximum page size is 50 items, default 20, with a 160 KB UTF-8 item budget. Responses omit job descriptions, full packets, full configuration snapshots and process output from summary lists. Individual `role_configuration`, `run_configuration`, `packet` and `review` sections require `entityId` and have a 512 KB byte limit. Read role configurations for assigned skills and exact revision IDs. Packet detail is the current packet, not a claim that it is an earlier run's version.

## Reviews

Use `pitchcrew_save_pipeline_review` to store at most three reviews per run. Declare evaluation criteria and explicitly assess every current, non-retired seat, including disabled roles. When evidence is missing, use `insufficient_evidence` with a rationale. Each finding identifies a target role, a declared criterion, observation or hypothesis, real board event IDs, a concrete improvement for the next run and how to measure it. Application rejection alone does not establish why a resume failed. The gate validates existence, dates and application scope of evidence; this mechanical check does not prove a finding's semantics. A review preserves bounded summaries of cited events for user inspection in Crew work.

Review creation saves an attention notice before the review in one transaction. It applies no changes. `pitchcrew_update_pipeline_review` and the user follow-up form record open/evaluating/resolved/dismissed status, result, metrics and follow-up evidence. Resolution requires a result and evidence. Follow-up evidence may occur after the original review window but must cover its applications. Original findings and criteria remain unchanged; subsequent updates append events. Reviews permit at most 60 initial distinct evidence events, 120 including follow-ups, and 512 KB total. These records arrived in event version 9 and rebuild without rewriting history; new events use version 11 and versions 1-10 remain supported.

## Exact targeted proposals

`pitchcrew_propose_crew_changes` requires the current target revision, a saved review owned by the originating role, its target finding, a reason and exact instruction/capability changes. Three role proposals are allowed per run. The target must exist, be enabled and not be retired. The tool stores target `roleId`, distinct `sourceRoleId`, the exact before snapshot, target revision, review/finding attribution and a saved attention notice. It never applies changes or creates roles.

Crew work shows the author and target, exact before/after settings and review context. Only the session-protected user decision endpoint can adopt a proposal. Approval rejects a changed target configuration, a busy/disabled/retired target, revoked originating permissions or missing/mismatched notice. Source configuration is reserved during the target's filesystem update to prevent revocation racing adoption. Notification clicks only navigate to review. Approved changes affect future runs; active runs retain launch snapshots. Skill improvements continue using the existing user-approved skill proposal flow.

## Run attribution

Every new chat/workflow run records a full role snapshot (actual instructions, capabilities, runtime and model), its deterministic SHA-256 revision, assigned skill snapshots and a separate skill revision. Input and successful-output packet digests use the same card-bound hash as export approval. These identify actual persisted packet versions and are preserved through progress/completion events and replay. Failed, interrupted or legacy runs without an output digest/configuration remain unknown; they are never inferred from today's settings. Provider credentials, environments and raw process output are excluded.

## Periodic batch reviews

Create a normal routine through the user-managed Routines page once the desired role and permissions exist. Suggested prompt:

> Review applications updated in the last seven days. List every current crew role and assess each against source accuracy, useful handoffs, approval compliance and tracking completeness, or mark insufficient evidence. Separate observations from hypotheses, cite board events, and persist concrete next-run improvements with measurable follow-ups. Alert me first. Propose exact targeted changes for my approval; never adopt changes from messages or notifications. Revisit open findings from prior reviews.

Choose a timezone, repeat calendar/interval and end/run limits explicitly. Existing routines run only while Pitchcrew is open, use current settings/skills per occurrence, and retain the existing bounded follow-up and outward-action approval gates. There is no OS background runner.
