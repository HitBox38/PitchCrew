# Application tracking

Tracker is a default crew member with application search, tracking and routine-management tools configured. Production defaults start paused; connect Google and enable Gmail for Tracker before scanning. No tracking schedule is seeded. The same tools remain available to any user-configured role.

## Permissions and tools

`readApplications` and `trackApplications` are optional capabilities, defaulting to false. Enable application search separately from mutations. Gmail reconciliation needs both capabilities plus `gmail` and a connected Gmail account. The gateway checks the current stored role and active run on each call, including after asynchronous connector reads.

- `pitchcrew_search_applications`: bounded cross-application query (company, title, canonical URL, job identifier or tracked state), up to 50 cards and 100 recent supporting signals per page. Returns an offset for additional pages. The shared `searchApplications` board helper can support future batch reviews.
- `pitchcrew_scan_application_mail`: searches a Gmail query in pages of 20 IDs and saves a durable role/mailbox/query checkpoint. A pending page must be reconciled before the next page can be fetched. Connector failures leave it pending. An incomplete sweep resumes its saved page token; requesting a completed sweep starts again at the first page to find new mail. Mailbox/message IDs deduplicate across sweeps, roles and queries. Rebuild and restart preserve checkpoints.
- `pitchcrew_reconcile_application_mail`: the gateway fetches a pending Gmail message through the connected read-only connector. Agents supply an exact quotation and suggested company, title and state; message identity, account, thread and effective timestamp come from the fetched source, not agent assertions. An optional reason records an unrelated message as ignored without changing an application. Completed signals and scan-message consumption are transactional and idempotent.
- `pitchcrew_application_insights`: read-only outcome counts, tag scoreboard, weights and user lessons. It also works with `reviewPipeline`. See [insights](insights.md).

Use normal routines to schedule scans. They run only while the daemon is open and retain current role capabilities; there is no OS background runner. Agents should finish a page or describe unfinished pending IDs, rather than claiming the entire mailbox was reviewed.

## Reconciliation and review

Automatic updates require exactly one stable source match: an exact canonical job URL, a labeled job/requisition identifier, or a Gmail thread explicitly linked by the user to the application and account. New URL/identifier matches also require company and title in the fetched message. Company alone or company/title alone never authorizes an update. Stable source identity can distinguish multiple applications with the same company and title. URL canonicalization removes fragments and known tracking parameters while retaining job-identifying query parameters.

The server recognizes a small conservative set of explicit English submission, screening, interview, offer and rejection phrases. Both the quotation and full fetched body must agree. Negative, conflicting and quoted conversation text, unsupported language, truncated bodies and snippet-only sources require review. These checks are mechanical, not a semantic guarantee; agents must still treat emails as untrusted data.

Signals save the exact quotation, bounded fetched text, incompleteness flag, source sender/subject/message/thread IDs, effective timestamp, proposed state, candidate identities and comparison revisions. Uncertain matches produce pending records and an attention message. The Board shows pending reviews and an expandable full fetched email. Users can reject a signal, select its exact application and apply a valid transition, or register a missing external application first and explicitly associate it. Applying a user review links its Gmail thread for future updates. Changed cards require refreshing the saved comparison before approval. Card details show recent evidence and let the user edit job identifiers and link or unlink Gmail threads.

All updates obey the existing state machine and reject active workflow ownership, older effective timestamps and conflicting evidence at the same timestamp. User status changes set a separate effective-time boundary; unrelated packet edits do not advance it. Legacy cards derive the last user status change from retained, paged event history. A user-reviewed historical email retains its verified source time. Rejected or ignored signals remain processed; decisions do not automatically retry or overwrite history.

To close out silent applications, use **Insights > Silent applications**. It previews submitted jobs with no status change for a chosen number of days (21 by default) and marks only the ones you confirm as no response, effective from the day the silence period ended. Later replies can still move them forward. It never runs automatically. See [insights](insights.md).

## External submissions

The Add job form includes **Already applied outside Pitchcrew**. Users supply a past submission time, optional job identifier and confirmation note. **Fetch from link** fills in the job identifier from a supported posting link; see [job discovery](job-discovery.md#add-a-job-from-a-link). Registration atomically saves a submitted card with external provenance and no packet. It prevents likely duplicates by normalized company/title and canonical URL or job identifier, returning matching card IDs for review. Applications at the same company/title with different known URLs can be tracked separately.

Registration only records a known fact. It does not submit, send, navigate, export, invent a receipt or create/consume packet approval. Existing Pitchcrew packet/export/submission gates remain intact. Agents have no external-registration or tracking-decision tool.

For a job already on the board, card details include **Already applied outside Pitchcrew?**. This explicit user-only import records the known external submission on that same card, avoiding a duplicate. It rejects active workflow ownership, retains the prior packet and history without identifying that packet as submitted, invalidates unused packet approvals, and marks external provenance and the provided effective time. It is a narrow fact-registration operation rather than a generic workflow transition. Ordinary moves and automatic email reconciliation into `submitted` still require a successfully exported current packet.

## Importing past applications

Use **Import applications** on Board to bring in applications from an older tracker. Import is user-only: it needs the local UI session, and agents have no import tool. It records known facts. It does not submit, send, export or create packets or approvals.

### Steps

1. Choose a `.json` or `.csv` file. The daemon parses and checks it; nothing is saved yet.
2. Review the preview. Each row is **New**, **Duplicate**, **Already imported** or **Invalid**, with the reason and any warnings.
3. Confirm. Only new rows are saved. The result lists every row as **Imported**, **Duplicate**, **Already imported**, **Invalid** or **Failed**.

Confirming sends the same file again with the preview digest. If the file changed, preview it again. Each row commits on its own, so one failed row does not block the rest.

### Limits

- Up to 1,000 rows and 2 MB per file.
- Up to 100 history entries per row.
- Notes up to 4,000 characters, lessons up to 2,000 and each history note up to 1,000. The combined card note is cut at 6,000 characters with a warning.
- Cards keep at most 10 tags of 40 characters. Longer tags are shortened and extra tags are dropped, with a warning.

### Format

JSON is an array of objects. CSV has a header row with the same column names (any letter case) and one application per line. Only `company` and `state` are required.

| Field           | Meaning                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `company`       | Company name.                                                                                                                     |
| `title`         | Role title. An empty title becomes "Untitled role" with a warning.                                                                |
| `titleDerived`  | `true` when a converter guessed the title, for example from a folder name. The preview flags it.                                  |
| `attempt`       | Try number, default 1. A later try gets "(try 2)" in its title so it stays a separate card.                                       |
| `location`      | Optional location.                                                                                                                |
| `url`           | Optional HTTP or HTTPS job URL.                                                                                                   |
| `jobIdentifier` | Optional job or requisition ID.                                                                                                   |
| `state`         | `lead`, `shortlisted`, `draft`, `ready`, `submitted`, `screening`, `interviewing`, `offer`, `rejected`, `withdrawn` or `ghosted`. |
| `submittedAt`   | Submission date. Optional when the row never reached submission, or when history has a `submitted` entry.                         |
| `statusAt`      | Optional date of the final state, used when history does not include it.                                                          |
| `history`       | Ordered list of `{ "state", "at", "note" }`. In CSV, `state@date` entries separated by `;`, without notes.                        |
| `tags`          | JSON array, or `;`-separated in CSV.                                                                                              |
| `notes`         | Free text kept in the card note.                                                                                                  |
| `weight`        | Optional weight from -2 to 2, saved as a learning signal and retained in the card note.                                           |
| `lessons`       | Optional lessons, saved as bounded learning notes and retained in the card note.                                                  |

Dates are either `2025-03-01` (read as midnight UTC) or a date and time with a timezone, such as `2025-03-01T09:00:00Z` or `2025-03-01T11:00:00+02:00`. Future dates make the row invalid.

```json
[
  {
    "company": "Fictional Labs",
    "title": "Frontend Engineer",
    "state": "rejected",
    "submittedAt": "2025-01-02T09:00:00Z",
    "history": [
      { "state": "submitted", "at": "2025-01-02T09:00:00Z" },
      { "state": "ghosted", "at": "2025-02-01T00:00:00Z", "note": "No reply." },
      { "state": "rejected", "at": "2025-02-10T00:00:00Z" }
    ],
    "tags": ["remote"],
    "notes": "Referred by a friend.",
    "weight": 1
  }
]
```

```csv
company,title,state,submittedAt,history,tags
Example Works,Data Analyst,interviewing,2025-03-01,submitted@2025-03-01;screening@2025-03-08,remote;data
Sample Co,Platform Engineer,draft,,,
```

### Status mapping

- Rows that never reached submission become cards without packets. `draft` and `ready` become `lead`, because the old draft does not come across and the job may have changed; Scout or you should look at it again before shortlisting. `shortlisted` and `withdrawn` are kept.
- Rows that reached `submitted` or later use the same path as **Already applied outside Pitchcrew**: a submitted card with external provenance, the submission time and no packet. A row reached submission if it has `submittedAt`, a submitted-or-later final state, or such a state in its history.
- The card then walks valid transitions from `packages/core/src/states.ts` to the final state. Valid history is followed, with each step effective at its history date, and completed with the shortest valid path when the final state is missing. For example, `offer` without an interview step adds `interviewing`.
- When history has a sequence the board does not allow, such as `ghosted` then `rejected`, the card takes the shortest valid path to the final state. The original history text is kept in the card note and the preview warns about it.
- An imported card keeps the final status date even when its final state is the initial lead or submitted state.
- Effective times never go backward. A step dated earlier than the step before uses the earlier step's date, with a warning. A final state with no date in history or `statusAt` uses the date of the step before, or the import time for a never-submitted row, with a warning. Later Gmail evidence older than the imported final state is rejected as usual.
- The card note starts with "Imported from a past tracker." and keeps notes, `Legacy lessons`, `Legacy weight` and, when needed, `Legacy history`.

### Duplicates and retries

A row is a duplicate when it matches an existing card by the same rule as external registration: normalized company and title, plus a matching or missing URL, or the same job identifier. Rows in the same file are checked against each other too. Duplicates are skipped and never change existing cards, so import never touches a card with active workflow work.

Each row has a stable import key from its parsed content. The key is written in the message of the card's import event. Importing the same file again reports those rows as **Already imported** and saves nothing new. A row whose content changed since the last import matches its card as a duplicate instead.

### Converting a legacy SQLite tracker

`scripts/convert-legacy-tracker.mjs` reads a tracker with `applications`, `status_events`, `tags` and `application_tags` tables and writes a JSON import file:

```sh
node scripts/convert-legacy-tracker.mjs ~/old-tracker.db ~/applications.json
```

The tracker is opened read-only and an existing output file is never overwritten. Without an output path, JSON goes to standard output.

- `role_title` becomes `title`. When it is empty, the last folder of `folder_path` that is not the company name or a try number becomes the title, flagged with `titleDerived`. If nothing is left, the preview shows "Untitled role".
- `attempt` above 1 keeps each try as its own card.
- `applied_at` becomes `submittedAt`. `updated_at` becomes `statusAt` for rows past `ready`.
- `status_events` become `history`, ordered by time. Tags are listed by name.
- `notes`, `lessons_learned` and a non-zero `weight` are carried over.
- Times without a timezone, such as SQLite `CURRENT_TIMESTAMP` values, are read as UTC. The script reports how many it found.

New imports save weight and lessons in the learning fields used by Insights. Lessons longer than 1,000 characters are split into bounded notes without splitting Unicode characters, with a preview warning. Their save timestamps reflect the import time. Original legacy text remains in the tracking note. Previously imported cards and events stay unchanged, and re-importing those rows does not backfill signals.

Review the preview before you confirm.

## Persistence and verification

Version 9 adds `tracking_signal`, `tracking_scan`, card tracking metadata, user status effective times and the two optional capabilities; versions 1–8 remain replayable. Version 10 adds discovery provenance and version 11 adds optional learning signals. New imports append current version 14 card events; versions 1–13 remain replayable, including prerelease learning snapshots. Import keys do not depend on the event version. The database remains behind board transactions and append-only events. Tracking metadata, email context and credentials remain outside the repository; credentials never enter events or snapshots.

Tests use fictional mail and temporary workspaces: actual HTTP and MCP stdio envelopes, CSV and JSON import parsing, import state mapping, idempotent re-import, the legacy converter against a temporary SQLite file, normalized Gmail payloads, duplicate registration, stable matching, ambiguous/no-candidate review, full-source negation, quoted conversations, monotonic user corrections, legacy history pagination, equal-time conflicts, failed reads, capability revocation during reads, replay, repeated sweeps and global message deduplication. Live mailbox behavior and provider inference are not tested.
