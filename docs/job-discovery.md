# Job discovery

Pitchcrew can watch public company job boards on Greenhouse, Ashby, Lever, Comeet and Workable. A scan reads each board you saved, keeps the postings that pass your filters and adds new ones to Board as leads. Scout can run the same scan from chat or a routine when you give it permission. You can also add one job from its posting link.

## Add a source

Open **Settings > Job sources** and choose **Add source**.

1. Pick the provider.
2. Enter the company name. It becomes the company on each new card.
3. Enter the board name, or paste the company's public board link. The board name is the part after the provider's domain, for example `examplelabs` in `jobs.lever.co/examplelabs`. Comeet needs two values instead; see below.
4. Optionally set filters.
5. Choose **Test source** to see the first 25 matching postings and which ones are already on the board. Testing creates no cards and saves nothing.
6. Choose **Save source**.

Board names may contain letters, numbers, hyphens and underscores, up to 80 characters. Ashby board names may also hold single dots and spaces between those, such as `example.io` or `Northwind Labs`. A pasted Ashby link writes a space as `%20`; Pitchcrew turns that back into a space and rejects other escapes. The request sends the space as `%20` again. You can save up to 25 sources. Each provider and board name pair can be saved once. Pause a source to keep it without scanning it. Removing a source keeps the leads it found.

### Workable

The board name is the company's Workable account name. It is the part after `apply.workable.com/` in the jobs link, for example `examplelabs` in `apply.workable.com/examplelabs`. Pasting that link, a job link such as `apply.workable.com/examplelabs/j/3F2A1B0C9D`, or an older `examplelabs.workable.com` link fills it in. A short job link such as `apply.workable.com/j/3F2A1B0C9D` does not name the account, so open the company's jobs page instead.

### Comeet

A Comeet source needs the company UID and the careers token.

- **Company UID.** A short code with one dot, such as `A1.B2C`. It is in the company's Comeet jobs link, for example `comeet.com/jobs/examplelabs/A1.B2C`. Pasting that link, or a job link under it, fills in the UID.
- **Careers token.** Companies that show Comeet jobs on their own careers page load them with a public token. Open that careers page, view the page source and search for "token". It usually sits in an embedded Comeet link such as `comeet.co/jobs/{uid}/{position}/apply?token=...&embedded=true`. The token holds letters, numbers, hyphens or underscores, 8 to 128 characters.

Pasting that embedded link, or a Comeet careers API link (`comeet.co/careers-api/2.0/company/{uid}/positions?token=...`), into either field fills in both values. In an embedded link the first code after `/jobs/` is the company UID and the second is a position.

The token is public, not a password, but Pitchcrew still treats it with care. It is saved only in `job-sources.json`, returned only to the local UI session, and kept out of card provenance, board events, agent tool results and error messages. Posting URLs with a token query parameter, including encoded or differently capitalized names, are discarded; source-token echoes in posting text are redacted. A company can change its token; a scan then fails with "Comeet did not accept the company UID and token" until you paste the new one. Changing the token clears the old scan status so agents can test the updated source immediately.

## Add a job from a link

In **Add job**, paste a posting link in **Job post URL** and choose **Fetch from link**. Pitchcrew reads that one posting and fills in the company, title, location, salary, link and full description. Check the details, change anything you like, then choose **Add job**. Nothing is saved until you do. Saving waits until a fetch finishes. Editing the link cancels its lookup and clears its duplicate notices and provenance, so a delayed response cannot replace the new link. Edits you make to other fields while the fetch is pending are preserved when it finishes. If you fetch another job, missing fields clear unchanged values from the previous posting while retaining your manual edits.

These links work:

| Provider   | Link                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Greenhouse | `boards.greenhouse.io/{board}/jobs/{id}` or `job-boards.greenhouse.io/{board}/jobs/{id}`                   |
| Greenhouse | `boards.greenhouse.io/embed/job_app?for={board}&token={id}` and `boards.greenhouse.io/{board}?gh_jid={id}` |
| Greenhouse | A company careers page with both `gh_jid={id}` and `for={board}` in the link                               |
| Ashby      | `jobs.ashbyhq.com/{board}/{id}`, with or without `/application`                                            |
| Lever      | `jobs.lever.co/{board}/{id}`, with or without `/apply`                                                     |
| Comeet     | `www.comeet.com/jobs/{company-name}/{company UID}/{title}/{position UID}`                                  |
| Comeet     | `www.comeet.co/jobs/{company UID}/{position UID}?token=...`, with or without `/apply`                      |
| Workable   | `apply.workable.com/{account}/j/{shortcode}`, with or without a trailing `/` or `/apply`                   |

Links must start with `https://` and contain no user information or explicit port. Repeated job or board identifiers and conflicting Greenhouse job IDs are rejected. Tracking parameters and fragments are ignored. An Ashby board name may hold dots, and spaces written as `%20`, such as `jobs.ashbyhq.com/Northwind%20Scientific/{id}`. Any other `%` escape, `..` segment or double slash is rejected, for every provider. Comeet company and position UIDs look like `A1.B2C`; an office-specific position link such as `A1.00D-B3.C4D` identifies the base posting `A1.00D`. Workable shortcodes are 8 to 12 uppercase letters and digits. A short Workable link such as `apply.workable.com/j/{shortcode}` does not name the account, so it is not recognized. A company careers page that only has `gh_jid` or `ashby_jid` does not name the board, so it is not recognized. Open the job on the provider's own page and paste that link. Greenhouse and Lever EU links are not supported yet.

Comeet's API needs the company's careers token, and a hosted Comeet link does not contain it. Pitchcrew uses the token of your saved Comeet source with the same company UID. Without one, the form says "Add this company as a Comeet source in Settings > Job sources to fetch its postings." and nothing is fetched. An embed link that carries `token=` works without a saved source: Pitchcrew uses that token for this one lookup and does not save it. The token never appears in the form, the saved card, board events or error messages.

When a link is not recognized or the posting cannot be read, the form says why and stays as it was, so you can fill it in by hand.

The company comes from your saved job source for the same board, then from the provider (Greenhouse, Comeet and Workable name the company), and otherwise from the board name. If the job may already be on the board, the form lists the matching cards before you save. It uses the same duplicate check as scans, plus the company and title check used when you register an external application.

A job saved from a link gets the same provenance as a discovered lead: provider, board name, job ID and first-seen time, with "link" as its source. Its job ID becomes the card's job identifier. Later scans of that board skip it. The card details show "Added from a Greenhouse link", with the provider's name. If you change the link after fetching, the job is saved without provenance, like a job you typed in. With **Already applied outside Pitchcrew** checked, the fetched job ID fills in the job identifier instead.

Agents have no lookup tool and still cannot fetch links.

## Filters

Filters use case-insensitive keyword matching. Separate keywords with commas.

- **Title includes any of.** Keeps postings whose title contains at least one keyword. Empty keeps every title.
- **Title excludes.** Drops postings whose title contains any keyword.
- **Location includes any of.** Keeps postings whose location contains at least one keyword. Empty keeps every location.
- **Remote postings only.** Keeps postings the provider marks remote (Ashby `isRemote` or `workplaceType`, Lever `workplaceType`, Comeet `location.is_remote` or `workplace_type`, Workable `telecommuting` or `workplace`) or whose location contains the word "remote". Greenhouse has no remote field, so only the location text counts there.

Each list holds up to 20 keywords of up to 60 characters.

## Scan

Choose **Scan now** in Settings, or let an agent scan. A scan reads every enabled source and returns a summary:

- **New.** Postings added as lead cards.
- **Duplicate.** Postings already on the board.
- **Filtered.** Postings that did not pass the filters, or were missing a usable title or job ID.
- **Deferred.** New postings above the limit of 50 new leads per scan. The next scan adds them.
- **Failed sources.** Sources that could not be read, with the reason.

Each new card holds the company, title, location, salary when the provider publishes it, the posting URL, the plain-text description and the provider's job ID as the card's job identifier. It also records where it came from: provider, source ID and name, board name (the company UID for Comeet), job ID, first-seen time and the provider's publish time. Comeet publishes no posting date, so its last update time is recorded instead. The card details show "Found on" with the source and date.

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

The daemon is the only part that calls the providers. It uses five fixed endpoint templates:

| Provider   | Request                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true`                     |
| Ashby      | `GET https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true`           |
| Lever      | `GET https://api.lever.co/v0/postings/{board}?mode=json`                                       |
| Comeet     | `GET https://www.comeet.co/careers-api/2.0/company/{uid}/positions?details=true&token={token}` |
| Workable   | `GET https://apply.workable.com/api/v1/widget/accounts/{account}?details=true`                 |

- Only the validated board name, or the Comeet company UID and token, change. The daemon rebuilds the URL and rejects it unless the origin, path and query match the template exactly.
- Workable also has a newer jobs API, but it uses POST. Pitchcrew keeps to the GET widget API.

A link lookup makes one request. Greenhouse and Lever have a single-posting endpoint. For Ashby, Comeet and Workable, Pitchcrew reads the board endpoint above, built the same way as for a scan, and picks the posting by ID.

| Provider   | Request                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?content=true` |
| Lever      | `GET https://api.lever.co/v0/postings/{board}/{id}?mode=json`                   |

- For a lookup, only the validated board name, job ID and, for Comeet, token change. Greenhouse job IDs are digits; Ashby and Lever job IDs are UUIDs. The same exact template check applies. The pasted link itself is never fetched.
- Requests are GET only, without credentials or cookies, and do not follow redirects.
- Each request sends the user agent `Pitchcrew/0.1.0 (local job discovery; read-only; +https://github.com/HitBox38/PitchCrew)`.
- Each request has a 20-second timeout. A whole scan stops after three minutes and reports the remaining sources as failed.
- Responses must be JSON and at most 8 MB. Pitchcrew reads the first 2,000 postings per board.
- Requests to the same provider start at least one second apart. Different providers run in parallel. Queued requests stop immediately when the scan is cancelled or reaches its deadline.
- Link lookups share the same limits and spacing as scans. A lookup stops after one minute, including time spent waiting behind a running scan, or when you close the form.

Sources paused, removed or edited while a scan is fetching are skipped before any leads are saved. Agent discovery permission and the active run are rechecked after the fetch, immediately before recording leads.

Descriptions are converted to plain text with a single pass over the markup. Pitchcrew never renders or runs the HTML and never fetches links, images or other resources in it. Script, style, iframe and similar blocks are dropped with their contents, and link targets are discarded. Descriptions are capped at 20,000 characters. Job posts stay untrusted data for agents.

### Fields read

| Provider | Job ID      | Title   | Location                                                      | Posting URL                                                           | Description                                     | Date                         |
| -------- | ----------- | ------- | ------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- |
| Comeet   | `uid`       | `name`  | `location.name`, or `city`, `state` and `country`             | `url_comeet_hosted_page`, `url_active_page`, then `url_detected_page` | `details` sections (`name`, `value`) by `order` | `time_updated`               |
| Workable | `shortcode` | `title` | `city`, `state` and `country`, plus visible `locations` items | `url`, then `shortlink`                                               | `description`, `requirements` and `benefits`    | `published_on`, `created_at` |

Comeet positions marked `is_internal` are skipped. Comeet lists a position published to several offices once per office, with IDs such as `A1.00D` and `A1.00D-B3.C4D`. Workable repeats a job once per location with the same `shortcode`. Pitchcrew merges each set into one posting and keeps the base ID even when only office copies remain. Hosted Comeet office links also use the base ID, so later scans keep the same application identity. If the preferred copy omits its description or date, another copy supplies it. Combined locations retain the card's 120-character limit. A posting link must be `http` or `https` with no user name or password; otherwise Pitchcrew uses the provider's hosted page (`apply.workable.com/{account}/j/{shortcode}/` for Workable, a `comeet.com/jobs/...` page built from the company UID and position UID for Comeet). Comeet links that point at the careers API are never used. Neither API publishes salary, so the salary stays empty.

The field mappings follow the official [Comeet position reference](https://developers.comeet.com/reference/retrieve-a-position-new) and [Workable public jobs reference](https://workable.readme.io/reference/jobs-1). Workable's documented `www.workable.com/api/accounts/{account}` endpoint redirects to the fixed widget endpoint above; Pitchcrew calls that destination directly to keep redirects disabled.

The Lever EU host (`api.eu.lever.co`), Greenhouse EU boards and other ATS providers are not supported yet.

## Storage and events

Sources live in `job-sources.json` in the data directory, written atomically with owner-only permissions. They are user settings, like `profile-sources.json`, and hold no credentials. A Comeet source adds a `token` field; files saved before Comeet and Workable load without changes. Only the local UI session can call the source routes (`GET`, `POST /api/job-sources`, `PUT` and `DELETE /api/job-sources/:id`, `POST /api/job-sources/preview` and `POST /api/job-sources/scan`) and the link lookup route, `POST /api/jobs/lookup`. A lookup takes `{ "url": "..." }` and returns `found` with the form values, provenance and possible duplicates, or `unrecognized` or `failed` with a reason. It creates nothing.

Discovered cards are ordinary board events. Event version 10 adds the card `discovery` provenance and the optional `discoverJobs` capability. New events use version 11, which adds learning signals. Versions 1 through 10 remain decodable and replayable. Comeet and Workable add two `discovery.provider` values without a new event version: no stored event changes, and decoding never checked the provider. Jobs saved from a link reuse the version 10 `discovery` shape with `sourceId` set to `link` and the board name as `sourceName`, so they need no new event version. `POST /api/cards` accepts an optional `provenance` (provider, board name, job ID and publish time), checked against the same board name and job ID patterns.

## Verification

Tests use recorded fictional responses for all five providers and a mocked fetch, with no network access. They cover the parsers (including missing optional fields and merged office copies), HTML conversion, filters, board name, company UID and token validation, URL construction, token redaction, loading older source files, size and timeout limits, rate limiting, duplicate handling including withdrawn cards, the per-scan cap, the HTTP session boundary, capability gating over the daemon and actual MCP stdio, a routine-started scan and event replay. Link tests cover recognition for each provider, including Ashby names with dots and `%20` spaces, Comeet hosted and embed links and Workable links, and rejected hosts, IDs, user info, ports, non-https links, percent escapes and path traversal; Comeet lookups with and without a saved source and with an embed token, with the token kept out of results, errors, cards and events; lookups from recorded single postings; size, timeout and cancellation; duplicate warnings; the HTTP session boundary; and that a saved fetched job stops a later scan from adding it again.
