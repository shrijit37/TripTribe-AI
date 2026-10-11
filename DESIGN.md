---
name: TripTribe
description: A trip is a route, not a list — the landing world is a printed route insert on uncoated map stock.
colors:
  stock-paper: "#e7e6e0"
  stock-lift: "#efeee9"
  stock-press: "#dedcd4"
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
  prussian: "#1d4e8c"
  prussian-deep: "#163c6d"
  prussian-wash: "rgba(29, 78, 140, 0.1)"
  vermilion: "#b8341a"
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
  data:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "clamp(1.15rem, 1.8vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  data-caption:
    fontFamily: "'Martian Mono', ui-monospace, monospace"
    fontSize: "0.68rem"
  entry-ask:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
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
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.12em"
rounded:
  sharp: "0px"
  ring: "1px"
spacing:
  rail: "1320px"
  gutter: "clamp(1.25rem, 4vw, 4.5rem)"
  rhythm: "clamp(4.5rem, 9vw, 8.5rem)"
  sheet: "clamp(1.5rem, 3.5vw, 3rem)"
  sheet-manifest: "clamp(1.4rem, 3vw, 2.25rem)"
  entry: "1.4rem 0 1.25rem"
  verdict: "1.35rem 1.5rem 1.45rem"
  ledger: "clamp(1.25rem, 2vw, 2rem)"
  row: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.prussian}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.sharp}"
    padding: "0.85rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.prussian-deep}"
    textColor: "#ffffff"
  nav-link-primary:
    backgroundColor: "{colors.prussian}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.sharp}"
    padding: "0.5rem clamp(0.75rem, 2vw, 1.1rem)"
  nav-link-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.sharp}"
    padding: "0.5rem clamp(0.75rem, 2vw, 1.1rem)"
  field-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.sharp}"
    padding: "0.25rem 0 0.5rem"
  slip-sheet:
    backgroundColor: "{colors.stock-lift}"
    rounded: "{rounded.sharp}"
  sheet-manifest:
    backgroundColor: "{colors.stock-lift}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.sheet-manifest}"
  sheet-issued:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sharp}"
    padding: "0"
  verdict-slip:
    backgroundColor: "{colors.stock-lift}"
    textColor: "{colors.vermilion}"
    typography: "{typography.verdict}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.verdict}"
  day-band:
    backgroundColor: "{colors.band-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "1.5rem 0 1.75rem"
  stop-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sharp}"
    padding: "0.8rem 0"
  ledger-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sharp}"
    padding: "0.7rem 0"
    padding: "{spacing.sheet}"
  map-sheet:
    backgroundColor: "{colors.stock-paper}"
    rounded: "{rounded.sharp}"
    width: "100%"
  section-heading:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
---

# Design System: TripTribe

> **Scope.** This document describes the world as built on the landing surface (`/`) and
> the auth surface (`/auth` plus the account drawer) — the files
> `frontend/src/index.css`, `frontend/src/pages/Hero.jsx`,
> `frontend/src/components/ContourRoute.jsx`, `frontend/src/components/Navbar.jsx`,
> `frontend/src/pages/Auth.jsx`, `frontend/src/components/Coastline.jsx`,
> `frontend/src/components/AccountDrawer.jsx` and
> `frontend/src/components/Footer.jsx`. It is a scan of shipped code, not an intention.
> Two surfaces are still **outside** this world and are recorded as such under *Layout*
> and *Do's and Don'ts*: `/search` and `/result`.

>
> **Amended.** `/search` and `/result` have since been migrated into this world
> (`frontend/src/screens/Search.tsx`, `frontend/src/screens/Result.tsx`,
> `frontend/src/components/ActivityCard.tsx`, `frontend/src/components/HotelSection.tsx`,
> `frontend/src/lib/money.ts`, and a new block in `frontend/src/index.css`). They are no
> longer outside it and no longer exempt from it. What is written below as scope is the
> landing and auth world; every section marked *extended by the `/search` + `/result`
> build* is the same world's answer to a transit manifest and the sheet it issues, and those
> sections are as normative as the ones they follow.

## Overview

**Creative North Star: "The Transit Supplement"**

A trip is a service that issued a printed route insert. This page is that insert: uncoated
map stock, hypsometric contour bands, hairline rule work, and exactly two functional inks.
The category default for an AI trip planner is a full-bleed photograph over a rounded card
grid of benefits with a pill CTA. This surface refuses to summarise the trip at all. Below
the photograph — which is a fixed element of this build, see *Do's and Don'ts* — the first
thing on the page is the routing device the product actually produces: a contour map with a
single prussian line threading from a marked origin to a marked terminus, redrawn live from
the three form fields below it.

The restraint is load-bearing, not timid. Neutrals are not grey; they are tinted from the
stock itself (`#e7e6e0` warm, `#dedcd4` pressed, `#efeee9` lifted), so the page reads as one
material under one light. Prussian `#1d4e8c` is the only saturated ink the visitor will see,
and it is spent in exactly three places: the route line, the primary action, and the
reference marks that mean "this is data". Vermilion `#b8341a` is not an accent at all. It
appears only where the product is refusing a value the visitor typed — a budget below ₹1,000,
a day count outside 1–60. When vermilion is on screen, something is wrong, and it is
recoverable.

Depth comes from paper, not from UI convention: tonal layering, hairline rules, and a single
sheet resting on a surface. Corners are square throughout, because paper has none. Type does
the work that a card grid would otherwise do: a condensed transit face for display, a
humanist sans for reading, and one monospace reserved strictly for measurement, codes and
figures.

The one live mechanic is the map, and it is driven by real state — city, days and budget —
not by a timer. That is the thesis stated before a word of copy is read.

**Key Characteristics:**
- Two functional inks on one tinted stock; vermilion means "rejected value", never decoration.
- Hairline rule work separates everything; shadow is used twice and only to say "sheet on table".
- Square corners, tabular figures, uppercase mono labels at wide tracking.
- The map is a component with a thesis, not an illustration beside the copy.
- Every browser surface — selection, focus, scrollbars, underline offsets, spin buttons — is themed.

**Extended by the `/search` + `/result` build.** Those two screens are now the system's
second and third examples rather than its exception: the same stocks, inks, three faces,
square corners and hairline grammar, with no new token of any kind added to serve them.
What the build established is not a palette or a component kit but a **document
relationship** — one object shown twice.

- `/search` is a transit manifest: three ordered entries, `01` `02` `03`, filled in one
  pass, issued by a single prussian block at its foot.
- `/result` is *the same sheet*, filled in and issued. The DOM is the same component on
  both routes; the blank sheet lifts off the stock and loses its border, the filled sheet
  runs the full rail. One form, one sheet, one grammar.
- The cost ledger is **always argued**. Total plus the four-way breakdown are visible as
  ruled rows on every sheet; a vermilion verdict slip appears *only* where a value was
  refused, and it is the one raised panel on `/result`.
- The day band is a **value axis** now, not only a map convention: alternating band-1 /
  band-2 grounds give each day a ground of its own, and the day's anchor stop is marked by
  taking both its hour and its place into prussian. Nothing else on the page changes.
- There is **no image** on either screen. The city is named in the display face rather than
  shown, the sheet is the object, and every figure that belongs to the product is drawn in
  CSS rules and stock tints.

**Key Characteristics, extended by this build:**
- Measure every new ink against the ground it actually lands on, not against the ground it
  was designed on. Both `/result` bands clear the 4.5:1 floor for `ink-faint` (5.48:1 on
  band-1, 4.92:1 on band-2) and for prussian (6.50:1 / 5.84:1).
- Mark a refusal with the type colour, never with a coloured stripe or a filled chip.
- Budget figures belong in a mono figure with a restraint label beside them, and totals get
  the treatment, not every number on the page.
- Never ship a figure the visitor did not enter: a solver-void cost prints `—` with a
  stated reason, and it prints at `ink-faint` rather than at the ink.

## Colors

The palette is tinted stock plus four near-neutral inks, one saturated blue and one
functional red. There is no second accent and no gradient anywhere in the system.

### Primary
- **Prussian** (`#1d4e8c`): the route line on the map, the primary button, the focus ring,
  the ₹ affix, the step numerals `01/02/03`, and the marginal contact address. It is the
  product acting. Never used as a background wash for a large region, never as a heading
  colour, never as a link colour on body copy. Its deep partner `#163c6d` is the hover state
  of anything already prussian (8.33:1 white-on-prussian rises to 11.05:1).
- **Vermilion** (`#b8341a`): reserved, with no exceptions in this build, for a value the
  product cannot accept — `.tt-field__error` text and its 6px square bullet, and the 2px
  input rule when `aria-invalid="true"`. It appears nowhere else, including nowhere in
  marketing copy, illustration or hover state.

### Neutral
- **Stock, paper** (`#e7e6e0`): the page ground and the map sheet. Warm, not white; a
  white page would break the printed-insert illusion instantly.
- **Stock, lifted** (`#efeee9`): the slip — the one raised sheet that carries the form.
- **Stock, pressed** (`#dedcd4`): the footer ground and the scrollbar track. This is the
  darkest ground the ink scale has to survive, which is why the ink ratios are measured
  against it and not against paper.
- **Ink** (`#14181c`): body and heading text, the 2px section rule, the origin marker,
  contour hairlines at 22% opacity. 14.27:1 on paper, 12.99:1 on pressed stock.
- **Ink, soft** (`#3d454c`): reading matter that recedes — ledes, card bodies, the map
  caption, the footer note. 7.10:1 on pressed stock.
- **Ink, faint** (`#525a61`): labels, hints, references, legal line, placeholders.
  5.11:1 on pressed stock — the tier that sets the measured floor for this system.
- **Ink, map** (`#394146`): map marginalia only — spot heights, north arrow, scale bar.
  These sit on the contour tints rather than on bare paper, so they carry their own ink:
  5.52:1 on the darkest band `#b9bfb1`. `ink-faint` would drop to 3.72:1 there, which is
  exactly why this fourth tier exists.
- **Hypsometric bands** `#e3e4dc` → `#d7d9cf` → `#c9cdc1` → `#b9bfb1`: a four-step tint scale,
  lightest band outermost. They are a value axis on a map, not a decorative gradient, and
  they are never used behind UI controls.

### Rules
- **The Two-Ink Rule.** The page may be saturated in exactly two inks. Prussian is what the
  product does; vermilion is what it refuses. If a third saturated colour appears, the screen
  has stopped meaning anything.
- **The Foreign-Mark Exemption.** The Two-Ink Rule governs colour we choose. A third
  party's mark — the Google and GitHub logos on the auth provider buttons — is the one
  exception, and it is exempt only as a logo: recognisable at no other size, in no other
  colour, and degraded to grey the moment it stops being the mark. It carries no state,
  no hover, no emphasis, and never appears anywhere else in the world. Everything
  around it stays on the world's own two inks, and if a third party were ever drawn in
  anything but its official mark, the exemption does not reach it.
- **The Verdict Rule.** Vermilion is never an accent, never a hover, never a "highlight your
  plan" cue. If nothing is wrong with the visitor's input, vermilion does not exist.
- **The Darkest-Ground Rule.** Any new ink tier must clear 4.5:1 against the darkest ground
  it can land on — currently pressed stock for text on paper, and band 4 for anything drawn
  inside the map. Vermilion currently clears 5.10:1 on the lifted slip stock where it
  actually renders; it would not clear the floor on pressed stock, so it must never be used
  in the footer or on a band.
- **The Flat Print Rule.** Separation is drawn with ink at low alpha (hair 9%, rule 16%,
  strong rule 34%) rather than with borders, fills or shadow.

- **The Band-Axis Rule, extended.** The hypsometric tints may leave the map when the tint is
  doing the same job the map does — carrying a value. On `/result` a day is a contour band
  lying down: alternating `band-1` / `band-2` grounds give each day its own ground without
  a rule, a fill or a card, and both steps are inside the text floor (`ink-faint` 5.48:1 and
  4.92:1; prussian 6.50:1 and 5.84:1). `band-3` and `band-4` remain map-only, and a band
  may never sit under a control.
- **The Posted-Sheet Rule.** Prussian may take one further form on a sheet: a reference or
  restraint mark, mono and wide-tracked, printed as a stamp on the form — `TT/ROUTE /
  FILLED`, `ESTIMATE`, `GATHERED`, the day's anchor. It never becomes a heading, a fill or

  a border.

## Typography

**Display Font:** Barlow Semi Condensed, self-hosted (weights 500/600/700, latin + latin-ext)
**Body Font:** Barlow, self-hosted (weights 400/500/600, latin + latin-ext)
**Label/Mono Font:** Martian Mono, self-hosted (weights 400/600, latin + latin-ext)

**Character:** The condensed face is transit signage — platform boards, departure cards, the
condensed lettering on a route supplement — and it carries anything that behaves like a
sign: display headlines, section headings, item names, and button labels. Barlow carries
anything a person reads in sentences. Martian Mono carries anything a person measures:
day counts, rupee figures, coordinates, step numbers, reference codes, legal and hint text.

All three families are self-hosted as 16 latin woff2 subsets under `frontend/public/fonts/`
and declared with `font-display: swap`. There is no CDN type on this page.

### Hierarchy
- **Display** (700, `clamp(2.75rem, 7.2vw, 5.5rem)` / 0.96, −0.028em, balanced, max 14ch):
  the thesis line only — "A trip is a route, not a list". One per page, never centred.
- **Headline** (600, `clamp(1.75rem, 3.4vw, 2.6rem)` / 1.05, −0.018em): section headings,
  each sitting on a 2px ink rule. Also the closing statement.
- **Title** (600, `clamp(1.3rem, 2vw, 1.6rem)` / 1.15, −0.012em): item names — what comes
  back, how it works. The numbered run uses the same step two hundredths smaller
  (`clamp(1.25rem, 2vw, 1.55rem)`); treat it as one step.
- **Body large** (400, `clamp(1.05rem, 1.35vw, 1.25rem)` / 1.62, max 66ch): the lede under
  the display line.
- **Body** (400, `1rem` / 1.6, max 68ch): item copy, map caption, footer note.
- **Action** (600, `1rem`, +0.01em): button and nav-link labels.
- **Label / data** (600, `0.66rem`–`0.72rem`, +0.14em–0.18em, uppercase): field labels,
  `TT/ROUTE` reference marks, `ORIGIN`, step numerals.
- **Figure** (600, `clamp(1.15rem, 1.8vw, 1.5rem)`, `tabular-nums`): the days and budget
  inputs and the ₹ affix. Tabular is mandatory — these are numbers a person compares.

### Rules
- **The Measuring-Face Rule.** Martian Mono is used for measurement, codes and figures, never
  as a costume. A sentence a visitor has to read as prose is set in Barlow; if a mono string
  is longer than a reference mark, a label or a figure, it is in the wrong face.
- **The Transit Signage Rule.** Anything acting as a sign — a headline, a name, a button —
  is set in Barlow Semi Condensed, upright, with negative tracking tightening as size grows.
  Never letterspaced positive in the display face; positive tracking is a mono-label device.
- **The Sign, Not the Kicker Rule.** Reference marks in this world (`TT/ROUTE`, the slip
  reference) are baseline-aligned *beside* the heading they belong to, in the column head —
  never stacked above a heading as a lead-in line. The world does use reference marks; their
  position is the part that carries the meaning.
- **Fallback honesty.** The display stack is `'Barlow Semi Condensed', 'Arial Narrow',
  sans-serif`. If the woff2 fails to load, the condensed character is lost and headings fall
  back to generic sans — a real degradation, not a designed one. Verify the font actually
  loads before judging a screenshot.
- **The Ask-Is-Signage Rule, applied to a form.** An entry's ask is the sign on that entry —
  display face, 600, uppercase, tight tracking, 0.78rem — and the value beside it is set in
- **The Refusal-is-Type Rule.** A refusal is set, not shown. Vermilion claims its lines by
  taking the display face at 1.12rem and nothing else: no stripe, no chip, no icon, no fill
  beyond the stock it sits on.
  panel; a form that asks its questions in signage is a manifest.
- **The Restraint Rule.** A contract limit (`1 TO 60`, `Min 1,000 · step 100`) is a mono
  stamp at 0.6rem / +0.12em, and the unit or the consequence is set *beside* the field in
  Barlow rather than appended to the stamp. Long enough to read, quiet enough to ignore.
- **The Refusal-is-Type Rule.** A refusal is set, not shown. Verdilion claims its lines by
  taking the display face at 1.12rem and nothing else: no stripe, no chip, no icon, no fill
  beyond the stock it sits on.

## Layout

One rail: `1320px` maximum width, centred, with a fluid gutter of
`clamp(1.25rem, 4vw, 4.5rem)` on both sides. Every section is a `.tt-rail`. Vertical rhythm
is a single token, `--tt-rhythm: clamp(4.5rem, 9vw, 8.5rem)`, used as the bottom padding of
each major band so the gaps between sections are unmistakably larger than the gaps inside
them.

The grid is a ruled ledger, and rules change orientation rather than content:

- **Below 900px** — one column. The thesis is copy then map. The slip's three fields stack as
  horizontal rows separated by hairline rules. Lists stack with a rule between items.
- **From 900px** — the thesis splits `0.85fr / 1.15fr` (copy, then map; refined to
  `0.8fr / 1.2fr` from 1280px). The form becomes three ruled columns at
  `1.6fr / 0.7fr / 1fr` with *vertical* hairlines between fields instead of stacked rows,
  and the action row spans all three. The included and flow lists become three columns with
  vertical rules and a shared gutter of `clamp(1.25rem, 2vw, 2rem)`. The footer becomes a
  row with the note pushed onto its own full-width line.

Two honest notes. First, the surface brief promised a "sacred column lattice" that *scales*
rather than reflows; in the code it scales above 900px and **reflows to a single column
below it**, so the ledger reading is a wide-viewport behaviour, not a universal one. Second,
text measures deliberately narrow: display capped at 14ch, lede and body at 66–68ch, the map
caption at 58ch, the closing line at 22ch. Long measures are not permitted in this world.

### The manifest spread (`/search`)

`/search` re-uses the rail and the rhythm token and adds one grid of its own. It is one
column by default with a `clamp(2.25rem, 5vw, 3.5rem)` gap; it steps twice, and the second
step is the one the direction contract describes:

- **Below 900px** — the display line, then the sheet, then the carry list, stacked. The
  sheet is the object; everything else is margin.
- **From 900px** — two columns, `minmax(0, 1.12fr) minmax(0, 1fr)`: the sheet holds column
  one alone, and the issue line sits above the carry list in column two. A `2.5rem` gutter
  separates the entry numbers from their asks.
- **From 1180px** — three columns, `minmax(0, 0.84fr) minmax(0, 1.2fr) minmax(0, 0.88fr)`:
  the issue in the left margin, the raised sheet in the middle, the carry list in the right
  margin. The three tracks are `minmax(0, …)` throughout, so a long mono reference can
  never blow out a column.

The issued sheet on `/result` inverts that: one column, full rail, no side margin, because a
signed document is not a panel on a page. Its internal measures are `5.5rem / minmax(0, 1fr)`
for a stop row, `2.5rem / minmax(0, 1fr)` for an entry, `minmax(0, 1fr) / auto` for a hotel
row, and `repeat(5, minmax(0, 1fr))` for the five facts under the title (two columns below
900px). Every one of them collapses to a single column, with the figure set on its own line
rather than centred under it, at the breakpoint named in the component.

The estimate calculator is the one place the four-up row is not four labels in a row: from
1179px the fields pair two-by-two so a label and its unit always travel together.

caption at 58ch, the closing line at 22ch. Long measures are not permitted in this world.

## Elevation & Depth

There is exactly one shadow in the system, `--tt-lift`, and it appears twice: on the map
sheet and on the slip sheet. It is a *sheet resting on a surface* — a 1px/2px contact layer
at 6% ink plus a wide 12px/32px diffuse layer at 22% ink offset upward by 12px. It is never
a hard offset block with zero blur, and it never conveys interactivity. Everything else
separates by tonal layering: stock-paper for the page, stock-lift for the raised sheet,
stock-press for the footer, and hairline ink rules for everything inside a sheet.

Two further depth devices exist and neither is a shadow. The seam between the fixed
photograph and the paper is a single irregular cut drawn in a `0 0 1000 34` user space and
stretched full-width, so its undulation stays a fraction of the viewport at any width
(`clamp(22px, 3.4vw, 44px)` tall) instead of flattening to a straight edge; a 14px gradient
from 10% ink to transparent below the cut reads as light catching the fold. Inside the map,
a `feGaussianBlur` at `stdDeviation="0.5"` softens the contour bands so the tint stack reads
as a printed join rather than stacked vectors.

**Amended by the `/search` + `/result` build.** The shadow *vocabulary* is untouched and
the Sheet device is still the only shadow in the system, but it now has a fifth surface: the
verdict slip on `/result`, the raised panel that appears only when the solver refuses the
budget. It is the single lifted surface on that screen — a refusal is the one thing on a
signed sheet that earns a raise, and the cost ledger around it stays flat ruled rows so the
raise means something. The manifest on `/search` does **not** add a lift: the raised sheet
the direction contract describes is the incumbent `.tt-slip__sheet` device re-used as
`.tt-sheet`, and the issued version of the same sheet drops its border and its fill rather
than gaining a second shadow.

### Shadow Vocabulary
- **Sheet** (`0 1px 2px rgba(20,24,28,0.06), 0 12px 32px -12px rgba(20,24,28,0.22)`): the map
  sheet and the slip sheet only. Nothing else in the system may cast a shadow.
  *(Amended: the same Sheet device now also lifts the verdict slip on `/result` and the auth
  gate. The device list is unchanged — this is still the only shadow value in the system, and
  the count of *surfaces* that use it is now three on the signed route, one on `/search`
  via the re-used slip sheet, and one on `/auth`.)*

### Rules
- **The Shadow-Budget Rule.** Two surfaces in the entire world are lifted. If a third element
  needs to be lifted, it needs a material reason, not a preference.
  *(Amended: the third surface arrived with a material reason — a refused budget is the only
  thing on a signed sheet that earns a raise — and the fourth was the auth gate's whole
  argument. A fifth still has to make that case.)*
- **The Soft-Join Rule.** Depth in a drawing comes from tonal stacking and hairline edges.
  No blur-heavy glows, no glass, no backdrop filters.

## Shapes

Square. There is no radius token in the design system and no rounded corner anywhere in the
landing world — the sole exception is `border-radius: 1px` on the global `:focus-visible`
outline, which exists to stop the browser's default ring from looking like a pill.

Separation is exclusively a 1px or 2px ink rule: 2px solid ink caps a section heading or the
closing statement; 1px at 34% alpha rules the slip sheet, its head and the map caption's
left edge; 1px at 16% alpha rules map/list item edges; 1px at 9% alpha rules the field
ledger and the fine-print line.

Silhouettes in the SVG work follow the same logic. Icons are hand-drawn at `24×24` with a
single stroke weight (1.6; 1.7 on the arrow) and round caps — no icon font, no glyph
standing in for an icon system. The map's contour bands are closed Catmull-Rom splines with
a 0.66 vertical squash, so the massif reads as terrain rather than as a circle.

The `/search` + `/result` build added **no radius at all** and no new separation device: it
reused this file's rules unchanged. Its one shape decision is that a sheet changes its
*geometry* between its two states rather than gaining an outline — the blank manifest is
lifted and ruled at `rule-strong`, the issued sheet is bare stock with its entries ruled by
hairline only. Same object, filled in. Nothing else on either screen has an edge that is not
one of the four rule strengths already named above.

## Components

### Buttons
- **Shape:** square (0px). One blue rectangle, the loudest object on the page.
- **Primary:** prussian fill, white action-face label, 1px prussian border, `0.85rem 1.5rem`
  padding, gap `0.7rem` to an inlined 18px arrow.
- **Hover / Focus:** fill and border go to prussian-deep and the button lifts `translateY(-1px)`
  over 0.25s on `--tt-ease`; the arrow slides `translateX(3px)`. `:active` returns to rest.
  Focus is the global 2px prussian ring at 3px offset.
- **Disabled:** transparent fill, faint ink label, rule-strong border, `cursor: not-allowed`,
  and no lift. Never a faded prussian fill — a disabled control in this world reads as ink
  that has not been printed.
- **Nav link (primary / quiet):** the same button reduced to `0.5rem clamp(0.75rem, 2vw,
  1.1rem)`, `white-space: nowrap` so a two-word label never breaks across three lines.
  Quiet variant is transparent with a rule-strong border; on hover its border goes to ink.

### Inputs / Fields
- **Style:** no box. Transparent fill, `border: 0`, and a 1px ink rule along the bottom only,
  with `0.25rem 0 0.5rem` padding. The label above is mono 600, `0.66rem`, +0.14em,
  uppercase, faint ink.
- **Focus:** the rule itself turns prussian and thickens to 2px; `:focus-visible` adds
  `box-shadow: 0 2px 0 0 var(--tt-prussian)` so the focus indicator lives in the form's own
  vocabulary rather than as an outline rectangle around it.
- **Faces:** the city field is set in the display face (600, −0.01em) because a place name is
  a name; the days and budget fields are set in Martian Mono 600 with `tabular-nums`, and the
  budget field carries a prussian ₹ affix in the same face and size, right-aligned against
  the rule.
- **Error:** `aria-invalid="true"` turns the bottom rule vermilion at 2px and reveals a
  `role="alert"` line in vermilion `0.78rem` preceded by a 6px vermilion square. Error text
  names the constraint ("Between 1 and 60 days.", "At least ₹1,000."), never "invalid input".
- **Placeholder:** faint ink at full opacity — never a greyed default.
- **Hint:** faint ink `0.78rem` below the rule; replaced by the error line when the field is
  invalid.
- Number spin buttons are removed globally (`::-webkit-inner-spin-button`), because the
  measuring face and tabular numerals are the affordance, not a spinner.

### Navigation
- **Running head:** the supplement's head. Wordmark in the display face at 700
  (`clamp(1.4rem, 5vw, 1.75rem)`, −0.022em) with the mono reference `TT/ROUTE` baseline-aligned
  beside it at `0.6rem` / +0.18em. Full-bleed on paper, `1.4rem` top / `1.25rem` bottom
  padding, actions right-aligned, gap `clamp(0.5rem, 2vw, 1.25rem)`. No background fill, no
  shadow, no sticky behaviour.

### Cards / Containers
- **Corner Style:** square. **Background:** stock-lift for the slip, stock-paper for the map
  sheet. **Shadow:** the single `--tt-lift`. **Border:** 1px at rule-strong on the slip,
  1px at rule on the map. **Internal Padding:** `clamp(1.5rem, 3.5vw, 3rem)`.
- Included items and flow steps are not cards. They are ledger rows: 2rem vertical padding,
  separated by rules, no fill, no border, no shadow, and at ≥900px they gain a left rule and
  a shared gutter instead of gaining a surface.

### Map (`ContourRoute`)
The signature component, and the only place the world draws.
- **Ground:** stock-paper, with a 45°-rotated hatch pattern at 7% ink filling the low ground
  below an irregular waterline.
- **Bands:** four closed splines, outermost first, filled with the tint scale and outlined
  at 0.75px / 22% ink.
- **Route:** one prussian stroke, `stroke-width: 3`, round caps and joins, `pathLength="1"`.
- **Marginalia:** mono figures at `7.5px`, `SCALE 1:50k` with a ticked scale bar, a north
  arrow — in `ink-map`, not `ink-faint`.
- **Live state:** naming a city places a terminus (12%-opacity halo + 6px prussian disc + 2px
  stock centre) labelled in prussian-deep, and re-terminates the route at that point.
  Days carry the terminus further along the ridge, budget lifts it higher up it.

### Footer (colophon)
Pressed stock with a rule-strong top border. Wordmark and `TT/ROUTE` reference on the left,
the contact address in mono prussian with a 10%-opacity underline that goes solid on hover,
the estimate disclaimer, and a bare year. At ≥900px these become a row with the disclaimer
dropped to its own full-width line. **The disclaimer is not optional copy** — PRODUCT.md
requires estimates to stay labelled as estimates.

### Auth (`/auth`) — the turnstile

The credential gate is a gate: one raised sheet of stock on a lobe that carries the form,
with the account's purpose in the bare margin beside it, divided by one irregular
coastline cut. Operate-mode: the screen reads as a form before it reads as a world.

- **Spread:** above 900px, three ruled columns — form lobe `1.15fr`, coast `88px`, purpose
  margin `0.85fr`. Below 900px it stacks and the coast lies down as a 56px band. The
  lobes take no fill; the hatched channel between them is the cut, and both sides stay on
  bare stock.
- **The coast:** hatch at 12% ink over paper (the map hatches water at 7%; this one has to
  read at 56px), with a 1.5px ink edge stroke at 34%. Both paths are authored in the same
  `0 0 100 900` user space and CSS shows one orientation or the other, because
  `preserveAspectRatio="none"` scales each axis independently — the amplitude had to be
  re-authored per orientation to land as real undulation in an 88×990 box and a 390×56 one.
- **The segment rule:** sign in and register are two spans of one 2px ink rule with a 1px
  hairline at the boundary — not a tab strip, not a link pair. ARIA tabs with roving
  tabindex and arrow keys. **The terminus disc** sits on the rule centred over the active
  span (25% / 75%), travelling on `left` over 0.35s, and carries the map's own terminus: a
  12%-opacity prussian halo, a solid disc, and a stock-coloured centre. It travels on
  `left` rather than `transform` because a percentage in a transform resolves against the
  disc's own 12px box and computes to zero.
- **Fields:** ruled rows, one mono label at 0.14em and one value, on the lifted slip. The
  name field is set in the display face because a name is a name; passwords are set in
  Martian Mono because a secret is a value a person measures by length. Vermilion is
  confined to this sheet.
- **Provider marks:** Google's and GitHub's own fills, under the Foreign-Mark Exemption.

### Account drawer

Pressed stock, right-hand panel, one hairline edge, an ink scrim at 24% rather than a
blur, and **no shadow** — the world allows one and only the sheet casts it. The identity
mark is a square of stock ruled on three sides with the initial in mono ink, not an avatar.
It claims Tab while open, moves focus in on open, returns focus to the opener on close, and
its async body is one `role="status"` region. Four states, each distinct in copy and
intent: pending, the trips ledger with relative dates and the estimates disclaimer, an
empty list that reads as an invitation, and an API failure naming the failing service with
a working retry.

### The manifest sheet (`.tt-sheet`) — one component, two states

The single component this build established, and the reason `/search` and `/result` read as
one object. It is a ledger of numbered entries between a rule-strong head and an issuing
foot, and it has exactly two states:

- **Blank** (`/search`): stock-lift, a 1px `rule-strong` border, `padding:
  clamp(1.4rem, 3vw, 2.25rem)`, entered as `.tt-slip__sheet` — it inherits that device's
  `--tt-lift`. The head reads `TT/SHEET` beside the ask; the foot is a 2px ink rule, a
  mono-600 restraint stamp, and the single prussian primary action. The action is **never
  disabled** — an unfilled field is answered with a refusal that names what to do, not with a
  dead control.
- **Issued** (`/result`): `.tt-sheet--filled` sets `border: 0`, `background: none`,
  `padding: 0`. The head becomes `TT/ROUTE / FILLED` with the slash in prussian; the entries
  answer in prose rather than in inputs. Five entries, in this order and no other:
  **01** the trip costs under, **02** the route runs, **03** how you arrive, **04** before you
  go, **05** where you would sleep. Order is the argument: money first, then the route, then
  arrival, then advice, then somewhere to lie down.

An entry is a grid — `2.5rem minmax(0, 1fr)` — with a mono-600 number, an uppercase display
ask, and one line of answer. On the blank sheet the answer is the field; on the issued sheet
it is `ink-soft` body at 0.95rem capped at 62ch. Entries are ruled with a hairline and
separated by padding, never by a card.

### The cost ledger (`.tt-split`) — argued, never asserted

**Always visible**, whether or not the budget is accepted. A 2px ink rule caps it; each
category is a `.tt-split__row`: an uppercase display key at 0.86rem on the left, a mono-600
tabular figure at 0.9rem on the right, hairline beneath, `space-between` on the baseline.
Four categories — stay, food, doings, getting about — then the total, then, *only when the
arithmetic demands it*, one reconciling sentence.

That sentence is the ledger's honesty device and it is **sign-branched**: a remainder above
zero says the solver did not attribute it to a category; a remainder below zero says the
categories add up to more than the total entered and the split is over-stated. It is
gated on the remainder being present and non-zero, so a sheet that adds up exactly says
nothing at all. It never prints `Math.abs`, because the sign is the information.

### The verdict slip (`.tt-verdict`)

The only vermilion panel in the world, and it exists only when `Budget.insufficientBudget`
is true. Stock-lift, the Sheet shadow, `1.35rem 1.5rem 1.45rem` padding, one display-600
verdict line at 1.12rem in vermilion, one body paragraph capped at 64ch carrying
`insufficientBudgetMessage`, and `alternativeOptions` rendered as the same ruled rows the
cost ledger uses — never as a styled list. It reports a refusal; it does not apologise and
it does not offer a retry.

### The day band (`.tt-day`)

A day's stops on a tint of its own. `1.5rem 0 1.75rem` padding, hairline beneath, alternating
`band-1` / `band-2` by `:nth-child(even)` — no ink between days, because the tint is the
separator. The head is a mono-600 prussian day number, the weekday in display 600, and the
day's measure pushed to the far end in mono `ink-faint` (`6 STOPS · 11 H 30 MIN · 62 KM`);
below 900px the measure drops to its own line rather than being squeezed. The band's only
mark is the anchor: the day's fixed stop takes **both** its hour and its place into prussian
at weight 600, and nothing else changes. That is how a reader finds the thing they cannot
move.

### The stop row (`ActivityCard`)

One component for activities and meals alike, which is the point: a meal is a stop that
happens at an hour. A `5.5rem / minmax(0, 1fr)` grid — the hour in mono-600 tabular
`ink-faint`, then place in display 600 and a note in Barlow — padded `0.8rem 0` with a
hairline. The hour comes from a shared `clock()` helper that formats minutes past midnight,
returns null outside `0–1440`, zero-pads, and wraps at 24 hours; an hour the solver did not
gather prints `—` at `ink-faint` rather than a fabricated time.

Meals seat into the same hours with a mono `BREAKFAST` / `LUNCH` / `DINNER` tag set in the
margin and a lighter place size; they carry no bottom rule of their own, so the day's stops
stay one list. Flags — `HELD 40 MIN`, `OPENS LATER` — are mono-600 stamps in `ink-faint`, and
an empty day says so in `ink-faint` at upright rather than rendering a bare rule.

### The estimate calculator (`.tt-calc`)

The road-trip cost as arithmetic instead of folklore. Stock-**press**, not lift: the verdict
owns the only raise on this screen, so the calculator is a working panel set *into* the
paper. Four visitor-named fields — distance, fuel, tolls, people — in a
`repeat(4, minmax(0, 1fr))` row that pairs two-by-two from 1179px, each a mono-600
`tabular-nums` figure with a 1px ink underline and its unit set as a mono suffix. The result
is a 2px-ruled row: a mono key, and a **prussian** 1.5rem figure that goes `ink-faint` while
the four fields are empty, so the panel never invents a total before it has been asked for.

### The stay list (`.tt-stay`)

Caveat first, list second. Each row is `minmax(0, 1fr) auto`: hotel name in display 600,
its area in `ink-soft` beneath, then a figures cluster of rating, a per-night and a total,
each a mono-600 tabular figure with a `PER NIGHT` / `FOR n NIGHTS` restraint beneath it.
Below 600px the figures drop to their own line. A hotel is marked as an estimate in the
word "worked out", and when the solver returns none the section says so and names the city
rather than showing an empty list under a heading.

### The balance line (`.tt-balance`)

The sheet's foot and its last raised voice: `ISSUED` in mono, then `Jaipur · 4 DAYS · ₹24,000
ESTIMATED` in display 600 at `clamp(1.15rem, 2.2vw, 1.6rem)`, then one `ink-soft` note that
carries the estimates disclaimer and ends the document. It repeats what entry 01 argued in
the sheet's own signature form, and nothing more.

### The closing band (`.tt-close`)

The screen's last line, and the one place a `.tt-close` band must not be returned bare: it
carries no horizontal padding of its own, so on its own it renders at `x = 0` with its fine
print clipped off the left edge. **It is always wrapped in `.tt-page` and `.tt-rail`**, like
every other section, and the fine print carries its own `rule-hair` top border.

## Do's and Don'ts

### Do:
- **Do** tint neutrals from the stock. Three grounds only: paper, lift, press.
- **Do** spend prussian on exactly three things: the route line, the primary action, and
  reference/data marks.
- **Do** separate with hairlines — 1px ink at 9%, 16% or 34% — and reserve the 2px ink rule
  for capping a heading or the closing statement.
- **Do** keep corners at 0px and set figures in Martian Mono with `tabular-nums`.
- **Do** measure new ink against the darkest ground it lands on, and against band 4 for
  anything drawn inside the map.
- **Do** draw icons at 24×24 with a single 1.6px stroke and round caps, inline, `aria-hidden`.
- **Do** let the map stay driven by real state. Every spot height must sit on equal-or-darker
  ground than the figure below it; every terminus must move for every legal input.
- **Do** keep the disclaimer that prices and availability are estimates, on every surface
- **Do** let one object carry two states, as the sheet does: same entries, same order, same
  grammar — blank it is a form, filled it is a document.
- **Do** argue a number rather than assert it. Show the breakdown, show the total, and when
  the parts and the whole disagree, say which way.
- **Do** print a refused value where the refusal happened, on the ground where it is
  legible, and carry the alternatives with it. A product that cannot say "this will not work"
  has not finished the sheet.
- **Do** gate optional blocks on the data that exists, never on a field the solver has not
  gathered yet. Render the payload you have; blank the block you don't.
  that shows a plan.

### Don't:
- **Don't** use vermilion for anything that is not a rejected value, or on any ground other
  than the lifted slip stock — it fails the contrast floor on pressed stock.
- **Don't** invent proof. No testimonials, ratings, user counts, press or usage numbers, on
  this surface or the next one (PRODUCT.md: zero proof assets exist).
- **Don't** use emoji as iconography, gradient text, glassmorphism, or a third saturated ink.
- **Don't** add a radius token. Square is the form language; the focus ring's 1px is the
  only radius in the world.
- **Don't** add a second shadow, or convert a ledger row into a filled card to create
  separation the rules already provide.
- **Don't** restyle or extend the `<GridDistortion>` hero block. It is fixed by owner
  instruction — same component, same props, same wrapper div, `40vh` / `600px`, `rounded-xl`.
  Treat it as a boundary, not a precedent: the *seam around it* is part of this world, the
  block inside it is not.
- **Don't** assume this world has reached the whole product. `/`, `/auth`, `/search` and
  `/result` are now all built from these tokens, and `/search` and `/result` are the system's
  **second and third examples** rather than its exception: the sheet, the day band, the cost
  ledger and the verdict slip are all incumbent grammar, and the build added no colour, no
  radius and no shadow value to serve them. The warning that used to close this bullet still
  stands — **the world is documented, not enforced.** `daisyUI` and Tailwind are still
  installed under `frontend/`, nothing in the toolchain stops the next route from reaching
  for a class instead of a token, and nothing in this file can prove which one it reached
  for. Inherit a documented world, not an enforced one: read this file before writing a
  route, and when the code disagrees with it, report the code — do not copy it.
- **Don't** spend the third shadow, or a fourth use of prussian, on a panel. The account
  drawer separates on its own hairline edge and carries its identity as a square of stock
  in ink — prussian stays on the route, the primary action, and reference marks.
  *(Amended: the verdict slip is the third shadow. It reports a refusal rather than creating
  separation, which is the material reason this rule asks for; the account drawer was right
  to refuse one.)*
- **Don't** claim an account capability the product does not have. Email hand-off is
  intended and unbuilt; there is no mail transport in the repository. The auth margin
  states what an address does today and nothing more.
- **Don't** use vermilion, or any ink that failed the contrast floor, on a ground it was not
  measured against. A refusal block printed on pressed stock measures 4.32:1 and does not
  clear the 4.5:1 floor this system sets for itself.
- **Don't** add a second radius, or a "component" that is really a card. The manifest is a
  ledger with three entries; a fourth field does not make it a grid.
- **Don't** let a stepper own a form that fits on one sheet. Three ordered entries are read
  at a glance; the same three entries behind `NEXT` are not.
- **Don't** print a figure the visitor did not supply and the solver did not return. `—`
  with a stated reason is a correct answer; a plausible number is not.
- **Don't** invent a currency. Format what `Budget.currency` or `city.Currency` carries and
  fall back to ₹; never apply a rate the repository does not hold.
- **Don't** use emoji as iconography, a day/meal tab pair, a mouse-follow distortion
  background, or a stepper — the `/search` + `/result` build deleted all four and the world
  did not miss them.

### Drift carried by this build, not canonized

Recorded here because a build is allowed to contradict itself for one release and not to
teach it. None of these is a rule; each is a defect the next surface must not inherit as
precedent.

- **A dead token.** `--tt-vermilion-wash: rgba(184, 52, 26, 0.1)` is declared in `:root` and
  used by nothing. It predates this build; it is listed so the next surface does not
  discover it as an available colour and reach for it.

Two more were found by the same audit and **repaired before the build shipped**, so they are
rules here rather than drift:

- **Vermilion belongs on lifted stock.** `.tt-sheet__refusal` was first set in vermilion on
  `--tt-paper-press`, which measures **4.32:1** and fails the floor set in **The
  Darkest-Ground Rule** above. The rule was not relaxed; the block was. It now carries no
  fill of its own — vermilion type on the sheet's own stock, **5.10:1**, under a 2px terminal
  rule. Every vermilion mark on these two surfaces now measures at least 4.5:1 against the
  ground it actually sits on, including the field refusals in `.tt-field__error`.
- **No synthetic obliques.** The roster ships Barlow upright at 400, 500 and 600 and no
  italic cut — all 16 woff2 subsets are `font-style: normal`. `.tt-stop__none` had asked for
  one; the absence now reads in `ink-faint` at upright, and the rule is that nothing on
  these surfaces may ask for a cut the roster does not ship.