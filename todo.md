# TripTribe — Plan

> Vision doc, not the task tracker. `bd` stays the source of truth for execution (`bd ready` / `bd list`). This file holds the story, the why, and where we are headed so future sessions keep the plot.

## North star

**One tape, many hands.**

TripTribe is an issued travel diary — dubbed once by the planner, then passed around the group until the trip happens. The organiser dubs it, the group marks it up, everyone walks the same route.

Why this story wins:

- Justifies the tape / diary look on `/plan` + `/result` without apology: ruled stock, spine, hand-lettered titles, photo pin, day sides.
- Makes collaboration the key use case, not a feature: a diary is meant to be handed over.
- Gives homepage a job: the diary cover. Editorial, photographic, persuasive — then it opens into the working diary inside.
- Scales to the future you want: group editing, voting, global tapes — all are just more hands on the same tape.

Core phrase (use verbatim on site):

- Landing close: `Begin your dream getaway.`
- Plan head: `The trip on one tape.`
- Result hand-off: `Dubbed. Now pass it around.`
- Share button: `Pass the tape on WhatsApp`

## Design contract

- `/` = diary cover: ivory stock, Taviraj serif, brass accent, full-bleed photo plates, folio rows, pill CTAs, rise + parallax motion. Persuade.
- `/plan` + `/result` = working diary: tape stock, ballpoint blue ink, Caveat/Shadows hand voice for notes, Taviraj serif for display titles, mono for measurement, spine + day sides, photo pin. Operate.
- Shared devices (the seam): serif display titles, folio running heads, captioned destination plate. Everything else stays in its world. Pill buttons and full-bleed photography never leave the cover.
- Motion grammar shared everywhere: same ease `cubic-bezier(0.16, 0.84, 0.44, 1)`, rise + fade reveals, one authored moment per surface, full `prefers-reduced-motion` settle.

## Collaboration = key use case

The organiser plans on behalf of the group, then hands it over. Success = the plan survives being read once and passed to someone who was not in the room (PRODUCT.md principle 3).

Priority order:

1. WhatsApp share from `/result` — one tap, pre-filled text, deep link back.
2. Read-only shared view that opens fast on a phone in a group chat.
3. Group editing — comments / mark-up on days, then direct edits.
4. Voting — on stays, days, food stops; group tally, organiser breaks ties.
5. Global tapes (maybe) — public templates by city, forkable.

## Shipped

- Landing rebuilt as editorial cover (`Hero.tsx`, `mx-landing.css`, `public/landing/*`, Taviraj + Hanken self-hosted). Hybrid mapping: hero form + three bands (sequence / meals / budget) + pier interlude + care band + getaway close with live ContourRoute map.
- Hero plate fix: glitched coast retired, pier becomes hero (q90), misty avenue becomes interlude (graded), plan section goes plain paper. Mobile-only scrim bump for sky contrast.
- Plan revoiced: Taviraj display title + destination name, folio running head, 112x84 captioned photo pin. Blue ink still acts. Mobile folio collapse.
- Proof: tsc clean, next build passes, detector empty, desktop + mobile + reduced-motion captures, Lisbon/5/60000 seed carries to /plan.
- DESIGN.md records landing as its own world + three shared devices.

## Now — soften the home to plan cut (keep both worlds)

Gap: cut changes voice, acting color, imagery, buttons, motion at once; navbar matches neither side.

- Unify ground: pull `/plan` stock toward landing ivory or lay a shared paper token both read from. Cousin-colors read as identity crisis; same-color reads as chapter head.
- Shared motion grammar: landing reveals + plan route-draw on the same ease and timing so the eye feels continuity even as costume changes.
- Handoff moment: landing CTA carries city/days/budget into `/plan` with a brief cross-fade / tape-slide so arrival feels opened, not reloaded.
- Neutral chrome: navbar + footer stop being a third identity — ink-on-paper strip that works over hero photo and diary stock, no blue buttons.
- Keep: diary note-taking feel on `/plan`, photographic cover on `/`. Never merge the worlds, only bridge them.

## Next — WhatsApp pass-around (P1, bd: TripTribe-AI-djq)

- `Pass the tape on WhatsApp` button in `Handing it over` section on `/result`, beside email send. Uses `wa.me/?text=` with short trip summary: city, days, budget total, top 3 stops, link back.
- Copy rule: no invented proof, prices stay labeled estimates, nothing implies booking.
- Verify: tap from desktop + mobile, text renders in chat preview, empty-plan state never shows a share button.
- After: read-only shared view route (fast, no auth, same diary voice) so the link lands somewhere worthy.

## Later — group hands on the tape

- Comments on days/stops (name + note, no account required v1, abuse limits).
- Direct group editing: one edit queue, organiser approves; history shows who dubbed what.
- Voting: thumbs on hotels / day orders / food stops, tally inline, tie-break stays with organiser. Global voting only if moderation story exists — do not ship worldwide tally without it.
- Diary cover adapts, not replaced: add a `Passed around` band with real shared-trip mechanics (how a tape moves through a group), never fake quotes or counts. PRODUCT.md zero-proof rule holds until GA4 gives real numbers.

## Guardrails

- No cloning of villas-tamarindo.com assets, code, or copy — inspired-by rhythm only, original code + own photos.
- Owner photos in `public/landing/*` are unverified license + 1912px strips upscaled on full-bleed; re-verify before commercial use, replace hero with true 2560px+ when available (drop-in, zero layout change).
- No testimonials, ratings, counts, press until real. Estimates stay labeled. Degraded-by-design when keys missing.
- Currency follows destination (decided, not implemented) — prompt, formatting, hotel band, road calculator change together when it lands.
