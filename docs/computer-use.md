# Local browser computer use

Enable **Crew → role settings → Computer use → Use a local browser** for an agent. It defaults to off. Install Chromium once:

```sh
pnpm browser:install
```

Ask the role in chat to work on an application and attach its job card when uploading a packet. A visible, isolated Chromium window opens on this computer. It does not attach to an existing browser, read its cookies, or expose desktop mouse/keyboard controls. Sign in manually in that window if needed. Browser sessions and sign-ins last only for the run; follow-ups start fresh browsers. Demo does not call tools. Computer-enabled CLI/ACP runs have a 30-minute maximum so user decisions can take time; other runs retain their three-minute limit.

The shared stdio MCP server exposes three tools to permitted roles:

- `pitchcrew_computer_inspect`: opens the browser if needed, returns an accessibility snapshot, form controls, URL, title and a JPEG screenshot.
- `pitchcrew_computer_request`: proposes one navigation, click, fill, selection, keypress or upload, with exact parameters and a reason. CSS selectors must match one element. It does not perform the interaction.
- `pitchcrew_computer_execute`: waits up to 30 seconds for the user decision, then enters the single-use MCP gate. While pending, agents call it again to keep their run alive.

Review each proposal in **Inbox**. It shows the exact action, the page text and screenshot, and the complete file contents for uploads. Approving allows that one interaction; rejecting allows none. Every interaction needs approval because clicks, keystrokes and field changes can send data immediately, including through website autosave. The final submit click also requires its own approval. Agents cannot approve actions. Browser actions do not automatically mark cards submitted; verify the website confirmation and record the outcome on the board.

The gate binds the run, role, card, action parameters, upload bytes and page fingerprint. It rechecks current role permissions, cancellation and page state before execution. A changed URL, DOM or form value requires a new proposal. Approval is consumed before interacting, so a failed or uncertain action cannot be retried with the same approval. Browser windows close and pending/approved proposals expire on run completion, failure, cancellation or daemon restart. History is append-only event version 6; versions 1–5 still replay.

Uploads are limited to `resume.md`, `cover_letter.md`, `form_answers.md` and `note.md` from an approved, exported packet for the attached card. The gate resolves paths under that card's packet directory and verifies the file bytes against the approved packet and the browser proposal. There is no arbitrary filesystem upload, JavaScript evaluation or shell tool.

Pages are untrusted data, not instructions. Public HTTP(S) requests are checked against DNS/IP private-network rules, including redirects and subresources; local and private addresses, credential-bearing URLs, service workers, WebSockets and downloads are blocked. This prevents ordinary browser access to the daemon approval UI. This is an application-level boundary, not an OS network sandbox: use network-level isolation if adversarial DNS rebinding must be prevented. Site scripts still execute and may issue normal requests after an approved interaction; approving an action does not prove what a third-party website will do internally. Dynamic sites can invalidate proposals frequently. Agents should never receive account passwords; password values are omitted from the form-control snapshot, and password fills are rejected.

This first version operates in the main frame, follows new popup tabs automatically, and supports Markdown packet uploads. PDF generation, arbitrary document uploads, desktop control, persistent browser profiles, iframe targeting, dialog acceptance and automatic CAPTCHA handling are deferred. Some application sites accept only PDF/DOCX and will still require manual uploads.

`pnpm test` includes a real headless Chromium test with an intercepted fictional application site, plus approval, replay, cancellation, HTTP and MCP tests. Run `pnpm browser:install` before testing on a new checkout. These tests make no external submissions or provider calls. Live provider/browser combinations and third-party application sites are not automated verification.
