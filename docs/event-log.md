# Event log

Rules for contributors and coding agents. If a change makes anything here false, update this file in the same change.

New events use the current version (`currentEventVersion` in `packages/core/src/events.ts`). Every earlier version stays decodable; never rewrite or delete stored events.

- **Event log.** Version 36 adds optional chat_request submission UUID/digest receipts; versions 1–35 remain decodable.
- Version 35 adds the optional user-owned skill includeInEveryRun delivery setting; absent historical settings mean full inclusion and versions 1–34 remain decodable.
- Version 34 adds `delegation_round` entities and optional `roundId`/`roundPart` fields on tasks; versions 1–33 remain decodable.
- Version 33 adds user-requested AI-text detector advisories on cards, each bound to the SHA-256 digest of the checked document.
- Version 32 adds Reviewer packet summaries and Writer revision notes, each bound to the exact packet digest.
- Version 31 binds browser action approvals to explicit session-owned tabs.
- Version 30 records separate user-approved task browsing grants.
- Version 29 adds exact browser hover, scroll and drag approvals; versions 1–28 remain decodable.
- Version 28 binds confirmed application form requirements and manual-inspection choices to packets.
- Version 27 adds advisory packet-to-job ratings and whole-packet reevaluation requests; versions 1–26 remain decodable.
- Version 25 adds writing guides, chat correction evidence and career plans; versions 1–24 remain decodable, including prerelease v24 quality records.
- Version 24 adds persistent job/standalone queue ordering, pause state and workspace capacity settings.
- Version 15 adds conversations, delivery requests, agent memory and native session checkpoints; versions 1–14 remain decodable without rewriting history.
- Version 14 adds optional user chat attachment metadata; attachment bytes remain in the data directory, outside events.
- Versions 1 through 13 remain decodable and replayable.
- Version 13 adds optional role default reasoning and effective chat overrides in run configuration snapshots; versions 1 through 12 remain decodable and replayable.
- Version 12 adds optional user-reviewed role `defaultInstructionBase` revision and exact source text; versions 1 through 11 remain decodable and replayable.
- Version 11 adds optional user-only card `weight` and `lessons` fields; absent fields mean weight 0 and no lessons.
- Comeet and Workable widen the card `discovery.provider` values without a new version; older events keep their values.
- Tag merges and stale-submission marks use ordinary card events.
- Version 10 adds card job-discovery provenance and the optional `discoverJobs` capability.
- Versions 1 through 10 remain decodable and replayable, including prerelease version 10 learning snapshots, without rewriting history.
- Version 9 adds configurable role identities, explicit workflow seats, retirement, profile-maintenance proposals, tracking signals/checkpoints, form assessments, submission attempts, frozen artifact manifests, pipeline reviews, run configuration snapshots and opt-in profile/application/submission/review capabilities.
- Versions 1 through 8 remain decodable and replayable.
- Version 8 adds routine events, scheduled-run metadata and the optional routine-management capability; versions 1–7 remain decodable and replayable.
- Version 7 adds optional message notification priority; versions 1–6 remain decodable and replayable.
- Version 6 adds computer-use capability and browser action approvals; versions 1–5 remain decodable and replayable.
- Version 5 added skill provenance and skill proposals.
- Version 4 added managed skills and version 3 added optional connector capabilities.

Every card, role, skill, skill proposal, run, approval, computer approval, message, role proposal, task and routine update appends a versioned event and changes its projection atomically. Rebuild replays events in order.
