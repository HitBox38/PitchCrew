# Configurable roles

Pitchcrew stores one agent configuration for each role. A role's stable ID is its board, chat, routine and run identity; its runtime/model selects the CLI that executes it. Creating a role is a user settings action, never an agent tool.

## Default crew

Startup supplies Scout, Writer, Reviewer, Submitter, Tracker, Documenter and Pipeline Coach. Production defaults use Claude Code and start paused; select an installed runtime/model and enable them in Crew. Development defaults use Demo. These are ordinary editable, retireable roles using the same configuration and tools as custom agents.

Scout's instructions cover evidence-based fit, unknowns and the user's shortlisting decision. When the user enables `discoverJobs`, they also cover scanning saved job sources and giving a short fit read for new leads; see [job discovery](job-discovery.md). The capability stays off by default. Writer's cover complete packets, exact profile quotations, word limits and inspected form requirements. Reviewer independently checks all packet prose, distinguishes blockers from style suggestions and gives actionable corrections. All three describe handoffs with the support crew and keep peer recommendations separate from user-approved settings changes.

| Agent          | Configured tools                                                   | Setup before use                                                                                        |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Submitter      | Application search, browser, form assessments, submission receipts | Attach an application; review/export its packet before submission and approve each browser action.      |
| Tracker        | Application search, email reconciliation, own routines             | Connect Google and enable Gmail for this role before scanning.                                          |
| Documenter     | Profile maintenance, own routines                                  | Connect the relevant account, enable GitHub/Drive for this role, and choose watched sources in Profile. |
| Pipeline Coach | Pipeline review, targeted crew-change proposals, own routines      | Choose the review scope; approve proposed changes before adoption.                                      |

The four support roles use the chat workflow seat and can message the crew. They cannot invoke other agents or manage packet workflow transitions. Account connectors stay disabled until enabled by the user. No schedules, source watches, runs or external actions are created by seeding. Shared skills apply normally; no additional role-specific skills are assigned. Instructions ask for the user's cadence before creating periodic work and preserve all existing approval gates.

Startup backfills missing default IDs in existing workspaces in one transaction. It never overwrites existing configurations, enables paused roles, reuses retired IDs or resets skill assignments. An existing custom role with a default ID wins. Backfill respects the 50-identity limit, including retired roles, adding missing defaults in the order above while space remains. It defers additions if shared skills exceed the 60,000-character creation budget. Restart after reducing that skill total to retry. Existing default instructions and capabilities are not silently updated on later startups.

## Creation and settings

Choose **Your crew > Create agent**. Setup works for any responsibilities through six steps: purpose, runtime, tools, skills, routine and review. Supply a name, responsibilities and optional working instructions; a safe stable ID is suggested from the name and can be edited. IDs use lowercase letters, numbers and single hyphens, up to 48 characters. Reserved names and path separators are rejected. IDs are permanent and cannot be reused after retirement; up to 50 identities, including retired ones, are retained. Closing, navigating and leaving protect unsaved changes. An unavailable runtime can be configured if the new agent starts paused; launching requires an installed available runtime.

New roles default to chat and scoped tools. Every additional permission starts disabled. Setup explains all currently supported tools, account connection status, missing dependencies and existing approval gates. A capability grants only its existing scoped tools; it does not connect an account or grant browser or export approval.

Select saved role-specific skills during setup and read their instructions. Shared skills apply automatically. Assignments preserve other roles, historical assignments and source provenance. Selected revisions are checked again after asynchronous instruction writes; changed/deleted skills and a total above 60,000 characters reject creation. Additional skills can be written or imported on the Skills page later.

Optionally add a first routine with a task, attached job, timezone, recurrence and stop conditions. It defaults paused; explicitly enabling it allows dispatch while Pitchcrew is open. Creating a routine does not require giving the agent routine-management access. The final review shows the exact purpose, instructions, runtime/model, permissions, skills and schedule. Creation uses the existing user-only `POST /api/roles`, extended with optional `skills: [{id, updatedAt}]` and `routine` (the existing routine input, bound to the new ID). The role, assignments and routine append current-version board events in one SQLite transaction. Any validation or event failure rolls back all entities. Generated instruction files precede the transaction and are refreshed on startup; a failed setup may leave an unused instruction folder but no stored role or runnable work. Successful setup offers chat and settings, without starting a chat turn automatically.

## Workflow seats

The optional `workflow` is `chat`, `scout`, `writer` or `reviewer`. It selects an existing structured result and the corresponding card-state eligibility; it never defines arbitrary transitions. Legacy role records without this field map Scout/Writer/Reviewer IDs to their original seats. Other identities default to chat.

Adapters keep the actual role ID for prompts, capability scope and paths, while result prompts/parsers and deterministic Demo dispatch use the workflow seat. A custom research role with the Scout seat returns a Scout fit result and remains the custom role in board history. Chat-only roles cannot start card workflow runs. The card panel chooses the first enabled, non-retired role with the appropriate seat; crew invocations can address a particular role ID when multiple roles share a seat.

`pitchcrew_list_roles` discovers current identities, responsibilities, enabled state and workflow seats. Messages, invocations, skills, routines and HTTP routes accept validated dynamic IDs and check against stored role entities. Paused/retired sources cannot use the scoped agent gateway. Retired/nonexistent targets cannot receive new actions; scheduled and queued execution rechecks permissions and role availability.

## Pause and retirement

Pause is reversible through the existing enabled setting. Retirement is a confirmed user action and is permanent in this version. Active runs and settings writes must finish first. Retirement atomically stores the tombstone, pauses routines targeted at or last maintained by the retiring role, and cancels queued tasks addressed to it. It does not delete or rewrite events. Retired roles stay in snapshots and the conversation list for historical attribution, while live action pickers exclude them. Stored skills retain historical assignments; reassign skills away from retired roles before saving updates.

No unattended scheduler is added: routines still run only while the daemon is open. Browser interactions and local packet exports keep their existing exact-action/snapshot approval gates. Agents cannot create, retire or silently apply role changes.

## Events and verification

New records use version 10, including cards with dynamic owners and job-discovery provenance, chat, tasks, routines and assignments. Versions 1 through 9 remain decodable and replayable. Integration tests exercise safe IDs, unknown/retired targets, source gateway checks, skill snapshots, custom chat, workflow seats, retirement, busy settings, proposal boundaries and replay. Live provider CLI runs remain outside automated verification.
