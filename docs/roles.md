# Configurable roles

Pitchcrew stores one agent configuration for each role. A role's stable ID is its board, chat, routine and run identity; its runtime/model selects the CLI that executes it. Creating a role is a user settings action, never an agent tool. Startup still creates only Scout, Writer and Reviewer. There are no Submitter, Tracker, Documenter or Coach defaults in this change.

## Creation and settings

Choose **Your crew > Create role**. Supply a lowercase ID (letters, numbers and single hyphens, up to 48 characters), display name, responsibilities, instructions, runtime/model and desired capabilities. Reserved chat/filter/Windows-device names and path separators are rejected. IDs are permanent and cannot be reused after retirement; up to 50 identities, including retired ones, are retained. The editor protects unsaved changes. Settings can be saved even if the selected runtime is unavailable; launching still requires an installed available runtime.

New roles default to chat and scoped tools. Crew messages, invocations, workflow management, routines, connected services and computer use start disabled. A capability grants only its existing scoped tools; it does not grant browser or export approval. Assign shared or role-specific skills after saving the role. Shared skills apply to future roles too; the per-role instruction bound is checked across stored active roles.

## Workflow seats

The optional `workflow` is `chat`, `scout`, `writer` or `reviewer`. It selects an existing structured result and the corresponding card-state eligibility; it never defines arbitrary transitions. Legacy role records without this field map Scout/Writer/Reviewer IDs to their original seats. Other identities default to chat.

Adapters keep the actual role ID for prompts, capability scope and paths, while result prompts/parsers and deterministic Demo dispatch use the workflow seat. A custom research role with the Scout seat returns a Scout fit result and remains the custom role in board history. Chat-only roles cannot start card workflow runs. The card panel chooses the first enabled, non-retired role with the appropriate seat; crew invocations can address a particular role ID when multiple roles share a seat.

`pitchcrew_list_roles` discovers current identities, responsibilities, enabled state and workflow seats. Messages, invocations, skills, routines and HTTP routes accept validated dynamic IDs and check against stored role entities. Paused/retired sources cannot use the scoped agent gateway. Retired/nonexistent targets cannot receive new actions; scheduled and queued execution rechecks permissions and role availability.

## Pause and retirement

Pause is reversible through the existing enabled setting. Retirement is a confirmed user action and is permanent in this version. Active runs and settings writes must finish first. Retirement atomically stores the tombstone, pauses routines targeted at or last maintained by the retiring role, and cancels queued tasks addressed to it. It does not delete or rewrite events. Retired roles stay in snapshots and the conversation list for historical attribution, while live action pickers exclude them. Stored skills retain historical assignments; reassign skills away from retired roles before saving updates.

No unattended scheduler is added: routines still run only while the daemon is open. Browser interactions and local packet exports keep their existing exact-action/snapshot approval gates. Agents cannot create, retire or silently apply role changes.

## Events and verification

New records use version 9, including cards with dynamic owners, chat, tasks, routines and assignments. Versions 1 through 8 remain decodable and replayable. Integration tests exercise safe IDs, unknown/retired targets, source gateway checks, skill snapshots, custom chat, workflow seats, retirement, busy settings, proposal boundaries and replay. Live provider CLI runs remain outside automated verification.
