# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **couple or group organiser**: one person planning a trip on behalf of the people travelling. They arrive with a destination and a ₹ figure and a rough sense of how many days they have, then hand the finished plan to the group.

Consequences that are real product facts, not design preference:

- The organiser is not travelling yet and will not read the plan once. They read it end to end, check it, and pass it on.
- They are accountable to other people for the money and the time, so budget feasibility and day structure carry more weight than inspiration.
- They plan in short, interrupted sessions — on a phone, between other tasks — and come back later to the same trip.

No other audience is confirmed. Account-holders are the same people, not a separate persona.

## Product Purpose

TripTribe turns three inputs — destination, total budget, number of days — into a complete, hand-off-able trip plan: a day-wise itinerary whose activities sit on one route and whose meals are near those activities, plus city orientation, how to reach it, hotels inside the budget, tips, and a road-trip cost estimate.

Success means the organiser stops researching. They take the plan, believe it, and share it. The product's job ends at the hand-off, not at the reading.

## Positioning

**Route-aware sequencing, at a fixed budget.**

A day is not a list of famous places. Its activities are grouped so they sit on one route or close together, and each day's meals are chosen near those stops. The budget is a real input that shapes the hotel shortlist and is checked against the plan, not a filter applied afterwards.

A neighbouring trip planner can generate a list of attractions. Producing a day a group can actually walk through, for the money they actually have, is the claim.

## Operating Context

- Live in production at `triptribe.shrijit.tech`, API at `api.triptribe.shrijit.tech`, deployed on Dokploy, images on GHCR via GitHub Actions.
- Sign-in and sign-up are not TripTribe's own. They live in a shared Better Auth service at `auth.shrijit.tech`; the session cookie is set on the `.shrijit.tech` domain and every TripTribe API trusts it. There is no local user store and no token handling.
- Trips are persisted per user and surfaced as recent trips on the account, so a plan stays reachable after generation.
- Budget entered today is a plain number with no currency selector; the prompt, the hotel prices and the road-trip calculator all assume ₹.
- The app boots degraded by design when owner keys are missing: it still serves and renders, and only the specific feature reports unconfigured. Design must assume features can be off.

## Capabilities and Constraints

Confirmed:

- Itinerary generation through OpenRouter, structured as JSON against a fixed schema.
- City input via Google Places autocomplete.
- City imagery via Google Custom Search, proxied through the API to avoid hotlink and CORS failure.
- Email hand-off of the finished plan is intended, sent with Resend.
- Editing and regenerating parts of a plan is intended, not yet built.
- An account area listing recent trips, each reopening its saved plan.

Confirmed constraints:

- Destinations may be anywhere in the world, but money currently resolves to ₹ everywhere. The user has decided that **currency follows the destination** — the traveller's chosen currency, with the destination's own currency surfaced from the generated city data. This is not implemented; the prompt, the number formatting, the hotel price band and the road-trip calculator all assume ₹ and must change together.
- The generated schema is a contract. `city`, `Reach`, `Tips`, `Budget`, `itinerary[].activities`, `itinerary[].meals` and `hotels` are consumed by the result page field by field, so any surface work must tolerate missing, null or oddly-shaped fields rather than assume a well-formed response.

Open, deliberately undecided:

- Whether an account is required to generate. Today generation works signed-out and the email is simply blank.
- Whether editing regenerates through the model or edits locally.

## Brand Commitments

- Name: **TripTribe**.
- Existing copy and features are preserved unless the work explicitly changes them. The result page's factual copy about a generated trip is the model's output and stays as it is.
- MIT licensed.

No brand identity, logo, palette, typeface or voice guide is binding. The current neon-on-black treatment is incidental, not a commitment.

## Evidence on Hand

Real and usable:

- The live product itself at `triptribe.shrijit.tech` — the strongest available demonstration.
- Real city photography at runtime, fetched from Google Custom Search for the destination the traveller actually chose.

Explicitly absent — future work must not invent any of it:

- **No testimonials, no named users, no ratings, no user or trip counts, no press.** The user confirmed zero proof assets.
- The landing page currently shows three traveller cards ("Rahul S.", "Sarah T.", "Mark L."). These are invented quotes with no source. They are not evidence and must not be preserved, extended or replaced with equally fictional ones.
- GA4 is installed, so real traffic can be read later, but no usage number has been confirmed and none may be stated yet.
- Hotel prices are model estimates. They are labelled as estimates and must keep that framing; they are not live availability or a price guarantee.

## Product Principles

1. **A day is a route, not a list.** Sequencing beats coverage. Nothing may reorder or scatter what the planner grouped.
2. **The budget is an argument the product must win.** The number the organiser typed has to visibly govern the result, including when it is too small — then say so plainly instead of quietly producing something unaffordable.
3. **Built to be handed over.** Every surface should survive being read once, understood, and passed to someone who was not in the room. Endings matter as much as the middle.
4. **Honest under missing keys.** Features degrade to a clear "not configured" state, never a broken or faked state. Estimated numbers stay labelled as estimates.
5. **No invented proof.** The product demonstrates itself. Nothing on the site may imply usage, approval or results that have not been confirmed.

## Accessibility & Inclusion

No product-specific requirement has been established yet. Baseline expectations still apply: keyboard reachability for every control, visible focus, real labels on inputs, and reduced-motion respect for the existing canvas animation on the landing and result hero.