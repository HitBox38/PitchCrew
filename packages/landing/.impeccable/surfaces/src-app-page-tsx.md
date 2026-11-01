---
version: 1
slug: 'src-app-page-tsx'
primary_target: 'src/app/page.tsx'
related_targets: []
---

# Landing page

Scope: the public homepage (`src/app/page.tsx`). Mode: Persuade. World: pinned to the desktop app's own clay design system as shipped in `@pitchcrew/design-system` (flat paper ground, clay volume only on pressables, recessed trays, beads and grooves carrying state by the bead law, identity pebbles, Source Sans 3 text with Fraunces display, role colours teal/plum/moss/ochre/rose and the blue primary glaze), light and dark with the existing Light/Dark/System menu.

Audience and action: tech professionals actively job hunting who already use an AI coding CLI; primary action Download (platform chooser), secondary GitHub.

Proof: one labelled-fictional job (Forma, Design Engineer) worked by the crew in front of the visitor: the roster's run grooves fill, then wait on the visitor; the packet behind that decision opens as an interactive claim tracer; four stage objects (job card, chat turn, browser approval tray, board move) show the whole search. No screenshots, no testimonials, counts or ratings. Open source under the MIT License may be stated.

Story: hero roster working one job, then waiting on you (Download) → the packet up close (claim tracer) → three gates and the posting that cannot give orders → one job start to finish on a stage track → the rest of the crew → your computer, your AI, your call → setup beside download → questions → footer. Rebuilt 2026-11-01 for the clay app; the page renders design-system primitives and its own clay styles, with no components or styles from packages/ui.

Anti-references: hacker/terminal costume, HR-tech corporate, cute/gamified, hype voice, the hero-over-screenshot template, rows of equal feature cards.

## Direction contract

Revised 2026-11-01. Surface round, roll f177fb93a5fe21b1f56d7ab25a024f28: the dealt lead (Crew roster) builds, raised by the two other dealt structures (stage-track spine, packet under review), which become sections.

THESIS: The crew is shown working one fictional job and then stopping to wait for the visitor; the page is the app's own Crew and Decisions vocabulary at marketing scale. It refuses the headline-over-screenshot hero and the row of equal feature cards.

OWN-WORLD: Flat paper with clay only on things you press; recessed sunken trays hold work; beads obey the app's bead law (plum executing, ochre waiting on you, primary done, moss recorded win, empty socket idle); identity pebbles are the only round shaded objects; Fraunces 500 display over Source Sans 3; glazed indigo for the one primary action per surface.

STORY: The visitor sees four agents run on one job and stop at an ochre bead that is theirs to decide; opens the packet and sees every line trace to a profile quote; learns the three gates; follows the job across the stage track; meets the rest of the crew; sees it runs on their machine with their AI; downloads.

FIRST VIEWPORT: Header with glazed Download. One-line H1 "A crew for your job search." at display size (about 6.6vw) over one supporting sentence beside three facts (free and MIT-licensed, Mac/Windows/Linux, your own AI tool). Below, a recessed Crew tray: four clay agent cards (Scout, Writer, Reviewer, Tracker) each with pebble, runtime · model, one capability line and today's run groove on the Forma job; a Waiting on you tray beneath them holding the Forma packet decision with Download for <OS> (glazed) and See the packet (clay).

FORM: Crew roster with run grooves, rank 6 of 7 on my ordered list, the dealt lead. Signature interaction: the rehearsal, a once-per-visit sequence of CSS transitions driven by phase state (timed phases set a data-phase attribute once the roster is in view) where the Forma run fills Scout's, Writer's and Reviewer's grooves in turn (plum runs, beads turning primary) and ends on the ochre Waiting on you bead; Replay control; reduced motion and no-JS show the finished state. Motion grammar: the app's strong ease-out (cubic-bezier(0.23, 1, 0.32, 1)), press scale 0.97, transitions over keyframes, transform and opacity only, and a stage track that fills from an IntersectionObserver with the finished state as the static fallback. seed:6fc53624c47c8405

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
