# Workflow connectors

Pitchcrew exposes authenticated, read-only GitHub and Google Workspace tools through its existing per-run MCP gateway. They work in role chats, card workflows and bounded crew follow-ups with Claude Code or Codex. Demo remains deterministic and does not call connectors.

Open **Settings → Accounts** or connect from **Profile → Profile sources** to connect an account. Then open each role’s settings and enable the services it needs. Connecting an account never grants all roles access: GitHub, Gmail, Drive/Docs, Calendar and Sheets capabilities default to disabled, including in existing workspaces. Disabled tools are omitted when a run’s MCP server starts, and the daemon checks current role permission on every call. Connecting or disconnecting accounts requires the local UI session; agents cannot do either themselves. Start a new turn after enabling access.

## GitHub

Open **Connect GitHub** and choose **Connect with GitHub CLI**. If you already use `gh` and are signed in, that is the only connection step. No Pitchcrew GitHub App registration is required.

For first-time setup, expand **Need to set up GitHub CLI?**:

1. [Install GitHub CLI](https://cli.github.com/) and restart Pitchcrew so the daemon can find `gh` on PATH.
2. In a terminal, run `gh auth login --hostname github.com --web` and follow the browser sign-in prompts.
3. Return to Pitchcrew and choose **Connect with GitHub CLI**. Enable GitHub in the settings of agents that should use it, then start a new turn. Profile imports do not require agent permissions.

Pitchcrew checks `gh --version` and validates the account with `gh api --hostname github.com --method GET user` only when the user connects. It saves the account name and connection method, never extracts a token with `gh auth token`, reads CLI credential files or copies CLI credentials into its data directory. Fixed read-only REST requests go through `gh api` with an explicit hostname and GET method, no shell, no interactive prompts, a 20-second deadline and bounded output. CLI stderr is not exposed. Before each read, Pitchcrew verifies that the active CLI account still matches the connected account; switching accounts requires reconnecting. Status snapshots perform no CLI or network checks. Disconnect removes only Pitchcrew’s account binding and cancels its requests; it does not log out GitHub CLI or affect other apps.

GitHub CLI access follows its native authentication, including its environment configuration. Its login may grant access to multiple repositories and write permissions; Pitchcrew exposes only its existing read tools and cannot post or modify resources. This flow does not offer the GitHub App’s per-repository installation picker. Organization approval or SSO policy may limit access. GitHub CLI manages authentication storage; see [its login documentation](https://cli.github.com/manual/gh_auth_login) for credential-store behavior.

**Advanced: use an access token** retains compatibility with existing connections and provides a narrower access option. Create a [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for only the repositories your crew should read, with **Contents: read**, **Issues: read**, and **Pull requests: read** for PR research. Metadata access is included. Paste the token into **GitHub access token** and choose **Connect with token**. Pitchcrew validates the account using GitHub’s `/user` endpoint before saving it. Only fixed, read-only REST routes are exposed; there is no arbitrary API request or posting tool.

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

The standard flow uses a Pitchcrew-owned OAuth app configured by the distributor or installation administrator. Users do not create Google Cloud projects or enter client credentials.

1. Open **Settings → Accounts** and click **Connect Google**. With the shared app configured, Pitchcrew prepares sign-in directly.
2. Click **Continue with Google**, choose your account and grant the read permissions you need. Electron opens the link in your system browser. You can decline individual services.
3. Return to Pitchcrew; connection status updates automatically. Enable the permitted services in each agent’s settings in **Crew**, then start a new turn.

### Shared app setup for distributors and administrators

1. Create a Google Cloud project for Pitchcrew and enable **Gmail API**, **Google Drive API**, **Google Sheets API** and **Google Calendar API**.
2. Configure the OAuth consent screen and create an OAuth client with the **Desktop app** type, using [Google’s installed-app setup](https://developers.google.com/identity/protocols/oauth2/native-app). A web client is not interchangeable with a Desktop client.
3. Supply `PITCHCREW_GOOGLE_CLIENT_ID` and `PITCHCREW_GOOGLE_CLIENT_SECRET` in the daemon’s environment before starting it. The launcher inherits these variables when it starts the daemon; an already running daemon must be restarted. These variables are filtered from provider subprocess environments. Keep release configuration outside the repository.
4. For development/testing, add intended accounts as test users. For public distribution, complete the applicable branding and scope verification with an accurate home page, privacy policy and data-flow disclosure. Gmail read-only and broad Drive read-only are restricted scopes. [Google’s restricted-scope requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) include a security assessment when restricted data is accessed from or through third-party servers. Account for data passed to runtime AI providers; local token storage alone does not establish an exemption. Workspace admins may also restrict consent.

This repository does not include a production OAuth client or assert that the shared app is verified. If shared configuration is absent, the UI explains that installation setup is incomplete and disables starting standard sign-in.

### Advanced setup with a custom app

**Advanced setup** remains available beside **Connect Google**, including when a shared app is configured. Create your own project and Desktop OAuth client using the administrator steps above, enter its client ID and client secret, then choose **Start Google sign-in** and **Continue with Google**. Custom credentials override the shared app for that connection and are retained with the account for token refresh; an omitted custom secret never falls back to the shared app’s secret.

Sign-in uses a temporary callback listener bound only to `127.0.0.1`, random single-use state, S256 PKCE and a ten-minute deadline. Pitchcrew requests offline access and read-only Gmail, Drive, Calendar and Sheets scopes, plus email identity. Declining individual services is supported: only granted scopes can be used. Access tokens refresh automatically; concurrent calls share one refresh. An expired/revoked grant requires reconnection. Google testing-mode grants may expire according to the consent project’s policy.

### Advanced: reuse Google Workspace CLI

If you already use [Google Workspace CLI (`gws`)](https://github.com/googleworkspace/cli), choose **Advanced setup → Use Workspace CLI → Connect with Workspace CLI**. Standard Google sign-in remains the default. This optional integration follows the CLI's current `auth status` and read-command contracts; incompatible versions fail with update guidance. The CLI is under active development and is not an officially supported Google product.

For first-time CLI setup, follow its installation and Google Cloud/OAuth setup guide, restart Pitchcrew so it can find the installed native binary on PATH, and run `gws auth login --readonly`. Return to Pitchcrew and connect. The CLI still needs its own Google Cloud app configuration; this option reuses an existing login rather than removing that setup. Enable each service for the agents that should read it in Crew.

Pitchcrew invokes `gws --version` and `gws auth status` only on explicit connection, then checks the saved login's email and current scopes before every read. It stores only the account, connection method and scope names. Tokens and client credentials remain with the CLI; Pitchcrew never exports or reads its credential files. Switching accounts requires disconnecting and reconnecting. Broader existing Gmail, Drive, Sheets or Calendar grants can supply read access, but Pitchcrew exposes only fixed list/get/export commands with validated JSON parameters. It cannot invoke arbitrary CLI commands, mutations, login, logout or setup.

Requests run without a shell or interactive input, with a 20-second deadline and 2 MB output/download bounds. CLI stderr and raw authentication errors are suppressed. Text and Docs downloads use an isolated temporary folder that is removed after the subprocess exits, including on failure or cancellation. JSON media printed by gws retains its parsed content with normalized JSON formatting. Raw-token, credentials-file and Google ADC environment overrides are filtered so API reads use the same saved OAuth account reported by `auth status`; service-account and override-only logins are unsupported. Disconnect cancels Pitchcrew's reads and removes its binding without logging out gws. Status snapshots never invoke the CLI or contact Google.

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

Manual GitHub tokens and Google credentials live in `PITCHCREW_HOME/connectors/credentials.json`, outside the repository and event log. CLI connections save only the account name, `mode: "cli"` and, for Google, scope names; credentials stay with `gh` or `gws`. Locally saved credentials use JSON, not encryption; Unix permissions are restricted to the current user (`0700` directory and `0600` file). Protect your data directory with your operating system’s account and disk protections. Credentials are never returned in snapshots, included in prompts, or passed in MCP configuration; agent processes receive only their scoped daemon run token. Disconnect aborts connector requests and deletes the local credential or CLI account binding. To invalidate a provider grant/token as well, revoke it in your Google or GitHub account; CLI logout is managed separately through `gh` or `gws`.

Connected account status is read from local state and performs no network requests. The GitHub connection is validated when connecting; Google refresh and authorization errors surface when tools are used. Tests mock service APIs, exercise real local OAuth callbacks and real MCP stdio, and do not access live accounts.

External emails, repository files and documents are untrusted data. They cannot grant permission or change role instructions. Packet claims still require exact quotations from local profile Markdown: users must verify and save external facts in **Your profile** before those facts can support application claims.

These connectors cannot send mail, create drafts, edit files, create calendar events, comment, submit applications or post to GitHub. Adding outward actions requires exact-payload, single-use user approvals checked in gated MCP tools; the existing packet export gate remains unchanged. Event version 3 adds optional connector capabilities, retaining versions 1 and 2 and their replay behavior.
