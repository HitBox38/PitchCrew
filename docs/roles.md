# Configurable roles

Pitchcrew stores one agent configuration for each role. A role's stable ID is its board, chat, routine and run identity; its runtime/model selects the CLI that executes it. Creating a role is a user settings action, never an agent tool.

## Default crew

Startup supplies Scout, Writer, Reviewer, Submitter, Tracker, Documenter and Pipeline Coach. Production defaults use Claude Code and start paused; select an installed runtime/model and enable them in Crew. Development defaults use Demo. These are ordinary editable, retireable roles using the same configuration and tools as custom agents.

Scout's instructions cover evidence-based fit, unknowns and the user's shortlisting decision. When the user enables `discoverJobs`, they also cover scanning saved job sources and giving a short fit read for new leads; see [job discovery](job-discovery.md). The capability stays off by default. Writer's cover complete packets, exact profile quotations, the user's packet rules and inspected form requirements. Reviewer independently checks all packet prose, distinguishes blockers from style suggestions and gives actionable corrections. Scout and Writer read [application insights](insights.md) only when the user grants application search or pipeline review; Pipeline Coach starts each review with them. Weights and lessons remain user judgments that agents never set. All three describe handoffs with the support crew and keep peer recommendations separate from user-approved settings changes.

| Agent          | Configured tools                                                   | Setup before use                                                                                        |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Submitter      | Application search, browser, form assessments, submission receipts | Attach an application; review/export its packet before submission and approve each browser action.      |
| Tracker        | Application search, email reconciliation, own routines             | Connect Google and enable Gmail for this role before scanning.                                          |
| Documenter     | Profile maintenance, own routines                                  | Connect the relevant account, enable GitHub/Drive for this role, and choose watched sources in Profile. |
| Pipeline Coach | Pipeline review, targeted crew-change proposals, own routines      | Choose the review scope; approve proposed changes before adoption.                                      |

The four support roles use the chat workflow seat and can message the crew. They cannot invoke other agents or manage packet workflow transitions. Account connectors stay disabled until enabled by the user. No schedules, source watches, runs or external actions are created by seeding. Shared skills apply normally; no additional role-specific skills are assigned. Instructions ask for the user's cadence before creating periodic work and preserve all existing approval gates.

Startup backfills missing default IDs in existing workspaces in one transaction. It never overwrites existing configurations, enables paused roles, reuses retired IDs or resets skill assignments. An existing custom role with a default ID wins. Backfill respects the 50-identity limit, including retired roles, adding missing defaults in the order above while space remains. It defers additions if shared skills exceed the 60,000-character creation budget. Restart after reducing that skill total to retry. Existing default instructions and capabilities are not silently updated on later startups. Crew offers newer default instructions for review instead; see [default instruction updates](#default-instruction-updates).

## Default instruction updates

Releases sometimes improve a default agent's instructions. Startup never rewrites a saved role, so Crew compares each seeded default role with the current default text and tells you when there is a newer one.

Each default text has a revision: the first 16 hex characters of the SHA-256 of the text with whitespace runs collapsed, so spacing and line breaks alone never count as an edit. `packages/board/src/board/default-instruction-history.ts` lists every revision each default role has shipped with, oldest first, with its release date and a one-sentence summary. Only hashes are stored, not old texts. Texts that existed only on feature branches before release are matched too, but are not listed as changes.

| State        | Meaning                                                                         | Shown as an update |
| ------------ | ------------------------------------------------------------------------------- | ------------------ |
| Up to date   | The saved text is the current default, or your own edit of the current default. | No                 |
| Not edited   | The saved text is an earlier default.                                           | Yes                |
| Customized   | You edited an earlier default. Its text comes from the role's own events.       | Yes                |
| Unknown base | The text matches no known default. It is treated as your own.                   | Yes                |

Only non-retired roles whose first role event was created by startup are checked; user-created roles are excluded even if they reserved a default ID. Detection is read-only and is cached until the next board event.

When an update is available, the agent's Crew card says **Instructions update available**, Crew shows a summary with a review button per agent, and the notification bell adds an attention item that opens Crew. Role settings show the changelog lines since your version and a paragraph diff of your saved text against the new default, with changed words marked. For a customized role you can also compare the default you started from with the new one. If your tool settings differ from the default, the panel names them; updates change instructions only and never change tools.

- **Use new default** replaces the instructions. For text you wrote, it asks you to confirm first. It is an ordinary user settings change through `configureRole`: it waits for active runs and settings writes, applies the 12,000-character limit, refreshes the generated AGENTS.md and CLAUDE.md, and appends a role event by the user. Runtime, model, enabled state, workflow seat and tools stay as saved.
- **Keep mine** hides this revision. The choice is stored in `instruction-updates.json` in the data directory, next to `onboarding.json`, because it is a local preference that changes no role and needs no board event. It lasts across restarts until a newer revision ships.
- **Edit from new default** (customized and unknown base) puts the new default in the editor and keeps your current editor text, including unsaved edits, visible in the panel. Save settings as usual. The save names the reviewed revision and stores the exact source text as `defaultInstructionBase` in the role event, so your customized new text stays up to date and future releases compare against the right base. Stale reviewed revisions are rejected. Restoring the previous editor text saves ordinary settings without claiming the new default as its source; saving any exact known default resets explicit source metadata.

Adoption, dismissal and edited-default saves name the exact revision you reviewed; a stale revision is rejected. The routes `POST /api/roles/:id/instructions-update/adopt` and `.../dismiss` need the UI session. The agent gateway has no matching action, agents never see the update list, and nothing is applied automatically.

When you change a default role's instructions in `default-roles.ts`, append an entry to `default-instruction-history.ts` with the new revision, the release date and a one-sentence summary. The board tests fail and print the expected revision until you do. Never remove or edit earlier entries: they let existing workspaces tell an unchanged old default from their own edits.

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

New records use version 12, including cards with dynamic owners and job-discovery provenance, chat, tasks, routines and assignments. Versions 1 through 11 remain decodable and replayable. Integration tests exercise safe IDs, unknown/retired targets, source gateway checks, skill snapshots, custom chat, workflow seats, retirement, busy settings, proposal boundaries and replay. Live provider CLI runs remain outside automated verification.
