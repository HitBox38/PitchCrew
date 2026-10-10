# Pitchcrew landing page

The standalone public site lives in `packages/landing`, using Next.js App Router, React, strict TypeScript, Tailwind CSS, Base UI/shadcn primitives, Motion and locally served fonts. It does not connect to the local daemon. Vercel deployment is deferred.

## Brief

The primary audience is tech professionals actively looking for a job. The primary action is downloading Pitchcrew, with GitHub secondary. The headline is “Your job search, with a crew behind you.” Pitchcrew is free to download; users configure their own AI CLI and provider account, whose usage costs remain separate.

The page explains Scout → Writer → Reviewer, shows real app screenshots with fictional demo data, explains local storage and approval controls, offers platform downloads, and answers setup, pricing and privacy questions. It makes no claims about hiring results or full offline AI operation.

## Design

The palette follows the product: paper `#f2f1ec`, surface `#f8f7f3`, ink `#2b2d31`, blue `#3a5482`, Scout teal `#2f6a69` and Writer plum `#76517a`. Fraunces supplies expressive headlines; Source Sans 3 supplies readable body text and controls. Both are served locally. Dark mode follows the system by default, with a keyboard-accessible Light / Dark / System menu in the header. The ink palette mirrors the desktop app, including matching real dark screenshots. A small head script applies the saved theme before paint; the versioned website preference synchronizes across tabs and follows live system changes when System is selected. Storage failures still allow a choice for the current visit.

The layout uses a left-aligned headline paired with concise explanatory copy and download actions, then a wide Board screenshot. A connected three-stage workflow gives the crew a clear job. Alternating text and screenshots explain chat and review. Quiet dividers and open layouts keep the product screenshots dominant; clay volume is reserved for things people press.

```text
Brand                 Workflow / Your control / FAQ      Download
Large headline                  Explanation / actions
                    Actual Board screenshot
Scout                  Writer                   Reviewer
Chat explanation                      Chat screenshot
Review screenshot                     Review explanation
Local storage / Approvals / Choose your runtime
Download introduction                 Platform chooser
Questions and answers
Brand / GitHub / Documentation / Analytics preference
```

The brief explicitly asks for the existing paper style. Its distinctive elements are the actual crew workflow, the three-piece brand mark, and the product itself. Avoid generic dashboard illustrations, testimonials, made-up statistics and repeating decorative card grids. Motion should explain the crew sequence and acknowledge interaction, with reduced motion respected.

## Development

Use the root packageManager pin and supported Node engine, then `pnpm install`. `pnpm landing:dev` serves the page at `http://127.0.0.1:3000`; `pnpm landing:build` creates the production build, and `pnpm landing:start` serves it. Root lint, formatting and type checks cover the site; CI builds it separately from desktop packaging.

## Downloads

The server reads the latest public GitHub release without credentials, validates installer names and repository URLs, and caches the result for one hour. Network failure or missing assets leads to an explicitly labeled GitHub Releases fallback rather than a guessed installer URL. macOS has Apple Silicon and Intel options; Windows is x64; Linux has x64 AppImage and Debian packages. Architecture choices are explicit. The download section explains the separate AI runtime/account setup and current unsigned Windows/macOS installers.

## Analytics

Production counts anonymous page visits and download clicks through Pitchcrew's public PostHog project; `NEXT_PUBLIC_POSTHOG_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` override the ingestion settings. An empty token disables analytics. Development is offline unless `NEXT_PUBLIC_POSTHOG_DEV=1`. The footer offers a device-local opt-out, synchronized across tabs, and browser Do Not Track is respected. Events use a closed vocabulary of platform and package choices; URLs, referrers, app content and error text are excluded. Autocapture, session recording, profiles, surveys, flags, performance and exceptions are disabled. Analytics failures never block downloads.

## Search and sharing

The HTML includes a descriptive search title and summary, canonical and Open Graph URLs from `NEXT_PUBLIC_SITE_URL`, social sharing images, and escaped JSON-LD describing the website, page and desktop application. Visible hero copy identifies the AI job-search workflow. Text, FAQs and download links are rendered on the server; fonts are local and screenshots use Next.js image optimization with lazy loading below the hero.

Only production with a configured canonical origin is indexable. Development, Vercel previews and builds without an origin emit `noindex` and an empty sitemap. The production sitemap includes the homepage and product screenshots; robots.txt advertises it only for an indexable production build. Previews remain crawlable so their `noindex` can be read, following [Google's indexing guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

The application schema reports the real free-app offer and separate AI provider costs. It includes no invented review or rating. Software-app rich results require an actual review or rating under [Google's software-app documentation](https://developers.google.com/search/docs/appearance/structured-data/software-app), so this schema describes the product without promising a rich result. The website schema identifies the Pitchcrew site name, following [Google's site-name documentation](https://developers.google.com/search/docs/appearance/site-names).

After deployment, verify the canonical URL and sitemap on the public domain, add that domain to Google Search Console, and submit `/sitemap.xml`. Search Console ownership and submission require the eventual domain; they are not provisioned by local development.

## Later deployment

In Vercel, select `packages/landing` as the project root and the Next.js framework preset. Install with the repository's frozen pnpm lockfile; build using `pnpm build` from that package. Supply `NEXT_PUBLIC_SITE_URL` with the final HTTPS origin for canonical metadata, robots and sitemap. Rebuild after changing that build-time variable. Without it the page intentionally stays out of search results. No domain or deployment is provisioned by the initial build.

## Screenshots

Screenshots are committed under `packages/landing/public/screenshots`. Capture only an isolated development daemon with `PITCHCREW_SEED_SKILLS=0`, analytics disabled and a temporary data folder outside the repository. Load the fictional example board and use only Demo agents. Capture both app themes at the same viewport and retain the fictional data; the page switches between the corresponding light and dark captures. The screenshot files contain no personal data. UI changes may require fresh screenshots; their captions identify the fictional demo.
