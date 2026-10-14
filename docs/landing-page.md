# Pitchcrew landing page

The standalone public site lives in `packages/landing`, using Next.js App Router, React, strict TypeScript, Tailwind CSS, Base UI/shadcn primitives, Motion and locally served fonts. It does not connect to the local daemon. Vercel deployment is deferred.

## Brief

The primary audience is tech professionals actively looking for a job who use, or will install, an AI coding CLI. The primary action is downloading Pitchcrew, with GitHub secondary. The page leads with the whole search, "Your job search, with a crew behind you.", shown through one fictional job moving through Fit, Draft, Review and Track. Its key proof follows immediately: "Every line traced back to you." Writer drafts from the user's own notes, Reviewer checks every claim, and nothing is exported or submitted without the user's approval; AI context still goes to the user's chosen provider. The crew and local, bring-your-own-AI operation are supporting proof. The journey composition and its captures come from the parallel Codex branch (`t3code/refresh-landing-page`). Pitchcrew is free and open source under the MIT License; users configure their own AI CLI and provider account, whose usage costs remain separate.

The page proves the claim with an interactive, clearly labeled fictional packet, explains the three gates and prompt-injection handling, covers the support crew alongside tracking, imports, discovery and Insights, shows live chat activity rendered with the app's own chat components, explains local storage and supported runtimes, explains setup in three steps beside the platform downloads and answers setup, pricing, safety and privacy questions. It makes no claims about hiring results or full offline AI operation, and uses no testimonials, counts or ratings.

Durable product context lives in `packages/landing/PRODUCT.md`; the page's direction contract lives in `packages/landing/.impeccable/surfaces/src-app-page-tsx.md`, and the documented visual system in `packages/landing/DESIGN.md` and `.impeccable/design.json`. Transient impeccable files (mocks, review captures, build state, decision-page state) are gitignored.

## Design

The page deliberately shares the desktop app's world and imports the app's `theme.css`: paper `#f2f1ec`, surface `#f8f7f3`, ink `#2b2d31`, blue `#3a5482` for the primary action, Scout teal `#2f6a69`, Writer plum `#76517a` and Reviewer moss `#53673d`, with the app's dark ink palette for the dark theme. Fraunces supplies headlines and Source Sans 3 body text and controls; both are served locally. Clay volume is reserved for things people press. Dark mode follows the system by default, with a keyboard-accessible Light / Dark / System menu in the header. A small head script applies the saved theme before paint; the versioned website preference synchronizes across tabs and follows live system changes when System is selected. Storage failures still allow a choice for the current visit.

The first viewport pairs a centred whole-search headline with a journey frame: the fictional Forma job, four keyboard-navigable stage tabs (Fit, Draft, Review, Track) in the role colours, an approval note, and for the selected stage its copy beside the app's Job details drawer rendered from its own components (heading, metadata, state, actions, Overview / Packet / History tabs, brief summary, packet and Sources, history) with fictional Forma data. The drawer's own action buttons advance the walkthrough to the next stage, and stage changes animate only after the visitor acts. The header carries a filled Download.

The next section is the Review step up close: a packet under review whose four ruled resume lines carry Quoted or Revised marks, with a margin rail showing Reviewer's note, the exact profile quote and source line, Writer's note and a "4 of 4 claims quoted" readout. Its approval bar holds "See how it's checked" and "Download for <detected OS>", which opens the platform chooser so the architecture stays explicit.

The lines are a native radio group: click, tap or arrow keys select a line, and fine pointers preview on hover. The rail updates through a polite live region, the selection highlight slides between lines and the note cross-fades; reduced motion swaps without animating. Below 1024px the note opens inline under the selected line, and the journey stacks its copy above the drawer, whose tab content scrolls inside it.

```text
Brand                       How it's checked / The crew / FAQ / GitHub   Theme  Download
Your job search, with a crew behind you. — promise, free and open-source line
Journey: Forma job · Fit / Draft / Review / Track · approval note; stage copy beside the live Job details drawer
Review up close: packet lines with Quoted/Revised marks · Review notes, Writer note, readout
Approval bar: free and open source  See how it's checked  Download for <OS>
Three gates (Quoted / Checked / Approved) on one track
Job posts are read, never obeyed — fictional posting with a hidden instruction
A crew for every part of the search: support crew · After you apply, it keeps track
Watch the work: one line of copy, the app's own chat components with a fictional turn
Your computer. Your AI. Your call. (ink band) — storage, runtimes, open source
A little setup (three steps, cost note)   Platform chooser
Questions and answers
Brand / GitHub / Documentation / MIT License / Opt out of analytics
```

Avoid generic dashboard illustrations, testimonials, made-up statistics, eyebrow labels and repeating card grids. Motion belongs to the claim tracer and the journey's stage changes; other sections stay still.

## Development

Use the root packageManager pin and supported Node engine, then `pnpm install`. `pnpm landing:dev` serves the page at `http://127.0.0.1:3000`; `pnpm landing:build` creates the production build, and `pnpm landing:start` serves it. Root lint, formatting and type checks cover the site; CI builds it separately from desktop packaging.

## Downloads

The server reads the latest public GitHub release without credentials, validates installer names and repository URLs, and caches the result for one hour. Network failure or missing assets leads to an explicitly labeled GitHub Releases fallback rather than a guessed installer URL. macOS has Apple Silicon and Intel options; Windows is x64; Linux has x64 AppImage and Debian packages. Architecture choices are explicit. The download section explains the separate AI runtime/account setup and current unsigned Windows/macOS installers.

## Analytics

Production counts anonymous page visits and download clicks through Pitchcrew's public PostHog project; `NEXT_PUBLIC_POSTHOG_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` override the ingestion settings. An empty token disables analytics. Development is offline unless `NEXT_PUBLIC_POSTHOG_DEV=1`. Website analytics is on by default when configured. A quiet footer control lets visitors opt out on that device (and turn it back on), synchronized across tabs; it is hidden when analytics is unavailable. Browser Do Not Track is respected, and masked session replay stays off because the page offers no opt-in. Events use a closed vocabulary of platform and package choices; URLs, referrers, app content and error text are excluded. Autocapture, session recording, profiles, surveys, flags, performance and exceptions are disabled. Analytics failures never block downloads.

`landing_page_viewed` and `landing_download_clicked` also include the root package's `app_version`, `renderer: landing` and `analytics_schema: 2`. A visit is counted once per loaded page, including after preference toggles. Download clicks count selected installer or Releases links, not completed downloads or installations. Website identity remains independent of the installed app.

The public site is https://pitch-crew.tomer-norman.dev. On October 12, 2026, browser inspection confirmed its deployed bundle uses the app's public PitchCrew EU token and sends an ingestion request to `https://eu.i.posthog.com/e/` that returns HTTP 200. This verifies deployed configuration and accepted outbound capture; it does not establish query visibility or genuine visitor counts. Automated tests keep transport mocked and never send test downloads to the public project.

## Search and sharing

The HTML includes a descriptive search title and summary, canonical and Open Graph URLs from `NEXT_PUBLIC_SITE_URL`, social sharing images, and escaped JSON-LD describing the website, page and desktop application. Visible hero copy identifies the AI job-search workflow. Text, FAQs and download links are rendered on the server; fonts are local and screenshots use Next.js image optimization with lazy loading below the hero.

Only production with a configured canonical origin is indexable. Development, Vercel previews and builds without an origin emit `noindex` and an empty sitemap. The production sitemap includes the homepage and product screenshots; robots.txt advertises it only for an indexable production build. Previews remain crawlable so their `noindex` can be read, following [Google's indexing guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

The application schema reports the real free-app offer and separate AI provider costs. It includes no invented review or rating. Software-app rich results require an actual review or rating under [Google's software-app documentation](https://developers.google.com/search/docs/appearance/structured-data/software-app), so this schema describes the product without promising a rich result. The website schema identifies the Pitchcrew site name, following [Google's site-name documentation](https://developers.google.com/search/docs/appearance/site-names).

After deployment, verify the canonical URL and sitemap on the public domain, add that domain to Google Search Console, and submit `/sitemap.xml`. Search Console ownership and submission require the eventual domain; they are not provisioned by local development.

## Later deployment

In Vercel, select `packages/landing` as the project root and the Next.js framework preset. Install with the repository's frozen pnpm lockfile; build using `pnpm build` from that package. Supply `NEXT_PUBLIC_SITE_URL` with the final HTTPS origin for canonical metadata, robots and sitemap. Rebuild after changing that build-time variable. Without it the page intentionally stays out of search results. No domain or deployment is provisioned by the initial build.

## Screenshots

The page renders no screenshots; `packages/landing/public/screenshots/board.png` is kept only as the sitemap image and structured-data screenshot. The journey's Job details drawer is not a screenshot: `src/Journey` renders the app's CardDetails, BriefSummary and tab components from `packages/ui` with fictional data. The chat example is not a screenshot: `src/WatchItWork` renders the app's `RoleAvatar`, `Message`, `MessageContent`, `ActivityGroup`, `ActivityStep` and `TurnDuration` from `packages/ui` (through the `@/` alias in the landing tsconfig) with a fixed, labelled-fictional turn that uses the app's real tool-step labels, styled by the app's own theme and chat CSS imported in `globals.css`. Capture only an isolated development daemon with `PITCHCREW_SEED_SKILLS=0`, update checks and analytics disabled and a temporary data folder outside the repository. Load the fictional example board and use only Demo agents. Capture both app themes at 1440×900 with a device scale factor of 2 and reduced motion, then compress them with a palette PNG pass (sharp, quality 92) and check for banding before committing. The screenshot contains no personal data; refresh it when the Board changes.
