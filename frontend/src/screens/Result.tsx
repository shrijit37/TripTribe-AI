"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ActivityCard, { clock } from "@/components/ActivityCard";
import HotelSection from "@/components/HotelSection";
import { emailPlan, fetchCityImage, regenerateDay } from "@/lib/api";
import { money, moneyUnit, numeric, sum } from "@/lib/money";
import { takeResult, takeTripPlan } from "@/lib/nav";
import type { MealName, PlanPayload } from "@/lib/types";

/** The solver seats these three, in this order, inside every day's hours. */
const MEALS: { key: MealName; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

/** "4 hours" → "4 HR 00 MIN", because that is the measure, said as a measure. */
const duration = (minutes?: number | null): string | null => {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return hours
    ? `${hours} HR ${String(rest).padStart(2, "0")} MIN`
    : `${rest} MIN`;
};

const Result = () => {
  const [plan, setPlan] = useState<PlanPayload | null>(null);

  // The road-trip estimate is worked from figures the visitor names. The old
  // calculator hard-coded 380 km of distance and ₹480 of tolls and printed
  // the sum as though it were this trip's cost — a fabricated number in the
  // measuring face, which is the one place nobody reads a figure loosely.
  const [distance, setDistance] = useState("");
  const [mileage, setMileage] = useState("");
  const [fuel, setFuel] = useState("");
  const [tolls, setTolls] = useState("");

  // The hand-off: a sheet is built to be given to the group, so sending it is
  // one click rather than a print dialog. Every state below is a thing that
  // can actually happen — sent, still sending, refused, refused because the
  // address is wrong, and unavailable because RESEND_API_KEY is not set. Which
  // one is shown is decided by the server's answer, not guessed here.
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [handed, setHanded] = useState("");

  // Re-planning one day. `working` holds the day in flight, so that day's
  // button shows its own state while the rest stay available.
  const [working, setWorking] = useState<number | null>(null);
  const [replanned, setReplanned] = useState("");

  // The sleeve plate: decoration, so a miss degrades to no plate at all.
  const [photo, setPhoto] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);

  // `react-router`'s `location.state` has no App Router equivalent. The plan
  // is parked in `sessionStorage` by whoever handed it over — a plan just
  // generated on /plan, or a saved trip reopened from the account drawer —
  // and each key is claimed once, so a hard reload still finds the plan. A
  // direct visit finds neither and gets the empty state below.
  //
  // The latch is not decoration. `reactStrictMode` is on in this app, so the
  // effect is invoked twice against the same component instance — and a
  // one-shot key handed out twice hands out nothing the second time. The
  // first claim won the plan, the second claim came back null and overwrote
  // it, so /result rendered "no plan on this page" for every visitor in dev
  // while the plan sat one read away.
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    setPlan(takeResult() ?? takeTripPlan());
  }, []);

  const cityName = plan?.city?.name ?? "";
  useEffect(() => {
    if (!cityName) return;
    let live = true;
    fetchCityImage(cityName).then((src) => {
      // fetchCityImage resolves with a generic placeholder when the image
      // backend has nothing for the city. A placeholder of nowhere is worse
      // than no plate, so only a real photograph is admitted.
      if (live && src && !src.includes("picsum.photos")) setPhoto(src);
    });
    return () => {
      live = false;
    };
  }, [cityName]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-mx-day]"),
    );
    if (!nodes.length) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrentDay(Number((entry.target as HTMLElement).dataset.mxDay));
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    nodes.forEach((node) => seen.observe(node));
    return () => seen.disconnect();
  }, [plan]);

  // Direct visit, or a reload after the one-shot key was spent: there is no
  // plan to render. The original read `state.city.name` off an empty object and
  // threw; saying so and offering the obvious next step beats a white screen.
  if (!plan) {
    return (
      <div className="mx-rs-page">
        <div className="mx-rs-wrap">
          <div className="mx-rs-empty">
            <p className="mx-rs-empty__line">No plan on this page.</p>
            <p className="mx-rs-empty__fine">
              It is handed over when a trip is generated, and lasts for this
              tab only.
            </p>
            <Link className="mx-rs-btn mx-rs-btn--primary" href="/plan">
              Plan a trip
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tripId = plan.tripUuid ?? null;

  /**
   * Send the sheet. `address` is optional for a signed-in owner and required
   * for everyone else; the server decides which case this is and says so if
   * the address is wrong, so the button never has to guess.
   */
  const hand = async () => {
    if (!tripId || sending) return;
    setSending(true);
    setHanded("");
    const trimmed = address.trim();
    const { ok, message } = await emailPlan(tripId, trimmed || undefined);
    setHanded(ok ? `Sent to ${trimmed || "your account address"}.` : message);
    setSending(false);
  };

  /**
   * Work one day again. Replaces the plan with the server's patched copy —
   * the response is the whole plan, so the sheet never shows a half-applied
   * day, and a failure leaves the sheet exactly as it was.
   */
  const work = async (dayIndex: number, scope: "day" | "meals" | "order") => {
    if (!tripId || working !== null) return;
    setWorking(dayIndex);
    setReplanned("");
    const next = await regenerateDay(tripId, dayIndex, scope);
    if (next) {
      setPlan({ ...next, tripUuid: tripId });
      setReplanned(
        scope === "order"
          ? `Day ${dayIndex + 1} re-sequenced.`
          : scope === "meals"
            ? `Day ${dayIndex + 1} has new meals.`
            : `Day ${dayIndex + 1} worked out again.`,
      );
    } else {
      setReplanned(
        `Day ${dayIndex + 1} could not be worked again — the saved places for it are not available.`,
      );
    }
    setWorking(null);
  };

  const city = plan.city;
  const budget = plan.Budget;
  const days = Array.isArray(plan.itinerary) ? plan.itinerary : [];
  const unit = moneyUnit(plan);
  // The pass-around: a WhatsApp summary dubbed from the real plan — city,
  // day count, estimated total, first three stops. Self-contained text,
  // because no shared-view route exists yet to link to; the link goes home
  // so the group can dub their own.
  const passStops = days
    .flatMap((day) => day.activities ?? [])
    .map((stop) => stop.place?.trim())
    .filter(Boolean)
    .slice(0, 3);
  const passTotal = numeric(budget?.total);
  const passText =
    `TripTribe tape — ${city?.name ?? "the trip"}` +
    ` · ${days.length} ${days.length === 1 ? "day" : "days"}` +
    (passTotal == null ? "" : ` · ${money(unit, passTotal)} estimated`) +
    (passStops.length ? `. Route: ${passStops.join("; ")}.` : ".") +
    " Dubbed for the group — everyone walks the same route.";
  const passHref = `https://wa.me/?text=${encodeURIComponent(passText)}`;
  /** The four categories, in the order a reader adds them up in. */
  const split = budget?.breakdown
    ? ([
        ["Stay", budget.breakdown.accommodation],
        ["Food", budget.breakdown.meals],
        ["Doings", budget.breakdown.activities],
        ["Getting about", budget.breakdown.transportation],
      ] as const)
    : null;

  const named = [distance, mileage, fuel].map(Number);
  const tolled = Number(tolls);
  const estimateReady = named.every(
    (value) => Number.isFinite(value) && value > 0,
  );
  const estimate = estimateReady
    ? Math.round(
        (Number(distance) / Number(mileage)) * Number(fuel) +
          (Number.isFinite(tolled) && tolled > 0 ? tolled : 0),
      )
    : null;

  // What the four categories actually add up to, when all four arrived. The
  // total is the number that was entered; the split is worked out. When they
  // disagree the sheet has to say so rather than let four tidy figures imply
  // they account for the whole thing.
  const parts = budget?.breakdown
    ? ([
        budget.breakdown.accommodation,
        budget.breakdown.meals,
        budget.breakdown.activities,
        budget.breakdown.transportation,
      ] as const)
    : null;
  const counted = parts ? parts.map(numeric) : null;
  const accounted =
    counted && counted.every((figure): figure is number => figure != null)
      ? counted.reduce((running, figure) => running + figure, 0)
      : null;
  const total = numeric(budget?.total);
  const unattributed =
    total != null && accounted != null ? total - accounted : null;

  /** Tips, filtered to the strings the payload can actually hold. */
  const tips = (Array.isArray(plan.Tips) ? plan.Tips : []).filter(
    (tip): tip is string => typeof tip === "string" && tip.trim().length > 0,
  );

  const facts = [
    ["Country", city?.Country],
    ["Region", city?.["Region/State"]],
    ["Language", city?.Language],
    ["Money", city?.Currency],
    ["Best months", city?.BestTimeToVisit],
  ].filter(([, value]) => Boolean(value)) as [string, string][];

  const reachRows = plan.Reach
    ? (
        [
          ["By air", plan.Reach.nearestAirport],
          ["By rail", plan.Reach.nearestRailwayStation],
          ["By road", plan.Reach.nearestBusStation],
        ] as const
      ).filter(([, pair]) => Array.isArray(pair) && pair.some(Boolean))
    : [];

  return (
    <div className="mx-rs-page">
      <div className="mx-rs-wrap">
        <div className="mx-rs-layout">
          <main>
            {/* The sleeve: the city named before anything is asked of it. */}
            <section className="mx-rs-sleeve" aria-label={city?.name}>
              {photo ? (
                <figure className="mx-rs-plate">
                  <img
                    src={photo}
                    alt={`${city?.name}, in photographs`}
                    onError={() => setPhoto(null)}
                  />
                </figure>
              ) : null}
              <div className="mx-rs-sleeve__body">
                <h1 className="mx-rs-city">{city?.name}</h1>
                {city?.description ? (
                  <p className="mx-rs-lede">{city.description}</p>
                ) : null}
                {facts.length ? (
                  <dl className="mx-rs-facts">
                    {facts.map(([key, value]) => (
                      <div className="mx-rs-facts__row" key={key}>
                        <dt className="mx-rs-facts__key">{key}</dt>
                        <dd className="mx-rs-facts__val">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </section>

            {/* The fare ledger: the total, the four-way split, the signed
                remainder only when nonzero, and the typical-cost comparison. */}
            <section className="mx-rs-section" aria-label="Fare ledger">
              <h2 className="mx-rs-section__title">The fare, worked out</h2>
              <p className="mx-rs-balance">
                <span className="mx-rs-balance__figure">
                  {sum(unit, budget?.total)}
                </span>{" "}
                <span className="mx-rs-balance__note">
                  {total == null
                    ? "The solver returned no total."
                    : `for ${days.length} ${
                        days.length === 1 ? "day" : "days"
                      }, everyone on it`}
                </span>
              </p>

              {budget?.insufficientBudget ? (
                <div className="mx-rs-verdict" role="alert">
                  <p className="mx-rs-verdict__line">
                    This total will not cover {city?.name} in {days.length}{" "}
                    {days.length === 1 ? "day" : "days"}.
                  </p>
                  {budget.insufficientBudgetMessage ? (
                    <p>{budget.insufficientBudgetMessage}</p>
                  ) : null}
                  {budget.alternativeOptions ? (
                    <p>{budget.alternativeOptions}</p>
                  ) : null}
                </div>
              ) : null}

              {split ? (
                <dl className="mx-rs-split">
                  {split.map(([label, figure]) => (
                    <div className="mx-rs-split__row" key={label}>
                      <dt className="mx-rs-split__key">{label}</dt>
                      <dd className="mx-rs-split__val">{sum(unit, figure)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mx-rs-plain">
                  The solver returned no breakdown of the total into stay,
                  food, doings and getting about. The total itself is not in
                  doubt.
                </p>
              )}

              {unattributed != null && unattributed !== 0 ? (
                <p className="mx-rs-plain mx-rs-plain--signed">
                  The breakdown accounts for{" "}
                  {money(unit, accounted as number)}.{" "}
                  {unattributed > 0
                    ? `The remaining ${money(unit, unattributed)} is not attributed to a category by the solver.`
                    : `The four categories add up to ${money(unit, -unattributed)} more than the total entered, so the split is over-stated.`}
                </p>
              ) : null}

              {budget?.averageTotalCost ||
              budget?.averageAccommodationCost ? (
                <p className="mx-rs-plain">
                  For comparison, the solver puts a typical {days.length}-day
                  trip in {city?.name} at{" "}
                  {numeric(budget.averageTotalCost) != null
                    ? money(unit, numeric(budget.averageTotalCost) as number)
                    : "an unnamed figure"}
                  {budget.averageAccommodationCost
                    ? `, with a night around ${money(unit, numeric(budget.averageAccommodationCost) as number)}`
                    : ""}
                  . Both are working estimates.
                </p>
              ) : null}
            </section>

            {/* The days run top to bottom, each a side of the record. */}
            <section className="mx-rs-section" aria-label="Day by day">
              <h2 className="mx-rs-section__title">
                {days.length} {days.length === 1 ? "day" : "days"}, in order
              </h2>
              {days.length ? (
                <ol className="mx-rs-days">
                  {days.map((day, dayIndex) => {
                    const ends = clock(day.endMinute);
                    const moving = duration(day.travelMinutes);
                    const stops = Array.isArray(day.activities)
                      ? day.activities
                      : [];
                    return (
                      <li
                        className="mx-rs-day"
                        key={day.day}
                        id={`mx-rs-day-${day.day}`}
                        data-mx-day={day.day}
                      >
                        <div className="mx-rs-day__head">
                          <span className="mx-rs-day__no">
                            DAY {String(day.day).padStart(2, "0")}
                          </span>
                          <span className="mx-rs-day__weekday">
                            {day.weekday || "UNPLACED"}
                          </span>
                          <span className="mx-rs-day__measures">
                            {stops.length}{" "}
                            {stops.length === 1 ? "STOP" : "STOPS"}
                            {moving ? ` · ${moving} MOVING` : ""}
                            {ends ? ` · ENDS ${ends}` : ""}
                          </span>
                        </div>

                        {stops.length ? null : (
                          <p className="mx-rs-plain">
                            The solver returned no stops for this day.
                          </p>
                        )}
                        <ol className="mx-rs-tracks">
                          {stops.map((stop, index) => (
                            <ActivityCard
                              key={`${stop.place}-${index}`}
                              place={stop}
                              anchor={index === 0}
                              index={index}
                            />
                          ))}
                          {MEALS.map((meal, mealIndex) => {
                            const slot = day.meals?.[meal.key];
                            const track = stops.length + mealIndex;
                            return slot ? (
                              <ActivityCard
                                key={meal.key}
                                place={slot}
                                meal={meal.label}
                                index={track}
                              />
                            ) : (
                              <li className="mx-rs-track" key={meal.key}>
                                <span
                                  className="mx-rs-track__no"
                                  aria-hidden="true"
                                >
                                  {String(track + 1).padStart(2, "0")}
                                </span>
                                <p className="mx-rs-track__note">
                                  <span className="mx-rs-tag">
                                    {meal.label}
                                  </span>
                                  Nothing nearby fits this meal in the hours
                                  of this day.
                                </p>
                                <span className="mx-rs-track__hour">—</span>
                              </li>
                            );
                          })}
                        </ol>

                        {tripId ? (
                          <div className="mx-rs-day__rework">
                            <button
                              type="button"
                              className="mx-rs-btn"
                              disabled={working !== null}
                              aria-busy={working === dayIndex}
                              onClick={() => work(dayIndex, "day")}
                            >
                              {working === dayIndex ? "Working" : "New day"}
                            </button>
                            <button
                              type="button"
                              className="mx-rs-btn"
                              disabled={working !== null}
                              aria-busy={working === dayIndex}
                              onClick={() => work(dayIndex, "meals")}
                            >
                              New meals
                            </button>
                            <button
                              type="button"
                              className="mx-rs-btn"
                              disabled={working !== null}
                              aria-busy={working === dayIndex}
                              onClick={() => work(dayIndex, "order")}
                            >
                              Re-order
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mx-rs-plain">
                  The solver returned no days for this trip.
                </p>
              )}
              {replanned ? (
                <p className="mx-rs-status" role="status">
                  {replanned}
                </p>
              ) : null}
            </section>

            {/* Arrival: gated on the payload, never filled in with a
                plausible airport that might be wrong. */}
            <section className="mx-rs-section" aria-label="Arrival">
              <h2 className="mx-rs-section__title">How you arrive</h2>
              {reachRows.length ? (
                <dl className="mx-rs-reach">
                  {reachRows.map(([mode, pair]) => (
                    <div className="mx-rs-reach__row" key={mode}>
                      <dt className="mx-rs-reach__mode">{mode}</dt>
                      <dd className="mx-rs-reach__name">
                        {pair?.[0]}
                        {pair?.[1] ? (
                          <span className="mx-rs-reach__detail">{pair[1]}</span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mx-rs-plain">
                  The solver does not gather transport yet, and nothing is
                  invented here to fill the gap. Work the estimate below
                  against the journey you actually have.
                </p>
              )}

              <div className="mx-rs-stub" role="note">
                <p className="mx-rs-stub__title">Need wheels?</p>
                <p>Get a cab quote below — an external search, never a TripTribe quote.</p>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`car rental ${city?.name ?? ""}`.trim())}`} target="_blank" rel="nofollow noopener" className="mx-rs-link">Get a cab quote · external search{" "}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2 6h7M6.5 3 9.5 6 6.5 9"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                    />
                  </svg>
                </a>
                <p className="mx-rs-disclosure">Opens a Google search in a new tab. TripTribe does not set or earn this fare.</p>
              </div>
              <div className="mx-rs-calc">
                <p className="mx-rs-calc__title">Getting there and back</p>
                <p className="mx-rs-calc__note">
                  You name the four figures; the sheet does the arithmetic.
                  Nothing here is a quote.
                </p>
                <div className="mx-rs-calc__fields">
                  {(
                    [
                      ["Distance", distance, setDistance, "km", "mx-rs-calc-distance"],
                      ["Mileage", mileage, setMileage, "km per litre", "mx-rs-calc-mileage"],
                      ["Fuel price", fuel, setFuel, `${unit} a litre`, "mx-rs-calc-fuel"],
                      ["Tolls", tolls, setTolls, unit, "mx-rs-calc-tolls"],
                    ] as const
                  ).map(([label, value, set, suffix, id]) => (
                    <label className="mx-rs-field" key={label} htmlFor={id}>
                      <span className="mx-rs-field__label">{label}</span>
                      <span className="mx-rs-field__input">
                        <input
                          id={id}
                          inputMode="decimal"
                          value={value}
                          onChange={(event) => set(event.target.value)}
                          aria-label={`${label} in ${suffix}`}
                        />
                        <span className="mx-rs-field__suffix">{suffix}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mx-rs-calc__out">
                  <span className="mx-rs-calc__outkey">
                    ESTIMATED FUEL + TOLLS
                  </span>
                  <span
                    className="mx-rs-calc__figure"
                    data-empty={estimate == null}
                  >
                    {estimate == null ? "—" : money(unit, estimate)}
                  </span>
                </p>
              </div>
            </section>

            <section className="mx-rs-section" aria-label="Before you go">
              <h2 className="mx-rs-section__title">Before you go</h2>
              {tips.length ? (
                <ol className="mx-rs-tips">
                  {tips.map((tip, index) => (
                    <li className="mx-rs-tip" key={index}>
                      {tip}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mx-rs-plain">
                  The solver returned no notes for this city. The sheet stands
                  without them.
                </p>
              )}
            </section>

            <section className="mx-rs-section" aria-label="Where you would sleep">
              <h2 className="mx-rs-section__title">Where you would sleep</h2>
              <HotelSection plan={plan} unit={unit} />
            </section>

            <div className="mx-rs-balanceband">
              <p className="mx-rs-balanceband__line">
                {city?.name} · {days.length} {days.length === 1 ? "DAY" : "DAYS"}{" "}
                · {sum(unit, budget?.total)} ESTIMATED
              </p>
              <p className="mx-rs-balanceband__note">
                Hand this to whoever you are travelling with. Nothing on it is
                booked, quoted or held — it is a route and an estimate, and every
                cost on it was worked out from the total entered on the sheet before
                it. Stay stubs link to live prices on Google Hotels; TripTribe may earn a fee on those links.
              </p>
            </div>

            <section className="mx-rs-section" aria-label="Handing it over">
              <h2 className="mx-rs-section__title">Dubbed. Now pass it around.</h2>
              <div className="mx-rs-handoff__run">
                <a
                  className="mx-rs-btn"
                  href={passHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pass the tape on WhatsApp
                </a>
              </div>
              <p className="mx-rs-handoff__hint">
                Opens WhatsApp with the route summary written out for the
                group chat. Nothing on it is booked — it is a route and an
                estimate.
              </p>
              {tripId ? (
                <>
                  <label
                    className="mx-rs-field"
                    htmlFor="mx-rs-handoff-address"
                  >
                    <span className="mx-rs-field__label">Send to</span>
                    <span className="mx-rs-field__input">
                      <input
                        id="mx-rs-handoff-address"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={address}
                        aria-describedby="mx-rs-handoff-hint"
                        onChange={(event) => setAddress(event.target.value)}
                      />
                    </span>
                  </label>
                  <p
                    className="mx-rs-handoff__hint"
                    id="mx-rs-handoff-hint"
                  >
                    The sheet as it stands, sent as text and as a page. Leave
                    blank to send it to your account address.
                  </p>
                  <div className="mx-rs-handoff__run">
                    <button
                      className="mx-rs-btn mx-rs-btn--primary"
                      type="button"
                      disabled={sending}
                      onClick={hand}
                    >
                      {sending ? "Sending" : "Send the sheet"}
                    </button>
                    {handed && (
                      <p className="mx-rs-status" role="status">
                        {handed}
                      </p>
                    )}
                  </div>
                  <p className="mx-rs-handoff__hint">
                    Uses the places already saved with this trip, so working a
                    day again costs nothing and changes nothing else. The
                    estimate is recalculated for the whole trip.
                  </p>
                </>
              ) : (
                <p className="mx-rs-handoff__hint">
                  This sheet was issued before sending and re-planning existed,
                  so it carries no handle. Plan the trip again to get both.
                </p>
              )}
            </section>

            <footer className="mx-rs-footnote">
              {budget?.isEstimate ? (
                <p>Worked as an estimate from the total entered.</p>
              ) : null}
              {plan.cached ? (
                <p>Served from the last day&apos;s answer for this trip.</p>
              ) : null}
            </footer>
          </main>

          {days.length > 1 ? (
            <nav className="mx-rs-index" aria-label="Days">
              <p className="mx-rs-index__title">ON THIS SIDE</p>
              <ol>
                {days.map((day) => (
                  <li key={day.day}>
                    <a
                      href={`#mx-rs-day-${day.day}`}
                      aria-current={currentDay === day.day}
                    >
                      DAY {String(day.day).padStart(2, "0")}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Result;
