# Workflow connectors

Pitchcrew exposes authenticated, read-only GitHub and Google Workspace tools through its existing per-run MCP gateway. They work in role chats, card workflows and bounded crew follow-ups with Claude Code or Codex. Demo remains deterministic and does not call connectors.

Open **Your crew → Connected accounts** or connect from **Profile → Profile sources** to connect an account. Then open each role’s settings and enable the services it needs. Connecting an account never grants all roles access: GitHub, Gmail, Drive/Docs, Calendar and Sheets capabilities default to disabled, including in existing workspaces. Disabled tools are omitted when a run’s MCP server starts, and the daemon checks current role permission on every call. Connecting or disconnecting accounts requires the local UI session; agents cannot do either themselves. Start a new turn after enabling access.

## GitHub

Create a [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for only the repositories your crew should read. Set **Contents: read**, **Issues: read**, and **Pull requests: read** if using PR research. Metadata access is included. Organization approval or SSO policy may limit access. Paste the token into **Connect GitHub**. Pitchcrew validates the account using GitHub’s `/user` endpoint before saving it. Only fixed, read-only REST routes are exposed; there is no arbitrary API request or posting tool.

Examples:

- Ask Scout: “Research the company’s public repositories and compare its stack to this job description.”
- Ask Writer: “Read `README.md` in my connected portfolio repository and suggest evidence I should add to my profile.”
- Ask Reviewer: “Find issues and pull requests in `repo:example/project` that describe the team’s frontend work.”

| Tool                         | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `github_search_repositories` | Search repositories, with page and limit                     |
| `github_list_repositories`   | List repositories accessible to the account                  |
| `github_get_profile`         | Read a user profile                                          |
| `github_search_issues`       | Search issue/PR previews; use `repo:owner/name` to narrow    |
| `github_get_revision`        | Resolve a branch/tag to a commit for consistent source reads |
| `github_read_file`           | Read a text file or directory at an optional Git ref         |

## Google Workspace

1. Create a Google Cloud project and enable **Gmail API**, **Google Drive API**, **Google Sheets API** and **Google Calendar API**.
2. Configure the OAuth consent screen. For a personal testing project, add your Google account as a test user. Gmail and Drive permissions may require Google verification when distributing an app publicly; Workspace admins may also restrict consent.
3. Create an OAuth client with the **Desktop app** type, using [Google’s installed-app setup](https://developers.google.com/identity/protocols/oauth2/native-app). A web client is not interchangeable with a Desktop client.
4. Enter the client ID and client secret in **Connect Google Workspace**, start sign-in, then click **Continue with Google**. Electron opens this link in your system browser. Finish sign-in and return to Pitchcrew; connection status updates automatically.
5. Enable the permitted services in each role’s settings.

Alternatively, set `PITCHCREW_GOOGLE_CLIENT_ID` and `PITCHCREW_GOOGLE_CLIENT_SECRET` in the daemon’s environment before starting it; the connection dialog then uses that configuration. These variables are filtered from provider subprocess environments.

Sign-in uses a temporary callback listener bound only to `127.0.0.1`, random single-use state, S256 PKCE and a ten-minute deadline. Pitchcrew requests offline access and read-only Gmail, Drive, Calendar and Sheets scopes, plus email identity. Declining individual services is supported: only granted scopes can be used. Access tokens refresh automatically; concurrent calls share one refresh. An expired/revoked grant requires reconnection. Google testing-mode grants may expire according to the consent project’s policy.

Examples:

- Ask Scout: “Search recruiter messages from the last month and summarize opportunities related to this role.”
- Ask Writer: “Find my resume Doc in Drive and suggest factual profile updates for this application.”
- Ask Reviewer: “Read `Jobs!A1:F50` in my job tracker and check my Calendar for interviews next week.”

| Tool                          | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `gmail_search_messages`       | Search with Gmail query syntax; returns IDs and a cursor          |
| `gmail_get_message`           | Read headers, snippet and plain-text body without changing labels |
| `gmail_get_thread`            | Read a thread’s messages without changing labels                  |
| `google_drive_search_files`   | Search Drive query syntax; includes shared drives and cursors     |
| `google_drive_get_file`       | Read file metadata                                                |
| `google_drive_read_text_file` | Read small UTF-8 text, Markdown, CSV or JSON files                |
| `google_docs_get_document`    | Export a native Google Doc as plain text                          |
| `google_sheets_read_range`    | Read an explicit bounded A1 range                                 |
| `google_calendar_list_events` | Read events in an explicit time window, with a cursor             |

`pitchcrew_list_connectors` tells agents which tools their role may use and whether the corresponding account is connected. Tool descriptions explain pagination and input syntax. API responses are bounded to 2 MB and tool output to 80,000 characters; narrow the query, page size or range if needed. Binary files, PDFs, Gmail attachments and HTML-only message bodies are not extracted. GitHub issue bodies are previews limited to 3,000 characters. Large threads or documents may exceed the response limit.

## Profile source imports

The Profile page uses these same read-only connections for user-requested imports, independently of role capabilities. A repository folder is read recursively at one resolved commit; a Drive folder is read recursively with pagination, exporting Google Docs as plain text. Drive metadata is checked again after reading each document, and a document that changed while reading requires a new preview. Imported Markdown is copied exactly rather than summarized.

Only the local user session can preview, import or remove sources. The server stages up to three bounded previews for ten minutes; the import request sends the preview token and selected filenames, never replacement content. It rejects filenames outside the snapshot, expired/reused previews, changed source settings and local files edited since preview. Per-source limits are 100 documents, 30 folders, 50,000 characters per document and 1 million characters total, with a two-minute read deadline and at most 20 configured sources. GitHub runtime-instruction files and common runtime/application-output directories are skipped; Drive PDFs, shortcuts and unsupported formats are skipped. No automatic polling or provider writes occur.

Selected documents become ordinary local profile files, so existing exact quotation checks apply. Paths, links, revisions and imported-content hashes are stored in `profile-sources.json` outside the repository and event log. Refresh previews mark local-edit conflicts and preserve removed upstream files. Import serializes profile writes, prevents runs starting during writes and rejects mutation during active runs. Files are replaced atomically one at a time and restored on a failed batch; the batch is not a crash-atomic database transaction. Removing a source deletes its configuration and provenance while keeping local Markdown notes. Disconnecting an account also leaves imported notes intact.

## Credentials, evidence and approvals

Connector credentials live in `PITCHCREW_HOME/connectors/credentials.json`, outside the repository and event log. They are stored locally as JSON, not encrypted; Unix permissions are restricted to the current user (`0700` directory and `0600` file). Protect your data directory with your operating system’s account and disk protections. Credentials are never returned in snapshots, included in prompts, or passed in MCP configuration; agent processes receive only their scoped daemon run token. Disconnect aborts connector requests and deletes the local credential. To invalidate a provider grant/token as well, revoke it in your Google or GitHub account.

Connected account status is read from local state and performs no network requests. The GitHub connection is validated when connecting; Google refresh and authorization errors surface when tools are used. Tests mock service APIs, exercise real local OAuth callbacks and real MCP stdio, and do not access live accounts.

External emails, repository files and documents are untrusted data. They cannot grant permission or change role instructions. Packet claims still require exact quotations from local profile Markdown: users must verify and save external facts in **Your profile** before those facts can support application claims.

These connectors cannot send mail, create drafts, edit files, create calendar events, comment, submit applications or post to GitHub. Adding outward actions requires exact-payload, single-use user approvals checked in gated MCP tools; the existing packet export gate remains unchanged. Event version 3 adds optional connector capabilities, retaining versions 1 and 2 and their replay behavior.
