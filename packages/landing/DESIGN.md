---
name: Pitchcrew landing page
description: The public website for Pitchcrew, built in the desktop app's paper-and-ink visual system, in light and dark themes.
colors:
  paper: '#f2f1ec'
  paper-deep: '#e8e6df'
  surface: '#f8f7f3'
  surface-bright: '#fdfcf9'
  product-paper: '#eae9e2'
  ink: '#2b2d31'
  ink-soft: '#484b52'
  muted: '#61646b'
  primary: '#3a5482'
  moss: '#53673d'
  moss-soft: '#e1e8d4'
  primary-soft: '#e0e6f0'
  teal: '#2f6a69'
  teal-soft: '#d9e9e6'
  plum: '#76517a'
  plum-soft: '#ece1ec'
  selection: '#d9e9e6'
  link-rule: '#a6b2c5'
  border: 'rgb(43 45 49 / 0.14)'
  rim: 'rgb(255 255 255 / 0.95)'
  paper-dark: '#1a1b1e'
  paper-deep-dark: '#141518'
  surface-dark: '#222327'
  surface-bright-dark: '#2a2b30'
  product-paper-dark: '#1e1f23'
  ink-dark: '#e9e7e1'
  ink-soft-dark: '#c8c6c0'
  muted-dark: '#aaa8af'
  primary-dark: '#93abd8'
  primary-soft-dark: '#252e40'
  teal-dark: '#84c0bc'
  teal-soft-dark: '#263536'
  plum-dark: '#cda7d0'
  plum-soft-dark: '#352b37'
  selection-dark: '#34433f'
  link-rule-dark: '#6b82a9'
  border-dark: 'rgb(236 234 228 / 0.16)'
  rim-dark: 'rgb(255 255 255 / 0.08)'
typography:
  display:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(46px, 5.4vw, 80px)'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '-0.035em'
  display-compact:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(44px, 4.6vw, 66px)'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '-0.035em'
  headline-gate:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(40px, 4vw, 56px)'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '-0.035em'
  headline-band:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(40px, 4.6vw, 64px)'
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: '-0.03em'
  headline:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(34px, 3.6vw, 48px)'
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: '-0.03em'
  numeral:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: '40px'
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: '-0.02em'
    fontFeature: 'tnum'
  title-crew:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: '27px'
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: '25px'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  wordmark:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: '25px'
    fontWeight: 600
    letterSpacing: '-0.035em'
  lede:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: 'clamp(18px, 1.45vw, 21px)'
    fontWeight: 400
    lineHeight: 1.5
  section-copy:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: '20px'
    fontWeight: 400
    lineHeight: 1.5
  claim:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: '18px'
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: '17px'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: '16px'
    fontWeight: 600
  meta:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: '14px'
    fontWeight: 600
  verdict:
    fontFamily: 'Source Sans 3, sans-serif'
    fontSize: '14px'
    fontWeight: 700
  source-path:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: '12.5px'
    fontWeight: 400
rounded:
  focus: '4px'
  option: '6px'
  tab: '7px'
  mark: '8px'
  mark-lg: '10px'
  quote: '10px'
  tab-track: '10px'
  installer: '10px 11px 10px 9px'
  button: '11px 12px 10px 12px'
  menu: '11px'
  frame: '12px'
  card: '14px'
  dock: '16px'
  panel: '15px'
  sheet: '20px'
  band-card: '22px'
  pill: '999px'
spacing:
  page-width: '1184px'
  stage-width: '1280px'
  page-gutter: '40px'
  page-gutter-mobile: '20px'
  section: '108px'
  section-mobile: '68px'
  section-head-gap: '56px'
  section-head-gap-mobile: '40px'
  column-gap: '56px'
  column-gap-wide: '72px'
  injection-offset: '96px'
  sheet-padding: '40px 52px 28px'
  rail-padding: '32px 26px'
  card-padding: '16px 18px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    typography: '{typography.label}'
    rounded: '{rounded.button}'
    padding: '11px 19px'
    height: '46px'
  button-secondary:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.button}'
    padding: '11px 19px'
    height: '46px'
  button-secondary-header-mobile:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink}'
    rounded: '{rounded.button}'
    padding: '8px 13px'
    height: '40px'
  button-ghost:
    textColor: '{colors.primary}'
    rounded: '{rounded.focus}'
    padding: '0'
    height: '32px'
  theme-trigger:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink}'
    rounded: '{rounded.button}'
    width: '44px'
    height: '44px'
  installer-link:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.primary}'
    rounded: '{rounded.installer}'
    padding: '15px 18px'
    height: '86px'
  platform-tabs:
    backgroundColor: '{colors.paper-deep}'
    rounded: '{rounded.tab-track}'
    padding: '4px'
  platform-tab-active:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.primary}'
    rounded: '{rounded.tab}'
    padding: '8px 12px'
    height: '43px'
  packet-sheet:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sheet}'
    padding: '{spacing.sheet-padding}'
  review-rail:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.sheet}'
    padding: '{spacing.rail-padding}'
  review-note:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.card}'
    padding: '{spacing.card-padding}'
  note-quote:
    backgroundColor: '{colors.teal-soft}'
    textColor: '{colors.ink}'
    rounded: '{rounded.quote}'
    padding: '12px 14px'
  claim-line-selected:
    backgroundColor: '{colors.teal-soft}'
    textColor: '{colors.ink}'
    typography: '{typography.claim}'
    rounded: '{rounded.frame}'
    padding: '13px 16px'
  approval-bar:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.dock}'
    padding: '12px 12px 12px 20px'
  verdict-chip-agreed:
    backgroundColor: '{colors.teal-soft}'
    textColor: '{colors.teal}'
    rounded: '{rounded.pill}'
    padding: '2px 9px'
  verdict-chip-revised:
    backgroundColor: '{colors.plum-soft}'
    textColor: '{colors.plum}'
    rounded: '{rounded.pill}'
    padding: '2px 9px'
  role-mark:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.primary}'
    rounded: '{rounded.mark}'
    size: '28px'
  product-image:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.frame}'
  posting-card:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.card}'
    padding: '22px 24px'
  download-sheet:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.panel}'
    padding: '26px'
  runtime-chip:
    textColor: '{colors.paper}'
    rounded: '{rounded.pill}'
    padding: '6px 13px'
  theme-menu:
    backgroundColor: '{colors.surface-bright}'
    textColor: '{colors.ink}'
    rounded: '{rounded.menu}'
    padding: '5px'
---

# Design System: Pitchcrew landing page

## Overview

**Creative North Star: "The Packet Under Review"**

The landing page is built in the same world as the Pitchcrew desktop app: warm paper and soft ink, a Fraunces display face over Source Sans 3 text, and three role colours that mean the same thing they mean inside the app. The page reads like a document being checked. Ruled lines, margin notes, quoted sources and a pinned approval bar carry the story, and the hero is itself a working packet sheet whose lines trace back to profile quotes.

Density is calm and editorial. Sections are wide, single-purpose and separated by generous vertical space (108px) and hairline rules rather than boxes. Volume is rationed: flat paper for reading, soft lifted sheets for the packet and its notes, and clay (gradient fill, inner rim highlight, hover lift, press scale) only on things you can press. Light and dark themes are full peers; the dark theme mirrors the app's dark tokens rather than inverting the light ones.

Headings stand on their own without eyebrow labels. Motion is reserved for the claim tracer in the hero. Product evidence is real app screenshots with fictional demo data, and every example on the page says it is fictional.

**Key Characteristics:**

- Paper ground with a faint SVG grain, surfaces stepping up from paper to surface to surface-bright.
- Fraunces 500 for display, section and feature headings and the numeral readout; Source Sans 3 for everything else.
- Teal, plum and moss carry role meaning (Scout and quoted, Writer and revised, Reviewer), matching the app's role avatars; blue is the primary action.
- One inverted ink band (the Ownership section).
- Clay only on pressables, with slightly uneven corner radii.
- Real light/dark screenshot pairs, with phone-width detail crops below 768px.
- A compact hero for short desktop windows (at least 1024px wide, at most 860px tall).

## Colors

A low-chroma warm paper-and-ink palette with three muted role hues, each paired with a soft tint for backgrounds.

### Primary

- **Primary Indigo** (primary; dark theme primary-dark): the primary action (filled Download button), links, focus outlines, the selected platform tab, support-crew icons, accent and caret colour. Its tint (primary-soft) backs the download section, the default role mark and highlighted menu options.

### Secondary

- **Scout Teal** (teal / teal-dark): Scout, and everything quoted or verified: the "Quoted" verdict, the selected claim highlight (teal-soft), the profile quote block, the source path, the "Agreed" chip, the claims readout numeral and the posting "kept as text" flag. Text selection uses the same tint (selection).

### Tertiary

- **Writer Plum** (plum / plum-dark): Writer, and everything revised: the "Revised" verdict, the "Changed, then agreed" chip (plum-soft), the strike-through on the first draft and the dashed border around the hidden posting instruction.

### Neutral

- **Paper** (paper): page background and the theme-color meta value; also the text colour inside the ink band.
- **Deep Paper** (paper-deep): recessed areas: the injection example panel, the platform tab track, the "Resume" legend and the "You" role mark.
- **Surface** (surface) and **Bright Surface** (surface-bright): raised sheets. Surface is the review rail, approval bar, download sheet and product-image frame; Bright Surface is the packet sheet, review notes, posting card, installer links and menus.
- **Product Paper** (product-paper): the slightly darker band behind the Crew section, matching the app's workspace paper screenshot.
- **Ink** (ink): primary text and the background of the inverted band. **Soft Ink** (ink-soft): body copy, ledes and claim text. **Muted** (muted): captions, metadata and secondary notes.
- **Hairline** (border): every rule, divider and card stroke. **Rim** (rim): the 1px inner top highlight on clay pressables.
- **Link Rule** (link-rule): the resting underline colour of text links.

Dark theme values are separate tokens (the `-dark` keys) applied under `:root[data-theme='dark']`. Dark `paper-dark` is also the dark theme-color meta value.

### Named Rules

**The Role Colour Rule.** Teal, plum and moss are role signals, not decoration, using the app's own role tones. Teal means Scout or quoted, plum means Writer or revised, moss (#53673d, dark #a9c28a) means Reviewer, ink means You; blue stays the primary action. A role colour appears through `data-role`, which sets `--role` and `--role-soft` for the marks, dots and names in that block.

**The Single Inversion Rule.** The Ownership section ("Your computer. Your AI. Your call.") is the only section filled with ink. Its text uses paper, with paper at 80% for body copy and paper at 22–26% for rules and runtime chip strokes. In the dark theme it becomes the one light band, because it follows the ink token.

**The Paper Ground Rule.** No section sits on pure white or pure black. The page is paper with grain; raised material steps up to surface or surface-bright.

## Typography

**Display Font:** Fraunces (variable, 100–900, self-hosted latin subset) with Georgia, serif
**Body Font:** Source Sans 3 (400, 600 and 700, self-hosted latin subsets) with sans-serif
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, monospace, used only for profile source paths

**Character:** A soft, high-contrast old-style serif set tight (−0.02em to −0.035em) for headings, over a plain humanist sans for reading. The pairing is the app's own.

### Hierarchy

- **Display** (Fraunces 500, display, line-height 1): the hero H1 only, capped at 13ch. In short desktop windows it uses display-compact.
- **Headline** (Fraunces 500, headline, line-height 1.1): section titles. The ink band uses headline-band, capped at 11ch; the three gate titles ("Quoted", "Checked", "Approved") use headline-gate.
- **Numeral** (Fraunces 500, 40px, tabular figures): the "N of N" claims readout in the review rail, in teal.
- **Title** (Fraunces 500, 25px; crew steps 27px): feature titles, support-crew heading, ownership facts, after-apply items.
- **Lede and section copy** (Source Sans 3 400; hero lede clamp 18–21px capped at 54ch; section copy 20px, 19px on mobile, capped at 46ch).
- **Body** (Source Sans 3 400, 17px base, line-height 1.5–1.6): descriptions are capped at 36–52ch.
- **Label** (Source Sans 3 600, 16px): buttons and platform tabs. Panel titles such as "Review notes" are Source Sans 3 700 at 15px. **Meta** (600, 14px): packet metadata, legends, posting captions. **Verdict** (700, 14px): Quoted/Revised marks and role names in notes.

### Named Rules

**The No Eyebrow Rule.** Headings stand alone. There are no small labels, kickers or uppercase lines above headings, and no uppercase or letter-spaced text anywhere on the page.

**The Balanced Heading Rule.** Headings use `text-wrap: balance` and paragraphs `text-wrap: pretty`; manual line breaks are used only where a section title is deliberately set on two lines.

## Layout

Content sits in a centred column of `min(1184px, 100% − 80px)` (page-width), narrowing to `100% − 40px` below 640px. The header and hero stage are wider: `min(1280px, 100% − 64px)`, and the hero stage uses `100% − 24px` on phones. Sections are separated by 108px of vertical padding (68px below 640px).

Section heads are a two-column grid (1.1fr / 0.9fr) with the title on the left and copy aligned to its baseline on the right, 56px above the content (40px on phones). Content grids use asymmetric fractional columns (0.9/1.1, 0.85/1.15, 0.8/1.2) or a fixed 320px list beside a flexible screenshot, with 56–72px column gaps. Lists of features are ruled grids (two columns of hairline-divided items), never a row of equal cards.

The hero is a two-column stage: the packet sheet (flexible) and a 360px review rail joined to it as one object. Below 1024px the rail drops under the sheet, the selected line's note opens inline beneath it, and multi-column grids collapse to one column. Below 768px feature grids go single-column and the chat demo reflows like the app's transcript.

Breakpoints: 640px (compact), 768px, 1024px, plus a short-desktop query (`min-width: 1024px and max-height: 860px`) that tightens the header and hero so the whole packet and approval bar fit the first viewport.

### Named Rules

**The Compact Hero Rule.** On desktop windows 860px tall or less, the hero shrinks rather than overflows: header padding 22px to 14px, sheet top padding 40px to 28px, display-compact type, an 18px lede, claim rows 9px vertical padding at 17px, and 20px between the claim list and the approval bar.

## Elevation & Depth

Depth is a hybrid of tonal layering and soft, low-opacity, cool-tinted shadows (`rgb(30 34 44 / …)`). Reading surfaces are flat. Sheets that represent documents lift with long, faint drop shadows with negative spread. Pressables add an inner top rim highlight and a small two-layer shadow, lifting 1px on hover and scaling down slightly on press. Exact shadow values are recorded in `.impeccable/design.json`.

### Named Rules

**The Clay on Pressables Rule.** The clay treatment (gradient fill, 1px inner rim, hover lift, press scale) belongs to buttons, installer links, the active platform tab and the theme trigger. The approval bar carries a rim highlight as the dock for its buttons. Sheets, notes and cards never get the gradient or the lift.

**The Long Faint Shadow Rule.** Document shadows are long and faint (for example 30px offset, 60px blur, −44px spread at 45% opacity on the packet sheet), so sheets read as paper resting on paper, not floating cards.

## Shapes

Corners are soft and paper-like. Large sheets use 20–22px radii, cards and notes 14–16px, frames and highlights 12px, small marks 8–10px, and chips are full pills. Clay pressables use slightly uneven radii (buttons 11/12/10/12px, installer links 10/11/10/9px) so they read as handmade rather than machined. The hero sheet and rail share one 20px outline: the sheet rounds only its left corners and the rail only its right (top and bottom when stacked).

Hairline rules (1px, border token) do most of the structural work: ruled claim lines, gate track, crew connector line, after-apply grid and FAQ rows. Gates are marked with an 11px role-coloured dot on the rule. Dashed borders appear only around the hidden posting instruction.

## Components

### Buttons

- **Shape:** uneven clay corners (button radius), 46px minimum height, 9px icon gap.
- **Primary:** white text on an indigo gradient from #4d6896 through #3a5482 to #324a74, the same in both themes. Used once per context for Download.
- **Secondary:** ink text on a surface-bright to surface gradient with a hairline border and rim highlight. Used for "See how it's checked", the header Download link (40px tall on phones) and the 44px theme trigger.
- **Ghost:** primary-coloured text with no fill, 32px tall.
- **Hover / Focus / Press:** 1px upward lift on fine pointers, `scale(0.98)` on press, both over 160ms with the shared ease. Focus is a 3px primary outline offset 5px.

### Chips

- **Verdict chips:** pill-shaped, 13px text; teal on teal-soft for "Agreed", plum on plum-soft for "Changed, then agreed".
- **Runtime chips:** pill outlines in paper at 26% inside the ink band, with a bold "Works with" label and no border.

### Cards / Containers

- **Packet sheet:** surface-bright, 20px left corners, generous padding, long faint shadow.
- **Review rail and notes:** the rail is surface; review notes are surface-bright cards (14px radius) holding a teal-soft quote block with the mono source path.
- **Posting card:** surface-bright, 14px radius, captioned "Fictional posting", with the hidden instruction shown in a dashed plum box.
- **Product image frame:** surface background, 12px radius, hairline border and a two-layer soft shadow.
- **Download sheet:** surface, 15px radius, 26px padding (18px on phones), on the primary-soft band.

### Navigation

- **Header:** brand mark (the three-piece favicon at 42px, 32px on phones) plus the Fraunces 600 wordmark; text links at 15px that turn primary on hover; the theme menu trigger; and a secondary Download button. Links hide progressively: FAQ below 1024px, section links below 768px, GitHub below 640px.
- **Theme menu:** surface-bright popover with 11px radius, 44px options, primary-soft highlight, and a 150ms fade and 4px slide.
- **Platform tabs:** a paper-deep track with 7px-radius tabs; the active tab is surface-bright, primary text and a small rim shadow. Tabs activate on focus.

### Claim Tracer (signature component)

The Review close-up's interactive packet, directly after the journey hero. A legend row labels the document (Resume chip, "Application packet · Design Engineer, Forma · fictional candidate"). Each resume line is a radio-backed label with a Quoted (teal) or Revised (plum) verdict. Selecting a line (click, tap or arrow keys; hover previews on fine pointers) moves a teal-soft highlight to it and swaps the Reviewer note and Writer note in the rail. Below 1024px the rail is hidden: the note, including Writer's line, opens inline under the selected line, and the readout sits before the approval bar. The highlight moves with a shared-layout animation and the note crossfades (opacity, 6px rise, 3px blur) over 0.32s with the shared ease. Reduced motion swaps instantly. A polite live region announces the selected line. A pinned approval bar at the sheet's foot carries the offer and the two buttons.

## Do's and Don'ts

### Do:

- **Do** use the role colours only for their roles: teal for Scout and quoted, plum for Writer and revised, moss for Reviewer; primary blue for the primary action.
- **Do** set display, section and feature headings in Fraunces 500 with negative tracking (−0.02em to −0.035em); small panel titles such as "Review notes" and all other text use Source Sans 3.
- **Do** separate content with 1px hairline rules (border token) and ruled grids rather than boxed feature cards.
- **Do** label every example as fictional ("Fictional example candidate", "Fictional posting", "Fictional demo data").
- **Do** use real app screenshots captured with fictional demo data, in light and dark pairs, with a phone detail crop below 768px.
- **Do** keep the compact hero working: at 1024px wide and 860px tall or less, the packet and approval bar fit the first viewport.
- **Do** give links, buttons and FAQ summaries the 3px primary focus outline offset 5px (claim lines use a 2px offset), and give every transition a reduced-motion equivalent.

### Don't:

- **Don't** add eyebrow labels, kickers or uppercase lines above headings.
- **Don't** add animation outside the claim tracer beyond short state transitions (160ms press, 150ms menu, 180ms FAQ icon rotation).
- **Don't** fill a second section with ink; the Ownership band is the only inverted section.
- **Don't** put the clay gradient, rim highlight or hover lift on sheets, notes or cards.
- **Don't** use pure white or pure black backgrounds; stay on paper and surface tokens.
- **Don't** substitute mock-ups or illustrated app UI for the real screenshots. Authored examples (the hero packet, the posting card) are not app UI and stay labelled fictional.

## App components on the page

The "Watch the work" section renders the desktop app's own chat components rather than a screenshot: `RoleAvatar`, `Message`, `MessageContent`, `ActivityGroup`, `ActivityStep` and `TurnDuration` from `packages/ui`, styled by the app's `theme.css`, `identity.css`, `chat/conversation.css` and `chat/activity.css`. The landing imports the app theme first, unlayered, so landing tokens override shared names; the app's paper fibres sit under the body grain as in the app. The turn data is a fixed, completed, labelled-fictional conversation with the app's real tool-step labels, so server and client render identically. Commentary and replies are plain text, skipping the app's Markdown renderer to keep the page light.

## Journey hero

The first viewport follows one fictional job (Forma, Design Engineer) through Fit, Draft, Review and Track. Stages are Base UI tabs with role-coloured icon discs (teal Scout, plum Writer, moss Reviewer, ink You); the active disc fills with its role colour. Stage discs are clay orbs (radial highlight, drop shadow, inset shading) that rise on hover, fill with the role colour when active and press in on click. Each stage panel sets Fraunces copy beside the app's own Job details drawer (its CardDetails components, job-details.css, board.css and forms.css, with app button styles scoped to `.job-demo`), framed on its top and left edges like a sheet sliding in from the right. After the visitor changes stage, the copy settles (300ms) and the drawer slides in from 24px with a slight blur (420ms); reduced motion removes both. The composition comes from the parallel Codex branch; the claim tracer follows as the Review close-up with a section-sized heading (38–60px), leaving the 44–80px display size to the hero.

## Setup and density

The page shows no screenshots: the journey drawer and the chat demo are the app's own components. Setup is three icon steps (clay icon tiles, bold label, one line) in the Download section's left column beside the platform chooser, with a muted cost note. The crew section pairs the support-crew list with an "After you apply" card on the bright surface; it does not repeat the Scout → Writer → Reviewer sequence the journey already shows.

## Journey crop and progress

The journey drawer sits in a 700px window (680px below 1024px, 700px on phones) with a 64px bottom fade, so the Draft and Review stages show several packet lines; the stage copy is top-aligned and sticky beside it. The rule between stage orbs fills up to the selected stage (420ms), and completed stages take a muted fill of their role colour. On phones the drawer is inset with all corners rounded and the packet document picker scrolls in one row. App CSS that names 'Source Sans 3' or 'Fraunces Variable' literally resolves through @font-face aliases in theme.css to the same local files.
