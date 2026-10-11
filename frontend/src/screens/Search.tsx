"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useAppSelector } from "@/store";
import { PlanRequestError, postItinerary } from "@/lib/api";
import { onMapsReady } from "@/lib/maps";
import type { MapsAutocomplete } from "@/lib/maps";
import { storeResult, takeSeed } from "@/lib/nav";

/* ─────────────────────────────────────────────────────────────────────────
   The manifest.

   One flat document, not a wizard. The traveller is accountable to a group for
   money and time, and a plan assembled one hidden step at a time cannot be
   reviewed before it is paid for — so all three entries are present and
   readable at once, numbered in the order they are meant to be filled.

   Each entry's label is an instruction, not a noun: "the city is", "the whole
   trip costs under", "you have". A label that only names its field is form
   furniture; these are read as the three sentences a trip is made of.

   Validation is stated where it happened. The failing entry takes a vermilion
   message and a thickened rule, and the first refusal takes focus — instead of
   a toast that disappears and a field the traveller has to go and find. The
   submit button never disables: a product that refuses should say why in
   words, in the place the refusal is about.
   ───────────────────────────────────────────────────────────────────────── */

const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12h13m0 0-5-5m5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* Exactly what the issued sheet holds, and nothing more. Each line is a block
   the planner actually returns (PlanPayload in lib/types.ts). Nothing here
   promises an account, a saved trip or a delivered email — PRODUCT.md records
   all three as unbuilt. */
const CARRIED: { id: string; body: ReactNode }[] = [
  {
    id: "route",
    body: (
      <>
        <strong>A day-wise route</strong>, sequenced so each day follows one
        line through the city rather than a list of stops.
      </>
    ),
  },
  {
    id: "meals",
    body: (
      <>
        <strong>Meals</strong> placed beside the activities of that day, inside
        the hours you will actually be out.
      </>
    ),
  },
  {
    id: "reach",
    body: (
      <>
        <strong>How to reach the city</strong> — nearest airport, station and bus
        stand.
      </>
    ),
  },
  {
    id: "hotels",
    body: (
      <>
        <strong>Hotels inside the budget</strong> you entered, each one marked as
        an estimate rather than a quote.
      </>
    ),
  },
  {
    id: "ledger",
    body: (
      <>
        <strong>The cost ledger</strong> — your total, and how it breaks down
        across stay, food, activity and movement.
      </>
    ),
  },
  {
    id: "road",
    body: (
      <>
        <strong>A road-trip estimate</strong> for getting there and back, at the
        mileage and fuel price you name.
      </>
    ),
  },
];

type FieldName = "city" | "budget" | "days";
type Errors = Partial<Record<FieldName, string>>;

export default function Search() {
  const router = useRouter();
  const email =
    useAppSelector((state) => state.auth).userInfo?.email ?? "";

  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [refusal, setRefusal] = useState("");
  const [working, setWorking] = useState(false);

  const cityRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<MapsAutocomplete | null>(null);

  const focusField = useCallback((field: FieldName) => {
    const target =
      field === "city" ? cityRef.current : field === "budget" ? budgetRef.current : daysRef.current;
    target?.focus();
    target?.setSelectionRange?.(0, target.value.length);
  }, []);

  /* The landing page seeds these three from its own slip. One-shot: takeSeed()
     clears as it reads, so arriving twice does not refill a sheet the traveller
     has already changed. */
  useEffect(() => {
    const seed = takeSeed();
    if (!seed) return;
    if (seed.cityName) setCity(seed.cityName);
    if (seed.days) setDays(seed.days);
    if (seed.budget) setBudget(seed.budget);
  }, []);

  /* The city entry has been on screen since the page opened, so the Places
     widget attaches here rather than on a step that no longer exists. */
  useEffect(() => {
    const input = cityRef.current;
    if (!input) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || autocompleteRef.current) return;
      if (!window.google?.maps?.places) return;
      try {
        const ac = new window.google.maps.places.Autocomplete(input, {
          types: ["(cities)"],
          fields: ["name", "place_id"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place?.name) {
            setCity(place.name);
            setErrors((prev) => (prev.city ? { ...prev, city: undefined } : prev));
          }
        });
        autocompleteRef.current = ac;
      } catch (error) {
        console.error("Places Autocomplete unavailable:", error);
      }
    };

    const off = onMapsReady(init);

    return () => {
      cancelled = true;
      off();
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  /* The backend's REQUEST_LIMITS, restated where the traveller can read them.
     The attributes on the inputs are advisory; this is what actually gates. */
  const check = (): Errors => {
    const next: Errors = {};
    const cityName = city.trim();
    const budgetNum = Number(budget);
    const daysNum = Number(days);

    if (cityName.length < 2) {
      next.city = "Name the city the route runs through.";
    }
    if (!Number.isFinite(budgetNum) || budgetNum < 1000) {
      next.budget = "At least ₹1,000 — the trip is costed, not guessed at.";
    }
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 60) {
      next.days = "Between 1 and 60 days.";
    }
    return next;
  };

  const clearError = (field: FieldName) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    setRefusal("");

    const found = check();
    const order: FieldName[] = ["city", "budget", "days"];
    const firstBad = order.find((field) => found[field]);
    if (firstBad) {
      setErrors(found);
      focusField(firstBad);
      return;
    }

    setErrors({});
    setWorking(true);

    try {
      const response = await postItinerary({
        cityName: city.trim(),
        budget: Number(budget),
        days: Number(days),
        email,
      });
      storeResult(response);
      router.push("/result");
    } catch (error) {
      if (error instanceof PlanRequestError && error.status === 400) {
        const said = error.details
          .map((detail) => detail.message)
          .filter(Boolean)
          .join(" ");
        setRefusal(said || "The planner refused those entries. Adjust them and issue again.");
      } else {
        setRefusal(
          "The route could not be worked out. Nothing was changed — issue it again."
        );
      }
      setWorking(false);
    }
  };

  /**
   * An entry the visitor has left blank is a missing measurement, not a refused
   * value. The world's vermilion is reserved for a value the product turns
   * down; scolding an empty form in that ink spends the one signal the sheet
   * has, on something that was never answered. So a blank entry is marked in
   * the faint ink and with the em dash every other absent figure gets.
   */
  const blank = (field: FieldName) =>
    Boolean(errors[field]) && `${field === "city" ? city : field === "budget" ? budget : days}`.trim() === "";

  /** The entry always describes its hint; it adds the refusal when there is one. */
  const described = (field: FieldName) =>
    `tt-${field}-hint${errors[field] ? ` tt-${field}-error` : ""}`;

  return (
    <div className="tt-page">
      <div className="tt-rail">
        <section className="tt-manifest">
          <div className="tt-manifest__about">
            <h1 className="tt-display tt-manifest__display">
              Three entries, one sheet.
            </h1>
            <p className="tt-lede tt-manifest__lede">
              Fill the manifest in order. We sequence the entries along one route
              and issue a single sheet you can hand to the group.
            </p>
          </div>

        <form
          className="tt-sheet"
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="tt-sheet-title"
        >
          <div className="tt-sheet__head">
            <h2 className="tt-sheet__title" id="tt-sheet-title">
              The manifest
            </h2>
            <p className="tt-sheet__ref">
              <span>TT/ROUTE</span>
              <span className="tt-sheet__slash" aria-hidden="true">
                /
              </span>
              <span>MANIFEST</span>
            </p>
          </div>

          <ol className="tt-entries">
            <li className="tt-entry">
              <span className="tt-entry__no" aria-hidden="true">
                01
              </span>
              <div className="tt-entry__main">
                <label className="tt-entry__label" htmlFor="tt-city">
                  <span className="tt-entry__ask">The city is</span>
                  <span className="tt-entry__rule">Place or city</span>
                </label>
                <input
                  id="tt-city"
                  ref={cityRef}
                  className="tt-field__input tt-field__input--city"
                  type="text"
                  autoComplete="off"
                  placeholder="Jaipur"
                  value={city}
                  aria-invalid={Boolean(errors.city)}
                    data-blank={blank("city")}
                  aria-describedby={described("city")}
                  onChange={(event) => {
                    setCity(event.target.value);
                    clearError("city");
                  }}
                />
                <p className="tt-field__hint" id="tt-city-hint">
                  Start typing; suggestions appear as you go.
                </p>
                {errors.city && (
                  <p
                    className={`tt-field__error${blank("city") ? " tt-field__error--missing" : ""}`}
                    id="tt-city-error"
                  >
                    {errors.city}
                  </p>
                )}
              </div>
            </li>

            <li className="tt-entry">
              <span className="tt-entry__no" aria-hidden="true">
                02
              </span>
              <div className="tt-entry__main">
                <label className="tt-entry__label" htmlFor="tt-search-budget">
                  <span className="tt-entry__ask">The trip costs under</span>
                  <span className="tt-entry__rule">Min 1,000 · step 100</span>
                </label>
                <div className="tt-field__affix">
                  <span className="tt-field__currency" aria-hidden="true">
                    ₹
                  </span>
                  <input
                    id="tt-search-budget"
                    ref={budgetRef}
                    className="tt-field__input tt-field__input--fig tt-field__input--budget"
                    type="text"
                    inputMode="numeric"
                    placeholder="24,000"
                    value={budget}
                    aria-invalid={Boolean(errors.budget)}
                    data-blank={blank("budget")}
                    aria-describedby={described("budget")}
                    onChange={(event) => {
                      setBudget(event.target.value);
                      clearError("budget");
                    }}
                  />
                </div>
                <p className="tt-field__hint" id="tt-budget-hint">
                  Rupees, for the whole trip and everyone on it — not per day.
                </p>
                {errors.budget && (
                  <p
                    className={`tt-field__error${blank("budget") ? " tt-field__error--missing" : ""}`}
                    id="tt-budget-error"
                  >
                    {errors.budget}
                  </p>
                )}
              </div>
            </li>

            <li className="tt-entry">
              <span className="tt-entry__no" aria-hidden="true">
                03
              </span>
              <div className="tt-entry__main">
                <label className="tt-entry__label" htmlFor="tt-search-days">
                  <span className="tt-entry__ask">You have</span>
                  <span className="tt-entry__rule">1 to 60</span>
                </label>
                <div className="tt-field__affix">
                  <input
                    id="tt-search-days"
                    ref={daysRef}
                    className="tt-field__input tt-field__input--fig"
                    type="text"
                    inputMode="numeric"
                    placeholder="6"
                    value={days}
                    aria-invalid={Boolean(errors.days)}
                    data-blank={blank("days")}
                    aria-describedby={described("days")}
                    onChange={(event) => {
                      setDays(event.target.value);
                      clearError("days");
                    }}
                  />
                  <span className="tt-entry__unit">days, the whole trip</span>
                </div>
                <p className="tt-field__hint" id="tt-days-hint">
                  Calendar days. The route is sequenced across every one of them.
                </p>
                {errors.days && (
                  <p
                    className={`tt-field__error${blank("days") ? " tt-field__error--missing" : ""}`}
                    id="tt-days-error"
                  >
                    {errors.days}
                  </p>
                )}
              </div>
            </li>
          </ol>

          {refusal && (
            <p className="tt-sheet__refusal" role="alert">
              {refusal}
            </p>
          )}

          {/* The sheet's terminal rule carries the one footnote and the one
              issuing block together. A second copy of the caveat stranded in
              the margin column was the same sentence twice, and twice is not a
              caveat. */}
          <div className="tt-sheet__run">
            <p className="tt-sheet__note">
              Nothing is booked for you. The sheet is worked out from these three
              entries and the costs on it are estimates.
            </p>
            <button className="tt-btn" type="submit">
              {working ? "Working the route" : "Issue the route"}
              {!working && <IconArrow />}
            </button>
          </div>
        </form>
          <aside className="tt-carry" aria-labelledby="tt-carry-title">
            <div className="tt-carry__head">
              <h2 className="tt-carry__title" id="tt-carry-title">
                What it carries
              </h2>
              <p className="tt-carry__ref">TT/CARRY</p>
            </div>
            {/* An unordered set of six, so it takes no numbers: numbering it
                would promise an order the reader has no reason to follow. The
                manifest's own 01-03 earn their figures because the entries are
                filled in order. */}
            <ul className="tt-carry__list">
              {CARRIED.map((item) => (
                <li className="tt-carry__item" key={item.id}>
                  <p className="tt-carry__body">{item.body}</p>
                </li>
              ))}
            </ul>
            <p className="tt-carry__foot">
              Three entries in, one sheet out. Nothing else is asked of you.
            </p>
          </aside>
      </section>
    </div>
        </div>
  );
}