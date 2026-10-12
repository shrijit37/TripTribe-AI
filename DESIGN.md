---
name: TripTribe
description: Dubbing a trip is cutting a mixtape — ballpoint ink, inlay stock, one red stripe.
colors:
  stock: "#f4f1e6"
  card: "#faf7ec"
  ink: "#1b3fb0"
  ink-soft: "color-mix(in srgb, #1b3fb0 72%, #f4f1e6)"
  pencil: "#6f6f6a"
  accent: "#d23c2a"
  line: "rgba(27, 63, 176, 0.28)"
  line-soft: "rgba(27, 63, 176, 0.14)"
typography:
  display:
    fontFamily: "'Caveat', cursive"
    fontSize: "clamp(40px, 5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.02
  headline:
    fontFamily: "'Caveat', cursive"
    fontSize: "clamp(2.75rem, 8vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "'Shadows Into Light', cursive"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.1
  hand-action:
    fontFamily: "'Caveat', cursive"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.04em"
  body:
    fontFamily: "'Barlow', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-large:
    fontFamily: "'Shadows Into Light', cursive"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
  action:
    fontFamily: "'Barlow', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  figure:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sharp: "0px"
spacing:
  rail: "75ch"
  page: "68rem"
  gutter: "clamp(16px, 4vw, 56px)"
  sheet: "1.25rem"
  index: "9rem"
components:
  button-dub:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.hand-action}"
    rounded: "{rounded.sharp}"
    padding: "12px 26px"
  button-standard:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.action}"
    rounded: "{rounded.sharp}"
    padding: "0.7rem 1.4rem"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.sharp}"
    padding: "0.5rem 1rem"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "8px 14px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.sharp}"
    padding: "8px 14px"
  input-entry:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "4px 2px"
  section-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.sheet}"
  day-card:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
  verdict:
    backgroundColor: "{colors.card}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sharp}"
    padding: "0.9rem 1rem"
  segment-tab-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.sharp}"
    padding: "0.7rem 1rem"
---

# Design System: TripTribe

> **Scope.** This document scans the shipped mixtape world: `/plan`
> (`frontend/src/screens/Plan.tsx`, `frontend/src/mx-plan.css`), the SIDE-A
> generating screen in the same files, `/result`
> (`frontend/src/screens/Result.tsx`, `ActivityCard.tsx`, `HotelSection.tsx`,
> `frontend/src/mx-result.css`), and the shared chrome — navbar/footer
> (`Navbar.tsx`, `Footer.tsx`, `mx-chrome.css`), auth/verify/reset/account
> (`Auth.tsx`, `Verify.tsx`, `Reset.tsx`, `Account.tsx`, `AccountDrawer.tsx`,
> `mx-auth.css`), with type self-hosted under `frontend/public/fonts/`
> (`--mx-*` tokens live in `mx-plan.css`; nothing else redefines them). It
> supersedes the ticket-wallet contract: `/search` now permanently redirects
> to `/plan` (`frontend/src/app/search/page.tsx`). The landing body
> (`screens/Hero.tsx`) and city-article pages still render the old `tt-*`
> system pending a later pass — recorded below as carried drift, not canon.

## Overview

**Creative North Star: "The Day's Mixtape"**

Planning a trip is dubbing a tape the organiser hands to the group. `/plan`
is the counter where the tape is ordered — three entries ruled on the
j-card's inner fold, the destination arriving as a pinned photograph, the
dubbing block frank about estimates. The generating screen flips the card to
SIDE A and inks the wait honestly: an elapsed tape counter and narration,
never faked per-day completion. `/result` is the dubbed box set: each day a
side, every stop a track with its running time at the margin, the fare ledger
the tape length the trip must fit.

The world is dubbed-tape ephemera: lined inlay-stock ground, ballpoint-blue
ink, pencil-gray tentative marks, one TDK-red brand stripe as the only
printed accent. Hand-lettered block caps do the naming, Barlow does the
reading, Martian Mono does the measuring. Standard web controls throughout —
the world lends type, palette, density, and one signature move only, never
control costumes: every target keeps 44px, every corner stays square.

**Key Characteristics:**
- One j-card, two states: the ruled inner fold where the tape is ordered,
  the flipped SIDE-A card while the planner works the real wait.
- Day sides run top to bottom, never tabs; every stop timed, right-aligned
  tabular, every day fitted to its daylight.
- TDK red refuses and nothing else; pencil gray marks what is tentative, an
  em dash marks what was never gathered.
- The destination arrives as a real pinned photograph or not at all — never
  a stock thumb.
- Partner stubs are honest outbound links with their disclosure on the
  sleeve, never quotes.

## Colors

Lined inlay stock plus ballpoint ink with one printed red. No gradient
anywhere in the system.

### Primary
- **Ballpoint ink** (`#1b3fb0`): everything that acts or names — spine rail,
  day-side heads, the dub block, chips switched on, links, focus rings. Its
  72% mix toward stock (`color-mix(in srgb, #1b3fb0 72%, #f4f1e6)`, `#435fb4`
  where a flat fallback is needed) carries hints, ledes, notes, and
  disclosures.
- **TDK red** (`#d23c2a`): the brand stripe and the refused value — field
  errors, `aria-invalid` rules, the fare verdict box. It stripes; it refuses;
  it never decorates.

### Secondary
- **Pencil gray** (`#6f6f6a`): tentative marks only. Whatever is drawn in
  pencil may be wrong; whatever is inked is meant.

### Neutral
- **Inlay stock** (`#f4f1e6`): the page ground, ruled with the soft line
  every 34px on `/plan`. Warm, lined — the cards read as cards only
  against it.
- **Card stock** (`#faf7ec`): sheets, sections, stubs. One lighter stock for
  every detachable object.
- **Ruled lines** (`rgba(27, 63, 176, 0.28)` full, `0.14` soft): separation
  is always a rule in the ink, never a fill or a shadow.

### Named Rules
- **The One-Stripe Rule.** TDK red appears as the brand stripe, the refusal,
  and the auth sheet's top edge. A fourth appearance means the screen has
  stopped meaning anything.
- **The Refusal-Is-Red Rule.** A refused value is set in TDK red and a red
  rule; a blank entry is pencil-soft ink behind an em dash. Only a filled
  entry that fails earns red.
- **The Ink-Mix Rule.** Receding reading matter is the 72% ink mix, never a
  gray from outside the world. If it is not blue at some strength, it does
  not belong on the sleeve.

## Typography

**Display Font:** Caveat, self-hosted (weights 500/600/700, latin +
latin-ext woff2, `font-display: swap`)
**Second Hand:** Shadows Into Light, self-hosted (weight 400) — section
titles, ledes, hold names
**Body Font:** Barlow, self-hosted (weights 400/500/600)
**Label/Mono Font:** Martian Mono, self-hosted (weights 400/600) — every
running time, figure, reference, and label, always `tabular-nums`

**Character:** The hands name things — side heads, track cities, the dub
block, the wordmark. Barlow carries sentences. Martian Mono carries anything
measured: tape counters, hours, rupee figures, `SIDE A` rails, `TT/ROUTE`
marks. No CDN type; `barlow-sc-*` woff2 files ship on disk but the mixtape
world never calls them.

### Hierarchy
- **Display** (Caveat 700, `clamp(40px, 5vw, 64px)` / 1.02): the plan title
  (`The trip on one tape.`, underlined emphasis), one per screen.
- **Headline** (Caveat 700, `clamp(2.75rem, 8vw, 4.5rem)` / 1): the sleeve
  city name on `/result`, the navbar wordmark at `1.75rem`.
- **Title** (Shadows 400, `1.75rem` / 1.1): result section titles (`The fare,
  worked out`, `How you arrive`), auth second heads, hold names at
  `1.35rem`.
- **Hand action** (Caveat 700, `1.5rem`, +0.04em): the dub block (`Dub this
  trip`), the day numbers (`SIDE 01` voice at `1.6rem` in day heads).
- **Body** (Barlow 400, `1rem` / 1.6, max 75ch): notes, disclosures, tips,
  track notes.
- **Body large** (Shadows 400, `1.25rem`): the plan lede, the empty-destination
  line — tentative matter in the second hand.
- **Action** (Barlow 600, `1rem`): strip, auth, and result buttons.
- **Label** (mono 600, `0.75rem`, +0.08em, uppercase): entry labels (`THE
  CITY IS`), fact keys, tape refs. The plan rows set it at `12px` / +1.5px.
- **Figure** (mono 600, `1.375rem`, tabular): budget and day entries
  (`22px` in the ruled inputs with a mono mark affix), the balance figure at
  `1.75rem`, track hours at `0.85rem` right-aligned.

### Named Rules
- **The Hands-Name Rule.** A name is hand-lettered; a sentence is Barlow; a
  measurement is mono. A long mono string is prose in the wrong face.
- **The Tabular Rule.** Every time and every figure sets `tabular-nums` and
  right-aligns in its column. The signature move only works if the column
  holds still.
- **The Missing-Mark Rule.** An hour never gathered prints `—`; an unplaced
  weekday prints `UNPLACED`; a blank entry prints `— ` before its hint. Gaps
  are stamped, never smoothed over.

## Layout

One rail: `75ch` maximum for plan and result reading matter (`68rem` for the
auth gate), centred, fluid gutter `clamp(16px, 4vw, 56px)`.

- **`/plan` inner fold.** A 92px ink spine rail (rotated hand title, mono
  `SIDE A` / plan ref, 6px accent stripe at the foot) beside the main column
  (`28px` top, `64px` bottom). From 1000px the main becomes a `1.4fr / 1fr`
  grid: title, lede, and destination strip span both columns; the form runs
  column one, the pinned carry notes ride sticky (`top: 16px`) in column two.
  The three entries are ruled rows (`140–200px / 1fr`); conditions fill an
  `auto-fill minmax(180px, 1fr)` grid; interest chips wrap at 8px gaps.
- **Generating (SIDE A).** The same spine in card stock on ink: plan ref,
  city line, a cassette with two spools, the `MM:SS` tape counter, live
  narration, the honest-wait note, and the abort control.
- **`/result` box set.** A 4px accent rule caps the page. Sleeve header
  (photo plate at `16 / 7`, hand city, lede, ruled fact rows with `8rem`
  mono keys), fare ledger, day sides, arrival, notes, stay stubs, balance
  band, hand-off — top to bottom, never tabs. From `60rem` a `1fr / 9rem`
  grid carries a sticky side index. Tracks grid `2.25rem minmax(0, 1fr)
  auto`: number, place + note + flags, hour at the margin.
- **Auth gate.** Sheet (card stock, 5px accent top edge) beside the margin
  card; `7fr / 5fr` from `56rem`. The account drawer is `min(24rem, 100vw)`,
  docked right over an ink scrim.
- **Chrome.** The navbar strip is stock with one ruled bottom hairline
  (hand wordmark, mono `TT/ROUTE`, actions pushed right); the colophon is
  stock with one ruled top hairline over a `75ch` inner.

## Elevation & Depth

Flat stock, ruled separation, ink fills. There is no `box-shadow` anywhere
in the mixtape stylesheets: depth is drawn with 2px rules (destination
strip, conditions head, balance band), 1px ruled rows (full and soft line),
ink-filled panels (spine rail, day-side heads, chips and tabs switched on),
and the card-stock lift of sheets against lined stock. Focus is a 3px solid
ink outline at 2px offset on every control — the one glow the world allows,
and it means keyboard, never hover.

### Named Rules
- **The Flat-Stock Rule.** Nothing lifts. If separation needs emphasis, use
  a heavier rule or an ink fill, not a shadow.
- **The Motion-Is-Honest Rule.** The only animation is the cassette spools
  spinning while generation runs (gated behind
  `prefers-reduced-motion: no-preference`); chrome kills all animation under
  `reduce`. Motion reports work in progress, never decorates.

## Shapes

Square. `border-radius: 0` on every sheet, card, chip, button, input, pin,
and drawer — the sole radius in the world is the photographic pin's 56px
square plate with its 2px ink frame.

Separation is ruled, not boxed: 2px solid line caps the destination strip,
the conditions block, and the balance band; 4–6px of solid accent marks the
spine stripe, the result page head, and the auth sheet edge; 1px full and
soft lines rule rows and hairlines. Inputs are ruled baselines (2px ink
under plan entries) or 1px line boxes on card stock (condition cells, auth
fields); interest chips wear a 1.5px ink stroke and fill solid when on.

## Components

### Buttons
- **Shape:** square (0px), 44px minimum height everywhere (`52px` for the
  dub block). Disabled sits at 0.55 opacity; nothing else changes.
- **Dub (primary):** ink fill, stock label in Caveat 700 `24px` (+1px),
  `12px 26px`, no border. The loudest object on the counter.
- **Standard:** ink fill, stock label in Barlow 600 `1rem`, 1px ink border,
  `0.7rem 1.4rem` — strip actions, auth submits, result primaries.
- **Quiet:** transparent, ink label, 1px line-to-ink border. The hand-off
  sits in this voice — reading the sleeve is the action, not sending it.
- **Focus:** 3px ink outline at 2px offset, on every variant. No hover
  costume is specified beyond the fill the code already carries.

### Chips
- **Style:** transparent, 1.5px ink border, ink Barlow `15px`, `8px 14px`,
  square. On (`data-on="true"`) fills ink with stock text. Interest picks
  and nothing else.

### The inner fold — entries and destination
- **Entries:** three ruled rows, mono uppercase label left, answer right.
  The city answers in Caveat 600 `26px`; budget and days answer in mono
  tabular `22px` with a mono mark affix (`₹` / currency) and a Barlow unit
  tail (`days, the whole trip`).
- **Destination strip:** 2px rules top and bottom, 56px square pin with a
  2px ink frame beside the hand-set city name. The pin renders only for a
  real photograph (`/api/plan/image`, 30-day cache, `picsum.photos`
  placeholders refused); otherwise the second hand says the city is not
  pictured yet.

### SIDE-A generating card
Ink spine, stock-capped title, cassette with two spools (one spinning),
`MM:SS` mono tape counter ticking the real elapsed wait, narration lines,
and an abort control that kills the in-flight plan request. It owns the
honest wait: elapsed time and in-progress narration, never faked per-day
completion. `role="status"`, `aria-live="polite"`.

### Day sides (`.mx-rs-day`)
Card-ink head: hand day number (`1.6rem`), mono weekday (`UNPLACED` when the
solver could not place it), mono measures (`6 STOPS · 11 H 30 MIN`) pushed
right. Tracks share one ruled list — a meal is a stop that happens at an
hour — each a `2.25rem / 1fr / auto` row: faint mono number, Barlow 600
place with soft note and mono flag stamps (`HELD 40 MIN`), tabular hour at
the margin or `—` with its reason. Rework controls ride the foot in the
standard button voices.

### Fare ledger and balance
Always visible, argued never asserted. A 2px ink rule caps the balance band
(mono `1.75rem` figure, soft note); the split lists stay/food/doings/getting
about with mono tabular figures right. Only when the arithmetic demands it,
one signed sentence: a positive remainder is unattributed by the solver, a
negative one means the split is over-stated. `Budget.breakdown` is the only
source of a per-category figure — without it the foot shows the total and
the remainder only. The verdict box (2px accent border, accent line, card
ground, `role="alert"`) exists only when the budget is refused.

### Partner stubs, calculator, hand-off
- **Stubs:** stay links and the cab quote are square outbound links
  (`_blank`, `nofollow noopener`, labelled external with an arrow glyph),
  never prices. The stay list leads with its caveat; an empty shortlist
  names the city rather than showing a bare heading.
- **Road-trip calculator:** four visitor-named figures (distance, mileage,
  fuel price, tolls); the sheet does the arithmetic, prints `—` until all
  four are named. Nothing there is a quote.
- **Hand-off:** email field plus send control in the sheet's own ruled
  vocabulary; send states (sent, sending, refused) report in soft ink. The
  balance band closes every sleeve: city · days · estimated total, then the
  estimates note and the stay-links fee line.

### Inputs / Fields
Plan entries are ruled baselines (transparent, 2px ink rule, square);
condition cells and auth fields are 1px line boxes on card/stock. Labels are
mono uppercase; placeholders hold full opacity in the 85% ink mix; spin
buttons are removed globally. `aria-invalid` earns a 2px accent rule (auth)
or an accent message (plan) — and only then.

### Navigation
The strip: hand wordmark (`1.75rem`), mono `TT/ROUTE` ref, standard and
quiet buttons, 44px targets, ink focus rings, wrapping flex. The colophon:
hand mark, mono ref, 75ch soft note, mono contact line, mono legal line.
The auth segment is a two-cell mono-numbered tab pair; the selected tab is
an ink fill with a stock label.

## Do's and Don'ts

### Do:
- **Do** print card stock on the `#f6f1e7` ground, ruled with the ink lines.
  One stock, one card, one ink. The diary ground is the cover ground, so
  the cut reads as a chapter head.
- **Do** spend ink on what acts and names, pencil on what is tentative, red
  on the stripe and the refusal.
- **Do** keep corners at 0px and every time and figure in tabular mono,
  right-aligned in its column.
- **Do** stamp the gap: `—` with a reason, `UNPLACED`, the solver-does-not-
  gather line — before a plausible anything.
- **Do** argue a number: breakdown, total, and the signed remainder when
  they disagree. No `Budget.breakdown`, no invented split.
- **Do** cost in the payload's currency (`Budget.currency`,
  `city.Currency`), worked from the entered total — never a rate the repo
  holds.
- **Do** carry the estimates note on the dub block and every plan surface,
  one affiliate disclosure per wallet, and the cab-search disclosure beside
  its stub.
- **Do** pass the tape on WhatsApp from the result hand-off: a square
  outline button opening `wa.me` with city, day count, estimated total and
  the first three stops dubbed from the live plan. Self-contained text —
  no shared-view route exists yet to link to. Needs no trip handle, so it
  shows even when the email send cannot.
- **Do** admit only a real destination photograph to the plate; leave the
  pin off otherwise.
- **Do** keep `/search` a permanent redirect to `/plan` and the canonical
  tag on `/plan`.
- **Do** keep the landing (`/`, `screens/Hero.tsx`, `mx-landing.css`)
  inside its own editorial world: ivory stock, ink text, one brass accent,
  Taviraj display + Hanken Grotesk body, captioned photo plates, folio rows.
  Three of those devices are shared with `/plan` (serif display title +
  destination name, folio running head, captioned destination plate) so the
  cut reads as family; ballpoint blue still does all the acting there.
  Pill buttons and full-bleed photography never travel past the landing.
- **Do** keep the chrome (navbar, footer) neutral: handwritten ballpoint-blue
  wordmark per owner pin, mono ref, ink-outline buttons, brass focus. Rules
  and buttons belong to neither world, so they bridge both; the mark itself
  stays diary.
- **Do** arrive on `/plan` on the shared ease (`--mx-ease`, same curve as
  the cover's `--vl-ease`): one 0.9 s rise, settled under reduced-motion.

### Don't:
- **Don't** use TDK red for anything but the stripe, the sheet edge, and a
  refused value.
- **Don't** add a radius, a gradient, a shadow, glass, an emoji, a tab
  switcher for days, or a stepper for three entries.
- **Don't** invent a figure, a currency, a quote, an arrival, or a
  photograph the solver didn't return. Stubs link out; they never print
  prices.
- **Don't** fake the wait: no per-day completion, no narration ahead of the
  planner, no completion state the request hasn't reached.
- **Don't** invent proof — no testimonials, ratings, counts, or press
  (PRODUCT.md: zero proof assets exist).
- **Don't** reach past the landing's editorial world into `/plan` or
  `/result`: pill buttons, photography, and Taviraj/Hanken live in
  `mx-landing.css` (`.vl-*`) only. The wallet screens keep square coupons,
  no photography, and the Barlow/Martian Mono faces.
- **Don't** treat this file as enforced. Tooling and tokens remain
  installed; nothing stops the next route from reaching past them. Read this
  file before writing a route, and when the code disagrees, report the
  code — don't copy it.

### Drift carried, not canonized
- The landing (`screens/Hero.tsx`) was rebuilt 2026-10-12 as an editorial
  surface (`.vl-*` in `mx-landing.css`), replacing the ticket-wallet `tt-*`
  body and the hero distortion plate per owner instruction — which retires
  the old "don't restyle the distortion block" boundary. The GridDistortion
  component itself still ships untouched for any other use. The city-article
  pages (`app/cities`, `app/best-places-to-visit-in`) still render the old
  `tt-*` system pending a later pass. It is the old world, not an available
  alternative.
- Landing plates (`frontend/public/landing/*`) are owner-supplied travel
  photographs of unverified license; the Taviraj/Hanken faces are OFL.
  Re-verify the photographs before any use beyond this project.
- `--tt-vermilion-wash` is dead: zero declarations, zero references
  repo-wide. It is not an available colour.
- The email hand-off draft is untouched: the `triptribe-itinerary` Resend
  template exists for preview/manual sends only, and
  `frontend/src/server/domain/mail.ts` still speaks the old map-stock /
  vermilion / prussian language in its comments. Code-rendered mail is the
  shipping path.
