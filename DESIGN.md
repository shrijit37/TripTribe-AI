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

> **Scope.** This document describes the world as built on the landing surface (`/`) — the
> files `frontend/src/index.css`, `frontend/src/pages/Hero.jsx`,
> `frontend/src/components/ContourRoute.jsx`, `frontend/src/components/Navbar.jsx` and
> `frontend/src/components/Footer.jsx`. It is a scan of shipped code, not an intention.
> Two surfaces are **outside** this world and are recorded as such under *Layout* and
> *Do's and Don'ts*: `/search` and `/result`, plus the account drawer and sign-in dialog
> inside `Navbar.jsx`.

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
- **The Verdict Rule.** Vermilion is never an accent, never a hover, never a "highlight your
  plan" cue. If nothing is wrong with the visitor's input, vermilion does not exist.
- **The Darkest-Ground Rule.** Any new ink tier must clear 4.5:1 against the darkest ground
  it can land on — currently pressed stock for text on paper, and band 4 for anything drawn
  inside the map. Vermilion currently clears 5.10:1 on the lifted slip stock where it
  actually renders; it would not clear the floor on pressed stock, so it must never be used
  in the footer or on a band.
- **The Flat Print Rule.** Separation is drawn with ink at low alpha (hair 9%, rule 16%,
  strong rule 34%) rather than with borders, fills or shadow.

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

### Shadow Vocabulary
- **Sheet** (`0 1px 2px rgba(20,24,28,0.06), 0 12px 32px -12px rgba(20,24,28,0.22)`): the map
  sheet and the slip sheet only. Nothing else in the system may cast a shadow.

### Rules
- **The Shadow-Budget Rule.** Two surfaces in the entire world are lifted. If a third element
  needs to be lifted, it needs a material reason, not a preference.
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
- **Don't** assume this world has reached the rest of the product. It has not.
  `daisyUI` and Tailwind are still installed and still style `/search` and `/result` (plus
  the account drawer, avatar, menu and sign-in dialog inside `Navbar.jsx`, which use daisyUI
  components inside this world's running head). Those surfaces do not follow these tokens and
  must not be treated as examples of the system. The first surface to migrate them inherits
  a documented world, not an enforced one.