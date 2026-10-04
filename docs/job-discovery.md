# Job discovery

Pitchcrew can watch public company job boards on Greenhouse, Ashby and Lever. A scan reads each board you saved, keeps the postings that pass your filters and adds new ones to Board as leads. Scout can run the same scan from chat or a routine when you give it permission.

## Add a source

Open **Settings > Job sources** and choose **Add source**.

1. Pick the provider.
2. Enter the company name. It becomes the company on each new card.
3. Enter the board name, or paste the company's public board link. The board name is the part after the provider's domain, for example `examplelabs` in `jobs.lever.co/examplelabs`.
4. Optionally set filters.
5. Choose **Test source** to see the first 25 matching postings and which ones are already on the board. Testing creates no cards and saves nothing.
6. Choose **Save source**.

Board names may contain letters, numbers, hyphens and underscores, up to 80 characters. You can save up to 25 sources. Each provider and board name pair can be saved once. Pause a source to keep it without scanning it. Removing a source keeps the leads it found.

## Filters

Filters use case-insensitive keyword matching. Separate keywords with commas.

- **Title includes any of.** Keeps postings whose title contains at least one keyword. Empty keeps every title.
- **Title excludes.** Drops postings whose title contains any keyword.
- **Location includes any of.** Keeps postings whose location contains at least one keyword. Empty keeps every location.
- **Remote postings only.** Keeps postings the provider marks remote (Ashby `isRemote` or `workplaceType`, Lever `workplaceType`) or whose location contains the word "remote". Greenhouse has no remote field, so only the location text counts there.

Each list holds up to 20 keywords of up to 60 characters.

## Scan

Choose **Scan now** in Settings, or let an agent scan. A scan reads every enabled source and returns a summary:

- **New.** Postings added as lead cards.
- **Duplicate.** Postings already on the board.
- **Filtered.** Postings that did not pass the filters, or were missing a usable title or job ID.
- **Deferred.** New postings above the limit of 50 new leads per scan. The next scan adds them.
- **Failed sources.** Sources that could not be read, with the reason.

Each new card holds the company, title, location, salary when the provider publishes it, the posting URL, the plain-text description and the provider's job ID as the card's job identifier. It also records where it came from: provider, source ID and name, board name, job ID, first-seen time and the provider's publish time. The card details show "Found on" with the source and date.

### Duplicates

Pitchcrew compares every posting with every card on the board, in any state, including withdrawn and rejected cards. A posting is a duplicate when any of these match:

- the same provider, board name and job ID on a card created by discovery;
- the same canonical job URL (tracking parameters and fragments removed);
- the same job identifier on a card for the same company.

Dismiss a lead by moving it to withdrawn. Later scans skip it. Only one scan runs at a time, and the duplicate check and card creation happen in one board transaction.

## Agents and routines

The `discoverJobs` capability is off for every role, including the default Scout. Turn it on in the role's settings under **Role tools**. With it, the role gets two MCP tools:

| Tool                         | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `pitchcrew_list_job_sources` | Read saved sources: ID, name, provider, filters, enabled state, last scan |
| `pitchcrew_scan_job_sources` | Scan enabled sources, or saved `sourceIds`, and return the summary        |

The scan result includes each new lead's card ID, company, title, location, URL and a description excerpt of up to 1,500 characters. Agents cannot add, edit or remove sources, change filters or pass a URL. The input accepts only saved source IDs. The daemon checks the capability, the role's enabled state and the run on every call, so turning the capability off stops the next call. Agent scans skip a source that was scanned successfully in the last 15 minutes.

The default Scout instructions say to scan when discovery is enabled, then give a short fit read for each new lead and notify you about strong matches. New leads stay leads until you shortlist them. Workspaces created before this change keep their existing Scout instructions; edit them in Crew if you want the same behavior.

To scan on a schedule, enable `discoverJobs` for Scout and add a routine on `/routines`, for example "Scan my job sources and assess new leads" every four hours. Routines run only while the daemon is open; see [routines](routines.md). Each routine run is an ordinary Scout chat turn that calls the scan tool.

## Network and safety

The daemon is the only part that calls the providers. It uses three fixed endpoint templates:

| Provider   | Request                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true`           |
| Ashby      | `GET https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true` |
| Lever      | `GET https://api.lever.co/v0/postings/{board}?mode=json`                             |

- Only the validated board name changes. The daemon rebuilds the URL and rejects it unless the origin, path and query match the template exactly.
- Requests are GET only, without credentials or cookies, and do not follow redirects.
- Each request sends the user agent `Pitchcrew/0.1.0 (local job discovery; read-only; +https://github.com/HitBox38/PitchCrew)`.
- Each request has a 20-second timeout. A whole scan stops after three minutes and reports the remaining sources as failed.
- Responses must be JSON and at most 8 MB. Pitchcrew reads the first 2,000 postings per board.
- Requests to the same provider start at least one second apart. Different providers run in parallel. Queued requests stop immediately when the scan is cancelled or reaches its deadline.

Sources paused, removed or edited while a scan is fetching are skipped before any leads are saved. Agent discovery permission and the active run are rechecked after the fetch, immediately before recording leads.

Descriptions are converted to plain text with a single pass over the markup. Pitchcrew never renders or runs the HTML and never fetches links, images or other resources in it. Script, style, iframe and similar blocks are dropped with their contents, and link targets are discarded. Descriptions are capped at 20,000 characters. Job posts stay untrusted data for agents.

The Lever EU host (`api.eu.lever.co`), Greenhouse EU boards and other ATS providers are not supported yet.

## Storage and events

Sources live in `job-sources.json` in the data directory, written atomically with owner-only permissions. They are user settings, like `profile-sources.json`, and hold no credentials. Only the local UI session can call the source routes (`GET`, `POST /api/job-sources`, `PUT` and `DELETE /api/job-sources/:id`, `POST /api/job-sources/preview` and `POST /api/job-sources/scan`).

Discovered cards are ordinary board events. Event version 10 adds the card `discovery` provenance and the optional `discoverJobs` capability. Versions 1 through 9 remain decodable and replayable.

## Verification

Tests use recorded fictional responses for all three providers and a mocked fetch, with no network access. They cover the parsers, HTML conversion, filters, board name validation and URL construction, size and timeout limits, rate limiting, duplicate handling including withdrawn cards, the per-scan cap, the HTTP session boundary, capability gating over the daemon and actual MCP stdio, a routine-started scan and event replay.
