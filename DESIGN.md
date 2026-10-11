---
name: TripTribe
description: Booking a trip is issuing a wallet — coupon stock, carrier navy, carbon-red fares.
colors:
  paper: "#faf8f2"
  coupon: "#ffffff"
  paper-press: "#ece7d9"
  band-1: "#e3e4dc"
  band-2: "#d7d9cf"
  band-3: "#c9cdc1"
  band-4: "#b9bfb1"
  ink: "#14181c"
  ink-soft: "#3d454c"
  ink-faint: "#525a61"
  ink-map: "#394146"
  rule: "rgba(20, 24, 28, 0.16)"
  rule-strong: "rgba(20, 24, 28, 0.34)"
  rule-hair: "rgba(20, 24, 28, 0.09)"
  perforation: "rgba(20, 24, 28, 0.35)"
  navy: "#12305e"
  navy-deep: "#0c2347"
  navy-wash: "rgba(29, 78, 140, 0.1)"
  vermilion: "#b8341a"
  fare: "#7a1f2b"
typography:
  display:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(2.75rem, 7.2vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(1.75rem, 3.4vw, 2.6rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.018em"
  title:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(1.3rem, 2vw, 1.6rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  action:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  body-large:
    fontFamily: "'Barlow', system-ui, sans-serif"
    fontSize: "clamp(1.05rem, 1.35vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.62
  body:
    fontFamily: "'Barlow', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.66rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.14em"
  figure:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "clamp(1.15rem, 1.8vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  tab:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.14em"
  restraint:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.6rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.12em"
  verdict:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1.12rem"
    fontWeight: 600
    lineHeight: 1.28
    letterSpacing: "normal"
rounded:
  sharp: "0px"
  ring: "1px"
spacing:
  rail: "1320px"
  gutter: "clamp(1.25rem, 4vw, 4.5rem)"
  rhythm: "clamp(4.5rem, 9vw, 8.5rem)"
  sheet: "clamp(1.5rem, 3.5vw, 3rem)"
  sheet-manifest: "clamp(1.4rem, 3vw, 2.25rem)"
  verdict: "1.35rem 1.5rem 1.45rem"
  stub: "0.9rem 1rem"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.sharp}"
    padding: "0.85rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.navy-deep}"
    textColor: "#ffffff"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "0.55rem 1rem"
  day-tab:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    typography: "{typography.tab}"
    rounded: "{rounded.sharp}"
    padding: "0.3rem 0.7rem"
  day-coupon:
    backgroundColor: "{colors.coupon}"
    rounded: "{rounded.sharp}"
  stub:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.stub}"
  verdict-slip:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.vermilion}"
    typography: "{typography.verdict}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.verdict}"
  ledger-figure:
    textColor: "{colors.fare}"
    typography: "{typography.figure}"
---

# Design System: TripTribe

> **Scope.** This document describes the world as built: the ticket wallet on
> `/search` (`frontend/src/screens/Search.tsx`) and `/result`
> (`frontend/src/screens/Result.tsx`, `ActivityCard.tsx`, `HotelSection.tsx`,
> `frontend/src/lib/money.ts`) and the coupon-stock tokens in
> `frontend/src/index.css` (`--tt-*`). It is a scan of shipped code, not an
> intention. It supersedes the earlier map-stock/contour-band language: the
> page ground is coupon stock, the day grounds are white coupons, and the
> hypsometric tints survive only inside the landing map drawing.

## Overview

**Creative North Star: "The Ticket Wallet"**

Booking a trip is issuing a wallet. `/search` is the counter where the
organiser books the route — three numbered entries on one manifest coupon,
frank about what the wallet will hold and how the money works. `/result` is
the issued wallet: the same sheet filled in, a run of day coupons torn off in
sequence, the fare ledger ruled at its foot, partner stubs riding along as
visibly external coupons. The category default for an AI trip planner is a
rounded card grid with a pill CTA and a photograph. This world refuses all
three: square coupons, dashed perforation, ruled fare boxes, and no image
anywhere — the city is named in the display face, not shown.

The restraint is load-bearing. Coupon-stock white (`#ffffff`) on a warm paper
ground (`#faf8f2`), carrier navy (`#12305e`) for the product acting, carbon
red (`#7a1f2b`) for fare figures, vermilion (`#b8341a`) only for refused
values. Type does the work a card grid would do: a condensed transit face for
signage, a humanist sans for reading, one monospace for measurement.

**Key Characteristics:**
- One object, two states: the blank manifest lifts off the stock, the issued
  wallet runs the full rail with no border and no fill.
- Day coupons tear apart on dashed perforation under navy tabbed heads.
- Fare figures print in carbon red; vermilion means "refused value", never
  decoration.
- Square corners, tabular figures, uppercase mono labels at wide tracking.
- Partner stubs are outbound coupons with one affiliate disclosure per wallet.

## Colors

Coupon stock plus three inks with fixed jobs: navy acts, carbon red prices,
vermilion refuses. No gradient anywhere in the system.

### Primary
- **Carrier navy** (`#12305e`): the issuing block (**Issue the route**), the
  day tabs, the ₹ affix, stub and stay links, step numerals, focus ring,
  selection. Its deep partner `#0c2347` is the hover state of anything already
  navy. Never a large background wash, never a heading colour.
- **Carbon-red fare** (`#7a1f2b`): fare figures only — `.tt-split__val`,
  `.tt-balance-line__figure`, and a non-empty `.tt-calc__figure`. It prices;
  it never refuses.
- **Vermilion** (`#b8341a`): reserved, with no exceptions, for a value the
  product turns down — `.tt-field__error` text and its 6px square bullet, the
  2px input rule when `aria-invalid="true"`, the verdict line. It appears
  nowhere else.

### Neutral
- **Paper** (`#faf8f2`): the page ground. Warm, not white; the coupons read as
  coupons only against it.
- **Coupon white** (`#ffffff`): sheets, day coupons, stubs. One white for every
  detachable object.
- **Pressed stock** (`#ece7d9`): the estimate calculator panel and the
  scrollbar track. The darkest ground text sits on.
- **Ink** (`#14181c`): body and heading text, the 2px section rule.
- **Ink, soft** (`#3d454c`): reading matter that recedes — ledes, notes,
  disclosures. 7.1:1 on pressed stock.
- **Ink, faint** (`#525a61`): labels, hints, references, absent measurements.
  5.1:1 on pressed stock — the tier that sets the measured floor.
- **Ink, map** (`#394146`): marginalia inside the landing map drawing only.
- **Hypsometric bands** `#e3e4dc` → `#d7d9cf` → `#c9cdc1` → `#b9bfb1`: retained
  as tokens for the landing map drawing. They no longer ground days or sheets.

### Named Rules
- **The Three-Ink Rule.** Navy acts, carbon red prices, vermilion refuses. If
  a fourth saturated colour appears, the screen has stopped meaning anything.
- **The Verdict Rule.** Vermilion is never an accent, never a hover, never a
  highlight. If nothing is wrong with the visitor's input, vermilion does not
  exist.
- **The Darkest-Ground Rule.** Any ink must clear 4.5:1 against the darkest
  ground it can land on. Vermilion renders on sheet stock at 5.10:1 under a
  2px terminal rule — never on pressed stock, never on a band.
- **The Foreign-Mark Exemption.** The rule governs colour we choose. A third
  party's mark (Google/GitHub provider buttons) is exempt only as a logo, at
  no other size and in no other colour, carrying no state.
- **The Flat Print Rule.** Separation is drawn with ink at low alpha (hair 9%,
  rule 16%, strong rule 34%) and dashed perforation — never with fills,
  glass, or shadow, except the one Sheet device.

## Typography

**Display Font:** Barlow Semi Condensed, self-hosted (weights 500/600/700)
**Body Font:** Barlow, self-hosted (weights 400/500/600)
**Label/Mono Font:** Martian Mono, self-hosted (weights 400/600)

**Character:** The condensed face is transit signage — display lines, entry
asks, stop places, button labels. Barlow carries sentences. Martian Mono
carries anything measured: day counts, rupee figures, reference codes, tabs,
restraints. All three are self-hosted woff2 under `frontend/public/fonts/`
with `font-display: swap`; no CDN type.

### Hierarchy
- **Display** (700, `clamp(2.75rem, 7.2vw, 5.5rem)` / 0.96, −0.028em): the
  thesis line (`Book the route, not the list.`) and the issued city name. One
  per screen, never centred.
- **Headline** (600, `clamp(1.75rem, 3.4vw, 2.6rem)` / 1.05): section headings
  on the 2px ink rule.
- **Title** (600, `clamp(1.3rem, 2vw, 1.6rem)` / 1.15): stay names, stop
  places, sheet titles.
- **Body large** (400, `clamp(1.05rem, 1.35vw, 1.25rem)` / 1.62, max 66ch):
  ledes.
- **Body** (400, `1rem` / 1.6, max 68ch): notes, disclosures, verdict bodies.
- **Action** (600, `1rem`, +0.01em): button and issuing-block labels.
- **Label** (mono 600, `0.66rem`, +0.14em, uppercase): entry labels, reference
  marks (`TT/ROUTE / MANIFEST`, `ISSUED WALLET · TT/WALLET`).
- **Tab** (mono 600, `0.72rem`, +0.14em): the navy day tabs (`DAY 01`).
- **Figure** (mono 600, `clamp(1.15rem, 1.8vw, 1.5rem)`, `tabular-nums`): days
  and budget inputs, the ₹ affix, ledger totals. Tabular is mandatory.
- **Restraint** (mono 600, `0.6rem`, +0.12em): contract limits (`1 TO 60`,
  `ESTIMATE`, `AS ENTERED`).
- **Verdict** (display 600, `1.12rem`): the refusal line. Vermilion takes this
  voice and nothing else: no stripe, no chip, no icon.

### Named Rules
- **The Measuring-Face Rule.** Mono is for measurement, codes and figures.
  A sentence read as prose is Barlow; a longer mono string is in the wrong
  face.
- **The Transit Signage Rule.** Signs are condensed, upright, tight tracking.
  Positive tracking is a mono-label device. Nothing asks for an italic cut —
  the roster ships upright only, so absences read in upright `ink-faint`.
- **The Refusal-is-Type Rule.** A refusal is set, not shown. Vermilion claims
  its lines in type on the sheet's own stock, never on a coloured panel.
- **The Blank-Is-Not-Refused Rule.** An entry left blank reads in `ink-faint`
  behind the same em dash every absent measurement carries. Only a filled
  entry that fails earns vermilion — on the message, its square, and the
  field rule.

## Layout

One rail: `1320px` maximum, centred, fluid gutter
`clamp(1.25rem, 4vw, 4.5rem)`. One rhythm token,
`clamp(4.5rem, 9vw, 8.5rem)`, pads the bottom of each major band. Text
measures stay narrow: lede 66ch, body 68ch, disclosures 62ch.

- **`/search` counter.** One column below 900px (about, sheet, carry list
  stacked). From 900px, two columns `1.12fr / 1fr`: the manifest sheet alone
  in column one, the issue line above the `TT/CARRY` list in column two. From
  1180px, three columns `0.84fr / 1.2fr / 0.88fr`: issue, raised sheet, carry
  list. All tracks are `minmax(0, …)` so a long mono reference never blows
  out a column.
- **`/result` wallet.** One column, full rail, top to bottom — never tabs. The
  issued sheet carries entries 01–06 in fixed order: money, route, arrival,
  notes, sleep, hand-off. Order is the argument.
- **Inside the sheet.** Entries grid `2.5rem minmax(0, 1fr)` (2rem below
  899px): mono number, uppercase display ask, answer. Stop rows grid
  `5.5rem minmax(0, 1fr)`, collapsing to one column with the figure on its own
  line. Stay rows `minmax(0, 1fr) auto`, figures dropping to their own line
  below 600px. Calculator fields run four-up, pairing two-by-two from 1179px
  so a label and its unit always travel together. Day measures drop to their
  own line rather than squeeze.
- **No image on either screen.** The city is named in type with destination
  facts; every figure is drawn in rules and stock tints.

## Elevation & Depth

There is exactly one shadow, `--tt-lift` (`0 1px 2px rgba(20,24,28,0.06),
0 12px 32px -12px rgba(20,24,28,0.22)`): a sheet resting on a surface, never
a hard zero-blur block, never an interactive cue. It lifts the blank manifest
sheet and the verdict slip — a refusal is the one thing on a signed sheet
that earns a raise. The issued wallet itself is flat: borderless, fill-less,
separated by hairlines and perforation. The calculator sits *into* the paper
on pressed stock rather than lifting. Everything else separates by tonal
layering.

### Named Rules
- **The Shadow-Budget Rule.** Two surfaces are lifted: the blank sheet and
  the verdict slip. A third needs a material reason, not a preference.
- **The Soft-Join Rule.** No blur-heavy glows, no glass, no backdrop filters.

## Shapes

Square. No radius token; `border-radius: 0` on sheets, coupons, stubs, tabs.
The sole exception is `1px` on the global `:focus-visible` outline.

Separation is ruled, not boxed: 2px solid ink caps a section or the ledger;
1px at 34% alpha rules sheet heads and stub borders; 1px at 16% rules item
edges; 1px at 9% rules field rows and fine print. Between day coupons, one
device only: **2px dashed perforation** at 35% ink across the coupon top
(`.tt-day:first-child` carries none — the first coupon is still attached to
the sheet).

## Components

### Buttons
- **Shape:** square (0px). The issuing block is the loudest object on the
  counter.
- **Primary:** navy fill, white action-face label, 1px navy border,
  `0.85rem 1.5rem`, arrow gap `0.7rem`.
- **Hover / Focus:** fill and border go navy-deep, lift `translateY(-1px)`
  over 0.25s on `--tt-ease` (`cubic-bezier(0.16, 0.84, 0.44, 1)`); arrow slides
  `translateX(3px)`. `:active` returns to rest. Global focus is a 3px navy
  outline at 2px offset; form fields carry focus on their own rule instead
  (navy 2px rule plus `0 2px 0 0` navy shadow).
- **Quiet:** transparent with a 1px ink border, ink label, `0.55rem 1rem`;
  hover fills ink with paper-lift text. The hand-off sits in this voice —
  reading the sheet is the primary action, not sending it.
- **Never disabled at the counter.** The issue button stays live; an unfilled
  field is answered with a refusal naming what to do, not a dead control.

### The manifest sheet — one component, two states
A ledger of numbered entries between a rule-strong head and an issuing foot.
- **Blank** (`/search`): white, 1px `rule-strong` border, the Sheet shadow,
  `clamp(1.4rem, 3vw, 2.25rem)` padding. Head reads `TT/ROUTE / MANIFEST`
  with the slash in navy. Three entries — the city is, the trip costs under,
  you have — each an instruction, not a noun, with restraint stamps beside
  the ask.
- **Issued** (`/result`, `.tt-sheet--filled`): `border: 0`, `background: none`,
  `padding: 0`, full rail. Head becomes `TT/ROUTE / FILLED`; entries answer in
  `ink-soft` body capped at 62ch. Six entries, fixed order: 01 money and its
  verdict, 02 the route as a run of day coupons, 03 arrival, 04 notes, 05
  sleep, 06 the hand-off.

### Day coupons (`.tt-day`)
White coupons on the paper ground, torn apart by the dashed perforation —
this supersedes the earlier alternating tint grounds; no band sits under a
coupon. The head is a flex row: the **navy tab** (white mono `DAY 01`,
`.3rem .7rem`, +0.14em), the weekday in display 600 (`UNPLACED` when the
solver could not place it), the measure (`6 STOPS · 11 H 30 MIN`) in faint
mono pushed to the far end. Stops and meals share one ruled list — a meal is
a stop that happens at an hour — each a `5.5rem / 1fr` row with the hour in
faint mono tabular and the place in display 600. Flags (`HELD 40 MIN`,
`OPENS LATER`) are faint mono stamps. An hour never gathered prints `—` in
faint ink, never a fabricated time; an empty day says so upright.

### Fare ledger (`.tt-split`) and balance (`.tt-balance`)
Always visible, argued never asserted. A 2px ink rule caps the ledger; each
category is a ruled row with an uppercase display key left and a mono tabular
**carbon-red** figure right. Four categories — stay, food, doings, getting
about — then the total, then, only when the arithmetic demands it, one
sign-branched sentence: a positive remainder is unattributed by the solver, a
negative one means the split is over-stated. An exact sheet says nothing. No
breakdown from the solver is said out loud rather than invented. The sheet
closes on the `ISSUED` balance line — city, days, estimated total — and one
soft note carrying the estimates disclaimer.

### Verdict slip (`.tt-verdict`)
The only raised refusal in the world: white, the Sheet shadow,
`1.35rem 1.5rem 1.45rem`. Exists only when the budget is refused — one
display-600 vermilion line, solver message and alternatives as body copy and
ruled rows. It reports; it does not apologise and offers no retry styling.

### Partner stubs (`.tw-stub`, `.tt-stay__link`)
Visibly external coupons riding the wallet: white, 1px rule-strong border,
radius 0, `0.9rem 1rem`, `margin-top: 1rem`. Links are navy 600 to real
destinations (Google Hotels with hotel + city in the query; a ride-search
query beside the fuel estimator) — `_blank`, `nofollow noopener`, each
labelled external, never a quote. Stay links speak in mono uppercase
(`.7rem`, +0.1em, navy). One `.tw-disclosure` per wallet (`.78rem`,
ink-soft, 62ch): live prices open elsewhere, estimates are worked from the
entered total, TripTribe may earn a fee on outward stay links. The stay list
leads with its caveat — figures are worked out, never quoted — and an empty
shortlist names the city rather than showing a bare heading.

### Inputs / Fields
No box: transparent fill, a 1px ink bottom rule only, `0.25rem 0 0.5rem`
padding, mono label above at `0.66rem` / +0.14em uppercase in faint ink. City
is display 600 (a place name is a name); days and budget are mono 600 tabular
with a navy ₹ affix. Placeholders are faint ink at full opacity — never
greyed. Hints are faint `0.78rem`, replaced by the error line when refused.
Spin buttons are removed globally.

### Closing band (`.tt-close`)
The last line: 2px ink rule, display closing line, faint fine print under its
own hairline. It carries no gutter of its own — always wrapped in
`.tt-page` / `.tt-rail`, never returned bare.

## Do's and Don'ts

### Do:
- **Do** print coupons white on the `#faf8f2` ground. One white, one ground.
- **Do** spend navy on the issue, the tabs, and reference/data marks only.
- **Do** price every fare figure in carbon red on white or pressed grounds.
- **Do** tear day coupons on the 2px dashed perforation under navy tabs.
- **Do** separate the rest with hairlines, and cap headings and the ledger
  with the 2px ink rule.
- **Do** keep corners at 0px and figures in mono with `tabular-nums`.
- **Do** argue a number: breakdown, total, and the signed remainder when they
  disagree. Print `—` with a reason before a plausible number.
- **Do** format the currency the payload names (`Budget.currency`,
  `city.Currency`) and fall back to ₹ — never apply a rate the repo holds.
- **Do** gate blocks on data that exists, never on a field the solver hasn't
  gathered. Render the payload; blank the gap.
- **Do** carry the estimates disclaimer on every surface showing a plan, and
  one affiliate disclosure per wallet.
- **Do** keep the hand-off on the sheet in the sheet's own hairline
  vocabulary, and report a failed send in faint ink — never vermilion.

### Don't:
- **Don't** use vermilion for anything but a refused value, or on any ground
  but sheet stock.
- **Don't** put a band tint under a coupon, a control, or a stub. Bands live
  inside the landing map drawing.
- **Don't** add a radius, a gradient, glass, an emoji, a tab switcher for
  days, or a stepper for three entries.
- **Don't** add a second shadow or lift the issued wallet. Flat, ruled,
  perforated.
- **Don't** invent proof — no testimonials, ratings, counts, or press
  (PRODUCT.md: zero proof assets exist).
- **Don't** invent a figure, a currency, a quote, or an arrival the solver
  didn't return. External stubs link out; they never print prices.
- **Don't** restyle the landing hero distortion block. Fixed by owner
  instruction — a boundary, not a precedent.
- **Don't** treat this file as enforced. daisyUI and Tailwind remain
  installed; nothing stops the next route from reaching past the tokens. Read
  this file before writing a route, and when the code disagrees, report the
  code — don't copy it.

### Drift carried, not canonized
- `--tt-vermilion-wash` is declared in `:root` and used by nothing. It is a
  dead token, not an available colour.
