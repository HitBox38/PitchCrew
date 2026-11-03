# Skill delivery

A skill is reusable Markdown guidance, available to all crew agents or selected agents. Assignment grants no tools or approvals. The library holds up to 100 skills, each with up to 50,000 content characters. There is no combined character limit per agent.

## Choosing delivery

The editor, import review and proposal review show **Include in every run**. When enabled, the agent receives the full text at the start of each eligible run. Otherwise it sees the skill's name, description and ID and can read the full instructions when relevant. Give procedural skills descriptions that explain when they help; a missing description does not hide the skill.

Existing saved skills keep full inclusion. New hand-written skills default to included, new imported procedures and new procedural starters default to on demand, and the bundled prompt-injection guard defaults to included. Saved text, assignments, edits, renames and deletion are preserved. Upstream updates and source reloads retain the user's delivery choice.

An explicit `$skill` selection includes the exact selected skill's full text once for that turn, even when its normal delivery is on demand. Queued selections retain revision/digest validation and cannot silently adopt changed instructions. Explicit chat selections do not automatically carry into a later ordinary **Draft application** action. That workflow sees its assigned catalog; enable **Include in every run** when delivery must not depend on an agent's relevance decision.

## Frozen reads and isolation

`pitchcrew_read_skill` accepts a catalog `skillId` and returns full instructions plus their digest from the active run's frozen configuration. It reads no path, URL or current board version and cannot select another role. Repeated calls return the same content without truncation or a cumulative character quota. Edits, reassignment and deletion affect future runs, not the active snapshot.

Eligible isolated application runs and review children can read their own assigned snapshots, which they previously received in full. Source extraction stays tools-free with no skills. Review-deadline decisions, summary-only turns, waiting-question states and external MCP clients receive no reader. Run cancellation, role permissions, conversation membership and application-context checks remain enforced.

Runtime prompts and generated `AGENTS.md` share one delivery plan. Exact `skills/<id>/SKILL.md` files remain run artifacts; runtime behavior does not depend on native file reads or native skill discovery. Native session identity includes a delivery-format revision, preventing an unchanged configuration from reusing a pre-rollout eager transcript. Later resumed sessions may retain instructions read on earlier turns.

Tool activity reports **Reading skill instructions** and its execution outcome. Successful delivery does not establish that the model applied the instructions. The runtime's actual model context remains finite, and unusually large included instructions, Profile files or history may still fail; Pitchcrew does not silently remove explicit or standing instructions to make them fit.

## Persistence and verification

Event version 35 adds the optional `includeInEveryRun` setting; versions 1–34 remain decodable without rewriting history. An absent historical setting means included. Omitted settings on edits preserve the current effective value, while service creation paths resolve defaults explicitly. Old pending proposals without a setting remain included when approved; newly created proposals record the setting before review.

Regression coverage checks importing beyond the old combined limit, individual/library bounds, legacy replay and updates, queued-reference checks, prompt/file parity, explicit deduplication, native session invalidation, frozen reads, tool discovery and restricted/external denial. Live provider compliance is outside automated verification. Run history still saves full snapshots; large-library measurements should track launch, memory and storage costs before considering a separate immutable revision store.

A synthetic local measurement on 2026-11-03 used 100 deferred skills with 50,000 ASCII content characters each. The prompt catalog was 13,126 characters; configuration cloning and hashing took 18 ms, three run-event writes took 104 ms and the instruction artifacts took 11 ms to write. SQLite occupied approximately 20.25 MB after those three events. These are one-machine observations, not performance guarantees or model-context estimates; the repeated snapshot storage remains a cost worth addressing separately.
