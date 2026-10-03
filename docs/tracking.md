# Application tracking

Tracking tools are prerequisites for a future Tracker role. They are usable by any existing configured role; Pitchcrew does not create, enable or schedule a Tracker automatically.

## Permissions and tools

`readApplications` and `trackApplications` are optional capabilities, defaulting to false. Enable application search separately from mutations. Gmail reconciliation needs both capabilities plus `gmail` and a connected Gmail account. The gateway checks the current stored role and active run on each call, including after asynchronous connector reads.

- `pitchcrew_search_applications`: bounded cross-application query (company, title, canonical URL, job identifier or tracked state), up to 50 cards and 100 recent supporting signals per page. Returns an offset for additional pages. The shared `searchApplications` board helper can support future batch reviews.
- `pitchcrew_scan_application_mail`: searches a Gmail query in pages of 20 IDs and saves a durable role/mailbox/query checkpoint. A pending page must be reconciled before the next page can be fetched. Connector failures leave it pending. An incomplete sweep resumes its saved page token; requesting a completed sweep starts again at the first page to find new mail. Mailbox/message IDs deduplicate across sweeps, roles and queries. Rebuild and restart preserve checkpoints.
- `pitchcrew_reconcile_application_mail`: the gateway fetches a pending Gmail message through the connected read-only connector. Agents supply an exact quotation and suggested company, title and state; message identity, account, thread and effective timestamp come from the fetched source, not agent assertions. An optional reason records an unrelated message as ignored without changing an application. Completed signals and scan-message consumption are transactional and idempotent.

Use normal routines to schedule scans. They run only while the daemon is open and retain current role capabilities; there is no OS background runner. Agents should finish a page or describe unfinished pending IDs, rather than claiming the entire mailbox was reviewed.

## Reconciliation and review

Automatic updates require exactly one stable source match: an exact canonical job URL, a labeled job/requisition identifier, or a Gmail thread explicitly linked by the user to the application and account. New URL/identifier matches also require company and title in the fetched message. Company alone or company/title alone never authorizes an update. Stable source identity can distinguish multiple applications with the same company and title. URL canonicalization removes fragments and known tracking parameters while retaining job-identifying query parameters.

The server recognizes a small conservative set of explicit English submission, screening, interview, offer and rejection phrases. Both the quotation and full fetched body must agree. Negative, conflicting and quoted conversation text, unsupported language, truncated bodies and snippet-only sources require review. These checks are mechanical, not a semantic guarantee; agents must still treat emails as untrusted data.

Signals save the exact quotation, bounded fetched text, incompleteness flag, source sender/subject/message/thread IDs, effective timestamp, proposed state, candidate identities and comparison revisions. Uncertain matches produce pending records and an attention message. The Board shows pending reviews and an expandable full fetched email. Users can reject a signal, select its exact application and apply a valid transition, or register a missing external application first and explicitly associate it. Applying a user review links its Gmail thread for future updates. Changed cards require refreshing the saved comparison before approval. Card details show recent evidence and let the user edit job identifiers and link or unlink Gmail threads.

All updates obey the existing state machine and reject active workflow ownership, older effective timestamps and conflicting evidence at the same timestamp. User status changes set a separate effective-time boundary; unrelated packet edits do not advance it. Legacy cards derive the last user status change from retained, paged event history. A user-reviewed historical email retains its verified source time. Rejected or ignored signals remain processed; decisions do not automatically retry or overwrite history.

## External submissions

The Add job form includes **Already applied outside Pitchcrew**. Users supply a past submission time, optional job identifier and confirmation note. Registration atomically saves a submitted card with external provenance and no packet. It prevents likely duplicates by normalized company/title and canonical URL or job identifier, returning matching card IDs for review. Applications at the same company/title with different known URLs can be tracked separately.

Registration only records a known fact. It does not submit, send, navigate, export, invent a receipt or create/consume packet approval. Existing Pitchcrew packet/export/submission gates remain intact. Agents have no external-registration or tracking-decision tool.

For a job already on the board, card details include **Already applied outside Pitchcrew?**. This explicit user-only import records the known external submission on that same card, avoiding a duplicate. It rejects active workflow ownership, retains the prior packet and history without identifying that packet as submitted, invalidates unused packet approvals, and marks external provenance and the provided effective time. It is a narrow fact-registration operation rather than a generic workflow transition. Ordinary moves and automatic email reconciliation into `submitted` still require a successfully exported current packet.

## Persistence and verification

Version 9 adds `tracking_signal`, `tracking_scan`, card tracking metadata, user status effective times and the two optional capabilities; versions 1–8 remain replayable. The database remains behind board transactions and append-only events. Tracking metadata, email context and credentials remain outside the repository; credentials never enter events or snapshots.

Tests use fictional mail and temporary workspaces: actual HTTP and MCP stdio envelopes, normalized Gmail payloads, duplicate registration, stable matching, ambiguous/no-candidate review, full-source negation, quoted conversations, monotonic user corrections, legacy history pagination, equal-time conflicts, failed reads, capability revocation during reads, replay, repeated sweeps and global message deduplication. Live mailbox behavior and provider inference are not tested.
