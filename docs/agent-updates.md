# Agent and skill updates

Crew and Skills show persistent sidebar counts for new default agent instructions and upstream versions of imported skills. The collapsed desktop sidebar retains a small indicator, and the mobile drawer uses the same counts. Opening a review or marking notifications read does not clear them: only applying or dismissing that version does. Update notices stay in the notification bell without automatic toasts, sounds or desktop notifications, including when first discovered while the app is open. Notification links open the exact review. Maintenance notices remain available beyond the ordinary 100-item notification history window.

Both pages show pending updates first and offer a URL-backed **Updates only** filter. Their **Updates** sections retain dismissed versions for later review. A dismissed version never returns because of a manual check; a different available source revision creates a new reminder. Deleted skills and retired agents leave the pending counts. Paused agents and skills assigned to paused agents remain included.

## Default agent instructions

Detection compares saved seeded roles against the defaults shipped in the running app; it makes no network request. Custom user-created roles have no upstream default. The existing exact-revision review, customization comparison, explicit adoption and **Keep mine** decisions remain in place. Direct review links use `/crew?review=<role-id>` and put the instruction comparison first in settings. `/crew?updates=true` limits cards to pending updates. See [default instruction updates](roles.md#default-instruction-updates).

## Imported skills

The mounted workspace shell requests automatic checks when opened, then when the next daily check is due. The daemon enforces a 24-hour interval per imported skill and deduplicates simultaneous clients, so browser tabs and Electron share one check. Closing every renderer stops scheduling; a daemon running as a login service alone does not check sources. Adding an imported skill makes it eligible without waiting for an existing batch's interval. Checks never launch an agent or apply instructions.

**Check now** in Skills or Settings > General checks all saved imported skills immediately and shows a result toast. **Check skills automatically** in General defaults on and is a workspace preference shared by both renderers. Disabling it leaves manual checks available. Skills without registry provenance, including bundled Markdown-only skills, have no upstream check.

Checks reuse the bounded public GitHub reader used by skills.sh imports: no credentials, redirects, repository installation or execution. One sweep shares each repository's resolved HEAD and cached immutable blobs, has a three-minute deadline and aborts on shutdown. All routes require the user session and same-origin checks; there is no agent gateway equivalent.

An available version is defined by its repository, file path and blob SHA relative to the saved import source. Local edits alone never count as an upstream update. Manual per-skill reviews also refresh the shared check result. A review shows the current saved text against the fetched upstream version. **Replace with upstream version** explicitly replaces the saved name, description and instructions, including local edits; assignments stay as saved and future runs use the new text. Nothing merges automatically. The existing ten-minute exact-preview approval and concurrent-edit checks remain enforced.

**Keep mine** dismisses that exact upstream version without changing the skill. Closing a review leaves its reminder pending. Skill review links use `/skills?skill=<uuid>&review=true`; `updates=true` is independent of the existing assignment `filter`. Selecting another skill clears the review request. Dismissed versions can still be reviewed from Updates.

## Persistence and failures

`skill-updates.json` in the data directory stores the automatic preference, per-skill source identities, check/success times, known latest versions and version-specific dismissals. It does not store fetched instruction bodies or append maintenance events to the board. Writes replace the preference file atomically. Snapshots include only metadata for current, undeleted skill sources; applying a version or changing its import source invalidates the old notice. Check state and in-flight progress participate in the snapshot revision without reading skill projections during unchanged polls.

Background failures are quiet. They preserve known available versions, dismissals and the last successful check time; Skills shows **Couldn’t check** and retains its badge. The failed attempt counts toward the daily interval; **Check now** can retry immediately. An unreadable cache can be reconstructed on the next check. Offline daemon requests back off rather than spinning.

Regression coverage includes HTTP authorization, daily throttling, shared request deduplication, repository HEAD reuse, restart persistence, new-version rediscovery, stale/deleted skill results, offline recovery, snapshot invalidation and exact-preview adoption. Headless browser checks cover notification-to-review navigation, read-state independence, dismissal, replacement, direct instruction comparisons, filters, collapsed/mobile badges, settings persistence and failed manual checks.
