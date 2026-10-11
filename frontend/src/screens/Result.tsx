"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ActivityCard, { clock } from "@/components/ActivityCard";
import HotelSection from "@/components/HotelSection";
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
    return hours ? `${hours} HR ${String(rest).padStart(2, "0")} MIN` : `${rest} MIN`;
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

    // `react-router`'s `location.state` has no App Router equivalent. The plan
    // is parked in `sessionStorage` by whoever handed it over — a plan just
    // generated on /search, or a saved trip reopened from the account drawer —
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

    // Direct visit, or a reload after the one-shot key was spent: there is no
    // plan to render. The original read `state.city.name` off an empty object and
    // threw; saying so and offering the obvious next step beats a white screen.
    if (!plan) {
        // `.tt-close` carries no gutter of its own — it is a band, and bands
        // sit inside the rail. Returned bare it put its rules against the
        // window edge and clipped its own text.
        return (
            <div className="tt-page">
                <div className="tt-rail">
                    <div className="tt-close">
                        <div className="tt-close__inner">
                            <p className="tt-close__line">No plan on this page.</p>
                            <p className="tt-close__fine">
                                It is handed over when a trip is generated, and
                                lasts for this tab only.
                            </p>
                        </div>
                        <Link className="tt-btn" href="/search">
                            Plan a trip
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const city = plan.city;
    const budget = plan.Budget;
    const days = Array.isArray(plan.itinerary) ? plan.itinerary : [];
    const unit = moneyUnit(plan);

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
    const estimateReady =
        named.every((value) => Number.isFinite(value) && value > 0);
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
        ? ([
              ["By air", plan.Reach.nearestAirport],
              ["By rail", plan.Reach.nearestRailwayStation],
              ["By road", plan.Reach.nearestBusStation],
          ] as const).filter(([, pair]) => Array.isArray(pair) && pair.some(Boolean))
        : [];

    return (
        <div className="tt-page">
            <div className="tt-rail">
                {/* The destination, named before anything is asked of it. */}
                <section className="tt-issue">
                    <div className="tt-issue__head">
                        <h1 className="tt-display tt-issue__title">{city?.name}</h1>
                        <span className="tt-issue__ref">TT/SHEET</span>
                    </div>
                    {city?.description ? (
                        <p className="tt-lede tt-issue__lede">{city.description}</p>
                    ) : null}
                    {facts.length ? (
                        <dl className="tt-issue__facts">
                            {facts.map(([key, value]) => (
                                <div className="tt-issue__fact" key={key}>
                                    <dt className="tt-issue__factKey">{key}</dt>
                                    <dd className="tt-issue__factVal">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    ) : null}
                </section>

                {/* The manifest from /search, filled in. Same sheet, same
                    numbered entries, same ruled grammar — the paper is no
                    longer a slip to be posted but the document itself, so it
                    loses its border and runs the full rail. */}
                <section className="tt-sheet tt-sheet--filled">
                    <div className="tt-sheet__head">
                        <h2 className="tt-sheet__title">The sheet</h2>
                        <span className="tt-sheet__ref">
                            TT/ROUTE <i className="tt-sheet__slash">/</i> FILLED
                        </span>
                    </div>

                    <ol className="tt-entries">
                        {/* 01 — the money, and the verdict on it. */}
                        <li className="tt-entry">
                            <div className="tt-entry__no">01</div>
                            <div className="tt-entry__main">
                                <div className="tt-entry__label">
                                    <span className="tt-entry__ask">
                                        The trip costs under
                                    </span>
                                    <span className="tt-entry__rule">
                                        {budget?.isEstimate ? "ESTIMATE" : "AS ENTERED"}
                                    </span>
                                </div>

                                {/* The total is the first term of the balance the
                                    contract promises, and the refusal below names
                                    it, so it is printed whether or not the solver
                                    broke it down. */}
                                <p className="tt-balance-line">
                                    <span className="tt-balance-line__figure">
                                        {sum(unit, budget?.total)}
                                    </span>{" "}
                                    <span className="tt-balance-line__note">
                                        {total == null
                                            ? "The solver returned no total."
                                            : `for ${days.length} ${
                                                  days.length === 1 ? "day" : "days"
                                              }, everyone on it`}
                                    </span>
                                </p>

                                {budget?.insufficientBudget ? (
                                    /* Vermilion only ever marks a refused value, and
                                       only ever on lifted slip stock — the one
                                       thing on /result that lifts. */
                                    <div className="tt-verdict" role="alert">
                                        <p className="tt-verdict__line">
                                            This total will not cover {city?.name} in{" "}
                                            {days.length}{" "}
                                            {days.length === 1 ? "day" : "days"}.
                                        </p>
                                        {budget.insufficientBudgetMessage ? (
                                            <p className="tt-verdict__body">
                                                {budget.insufficientBudgetMessage}
                                            </p>
                                        ) : null}
                                        {budget.alternativeOptions ? (
                                            <p className="tt-verdict__body">
                                                {budget.alternativeOptions}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}

                                {split ? (
                                    <dl className="tt-split">
                                        {split.map(([label, figure]) => (
                                            <div className="tt-split__row" key={label}>
                                                <dt className="tt-split__key">{label}</dt>
                                                <dd className="tt-split__val">
                                                    {sum(unit, figure)}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                ) : (
                                    <p className="tt-entry__plain">
                                        The solver returned no breakdown of the total
                                        into stay, food, doings and getting about.
                                        The total itself is not in doubt.
                                    </p>
                                )}

                                {/* The split is worked out; the total is the number
                                    that was entered. When the two disagree the sheet
                                    says so rather than letting four tidy figures
                                    imply they account for the whole thing. */}
                                {unattributed != null && unattributed !== 0 ? (
                                    <p className="tt-entry__plain">
                                        The breakdown accounts for{" "}
                                        {money(unit, accounted as number)}.{" "}
                                        {unattributed > 0
                                            ? `The remaining ${money(unit, unattributed)} is not attributed to a category by the solver.`
                                            : `The four categories add up to ${money(unit, -unattributed)} more than the total entered, so the split is over-stated.`}
                                    </p>
                                ) : null}

                                {budget?.averageTotalCost ||
                                budget?.averageAccommodationCost ? (
                                    <p className="tt-entry__plain">
                                        For comparison, the solver puts a typical{" "}
                                        {days.length}-day trip in {city?.name} at{" "}
                                        {numeric(budget.averageTotalCost) != null
                                            ? money(unit, numeric(budget.averageTotalCost) as number)
                                            : "an unnamed figure"}
                                        {budget.averageAccommodationCost
                                            ? `, with a night around ${money(unit, numeric(budget.averageAccommodationCost) as number)}`
                                            : ""}
                                        . Both are working estimates.
                                    </p>
                                ) : null}
                            </div>
                        </li>

                        {/* 02 — the route, as a run of days rather than a
                                 switcher. Tabs hid all but one day behind a
                                 control that looked like navigation; a day is a
                                 route, and a route reads top to bottom. */}
                        <li className="tt-entry">
                            <div className="tt-entry__no">02</div>
                            <div className="tt-entry__main">
                                <div className="tt-entry__label">
                                    <span className="tt-entry__ask">
                                        The route runs
                                    </span>
                                    <span className="tt-entry__rule">
                                        {days.length}{" "}
                                        {days.length === 1 ? "DAY" : "DAYS"}
                                    </span>
                                </div>

                                {days.length ? (
                                    <ol className="tt-days">
                                        {days.map((day) => {
                                            const ends = clock(day.endMinute);
                                            const moving = duration(day.travelMinutes);
                                            const stops = Array.isArray(
                                                day.activities,
                                            )
                                                ? day.activities
                                                : [];
                                            return (
                                                <li className="tt-day" key={day.day}>
                                                    <div className="tt-day__head">
                                                        <span className="tt-day__no">
                                                            DAY{" "}
                                                            {String(day.day).padStart(
                                                                2,
                                                                "0",
                                                            )}
                                                        </span>
                                                        <span className="tt-day__weekday">
                                                            {day.weekday}
                                                        </span>
                                                        <span className="tt-day__measures">
                                                            {stops.length}{" "}
                                                            {stops.length === 1
                                                                ? "STOP"
                                                                : "STOPS"}
                                                            {moving
                                                                ? ` · ${moving} MOVING`
                                                                : ""}
                                                            {ends
                                                                ? ` · ENDS ${ends}`
                                                                : ""}
                                                        </span>
                                                    </div>

                                                    {stops.length ? (
                                                        <ol className="tt-stops">
                                                            {stops.map((stop, index) => (
                                                                <ActivityCard
                                                                    key={`${stop.place}-${index}`}
                                                                    place={stop}
                                                                    anchor={index === 0}
                                                                />
                                                            ))}
                                                        </ol>
                                                    ) : (
                                                        <p className="tt-entry__plain">
                                                            The solver returned no stops
                                                            for this day.
                                                        </p>
                                                    )}

                                                    <ol className="tt-meals">
                                                        {MEALS.map((meal) => {
                                                            const slot =
                                                                day.meals?.[meal.key];
                                                            return slot ? (
                                                                <ActivityCard
                                                                    key={meal.key}
                                                                    place={slot}
                                                                    meal={meal.label}
                                                                />
                                                            ) : (
                                                                <li
                                                                    className="tt-stop tt-stop--absent"
                                                                    key={meal.key}
                                                                >
                                                                    <span className="tt-stop__hour">
                                                                        —
                                                                    </span>
                                                                    <p className="tt-stop__none">
                                                                        <span className="tt-stop__tag">
                                                                            {meal.label}
                                                                        </span>
                                                                        Nothing
                                                                        nearby fits this
                                                                        meal in the
                                                                        hours of this
                                                                        day.
                                                                    </p>
                                                                </li>
                                                            );
                                                        })}
                                                    </ol>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                ) : (
                                    <p className="tt-entry__plain">
                                        The solver returned no days for this trip.
                                    </p>
                                )}
                            </div>
                        </li>

                        {/* 03 — arrival. Gated on the payload, never filled in
                                 with a plausible airport that might be wrong. */}
                        <li className="tt-entry">
                            <div className="tt-entry__no">03</div>
                            <div className="tt-entry__main">
                                <div className="tt-entry__label">
                                    <span className="tt-entry__ask">
                                        How you arrive
                                    </span>
                                    <span className="tt-entry__rule">
                                        {reachRows.length ? "GATHERED" : "NOT GATHERED"}
                                    </span>
                                </div>

                                {reachRows.length ? (
                                    <dl className="tt-reach">
                                        {reachRows.map(([mode, pair]) => (
                                            <div className="tt-reach__row" key={mode}>
                                                <dt className="tt-reach__mode">{mode}</dt>
                                                <dd className="tt-reach__name">
                                                    {pair?.[0]}
                                                    {pair?.[1] ? (
                                                        <span className="tt-reach__detail">
                                                            {pair[1]}
                                                        </span>
                                                    ) : null}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                ) : (
                                    <p className="tt-entry__plain">
                                        The solver does not gather transport yet, and
                                        nothing is invented here to fill the gap. Work
                                        the estimate below against the journey you
                                        actually have.
                                    </p>
                                )}

                                <div className="tt-calc">
                                    <p className="tt-calc__title">
                                        Getting there and back
                                    </p>
                                    <p className="tt-calc__note">
                                        You name the four figures; the sheet does the
                                        arithmetic. Nothing here is a quote.
                                    </p>
                                    <div className="tt-calc__fields">
                                        {(
                                            [
                                                ["Distance", distance, setDistance, "km"],
                                                [
                                                    "Mileage",
                                                    mileage,
                                                    setMileage,
                                                    "km per litre",
                                                ],
                                                ["Fuel price", fuel, setFuel, `${unit} a litre`],
                                                ["Tolls", tolls, setTolls, unit],
                                            ] as const
                                        ).map(
                                            ([label, value, set, suffix]) => (
                                                <label className="tt-calc__field" key={label}>
                                                    <span className="tt-calc__label">
                                                        {label}
                                                    </span>
                                                    <span className="tt-calc__input">
                                                        <input
                                                            className="tt-calc__box"
                                                            inputMode="decimal"
                                                            value={value}
                                                            onChange={(event) =>
                                                                set(event.target.value)
                                                            }
                                                            aria-label={`${label} in ${suffix}`}
                                                        />
                                                        <span className="tt-calc__suffix">
                                                            {suffix}
                                                        </span>
                                                    </span>
                                                </label>
                                            ),
                                        )}
                                    </div>
                                    <p className="tt-calc__out">
                                        <span className="tt-calc__outKey">
                                            ESTIMATED FUEL + TOLLS
                                        </span>
                                        <span
                                            className="tt-calc__figure"
                                            data-empty={estimate == null}
                                        >
                                            {estimate == null
                                                ? "—"
                                                : money(unit, estimate)}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </li>

                        {/* 04 — tips. These used to sit inside a
                                 `Reach && …` block, so they vanished every time
                                 the solver left transport null — which is always,
                                 today. The condition gated the wrong thing. */}
                        <li className="tt-entry">
                            <div className="tt-entry__no">04</div>
                            <div className="tt-entry__main">
                                <div className="tt-entry__label">
                                    <span className="tt-entry__ask">
                                        Before you go
                                    </span>
                                    <span className="tt-entry__rule">
                                        {tips.length}{" "}
                                        {tips.length === 1 ? "NOTE" : "NOTES"}
                                    </span>
                                </div>
                                {tips.length ? (
                                    <ol className="tt-tips">
                                        {tips.map((tip, index) => (
                                            <li className="tt-tip" key={index}>
                                                {tip}
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="tt-entry__plain">
                                        The solver returned no notes for this city.
                                        The sheet stands without them.
                                    </p>
                                )}
                            </div>
                        </li>

                        {/* 05 — where the nights go. */}
                        <li className="tt-entry">
                            <div className="tt-entry__no">05</div>
                            <div className="tt-entry__main">
                                <div className="tt-entry__label">
                                    <span className="tt-entry__ask">
                                        Where you would sleep
                                    </span>
                                    <span className="tt-entry__rule">
                                        {Array.isArray(plan.hotels)
                                            ? `${plan.hotels.length} WORKED OUT`
                                            : "NOT WORKED OUT"}
                                    </span>
                                </div>
                                <HotelSection plan={plan} unit={unit} />
                            </div>
                        </li>
                    </ol>

                    {/* The balance the sheet closes on: the three entries the
                        visitor filled in, restated as issued figures. */}
                    <div className="tt-balance">
                        <span className="tt-balance__key">ISSUED</span>
                        <span className="tt-balance__val">
                            {city?.name} · {days.length}{" "}
                            {days.length === 1 ? "DAY" : "DAYS"} ·{" "}
                            {sum(unit, budget?.total)} ESTIMATED
                        </span>
                    </div>
                    <p className="tt-balance__note">
                        Hand this to whoever you are travelling with. Nothing on it
                        is booked, quoted or held — it is a route and an estimate,
                        and every cost on it was worked out from the total entered
                        on the sheet before it.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Result;