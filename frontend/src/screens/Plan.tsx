"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useAppSelector } from "@/store";
import { PlanRequestError, fetchCityImage, postItinerary } from "@/lib/api";
import { onMapsReady } from "@/lib/maps";
import type { MapsAutocomplete } from "@/lib/maps";
import { storeResult, takeSeed } from "@/lib/nav";
import "../mx-plan.css";

const IconArrow = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M5 12h13m0 0-5-5m5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
        <strong>How to reach the city</strong> — nearest airport, station and
        bus stand.
      </>
    ),
  },
  {
    id: "hotels",
    body: (
      <>
        <strong>Stay stubs with live-price checks</strong> inside the budget you entered, each marked as an estimate with a live-price link.
      </>
    ),
  },
  {
    id: "ledger",
    body: (
      <>
        <strong>The fare ledger</strong> — your total, and how it splits across stay, food, activity and movement.
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

const PACES = [
  { value: "RELAXED", label: "Relaxed — 3 stops a day" },
  { value: "BALANCED", label: "Balanced — 4 stops a day" },
  { value: "PACKED", label: "Packed — 6 stops a day" },
] as const;

const TRAVEL_MODES = [
  { value: "WALK", label: "On foot" },
  { value: "TRANSIT", label: "Public transport" },
  { value: "DRIVE", label: "Car" },
  { value: "BICYCLE", label: "Bicycle" },
] as const;

const CURRENCIES = [
  { value: "INR", label: "₹ Rupee" },
  { value: "USD", label: "$ US dollar" },
  { value: "EUR", label: "€ Euro" },
  { value: "GBP", label: "£ Pound" },
  { value: "AED", label: "AED Dirham" },
  { value: "SGD", label: "S$ Singapore dollar" },
  { value: "JPY", label: "¥ Yen" },
  { value: "THB", label: "฿ Baht" },
] as const;

const CURRENCY_MARK: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED",
  SGD: "S$",
  JPY: "¥",
  THB: "฿",
};

const CURRENCY_PLURAL: Record<string, string> = {
  INR: "Rupees",
  USD: "US dollars",
  EUR: "Euros",
  GBP: "Pounds",
  AED: "Dirhams",
  SGD: "Singapore dollars",
  JPY: "Yen",
  THB: "Baht",
};

const INTERESTS = [
  "History",
  "Architecture",
  "Art and museums",
  "Food and street food",
  "Nature and parks",
  "Views and photography",
  "Shopping",
  "Nightlife",
  "Local culture",
  "Religious sites",
  "Family friendly",
  "Beaches",
  "Hiking",
  "Live music",
] as const;

type Errors = Partial<Record<FieldName, string>>;

const NARRATION = [
  "Sending the three entries…",
  "The planner is sequencing the days…",
  "Placing meals near the stops…",
  "Checking the total…",
];

export default function Plan() {
  const router = useRouter();
  const email = useAppSelector((state) => state.auth).userInfo?.email ?? "";

  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [refusal, setRefusal] = useState("");
  const [travellers, setTravellers] = useState("2");
  const [pace, setPace] = useState<(typeof PACES)[number]["value"]>("BALANCED");
  const [travelMode, setTravelMode] =
    useState<(typeof TRAVEL_MODES)[number]["value"]>("WALK");
  const [currency, setCurrency] = useState("INR");
  const [startDate, setStartDate] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoGone, setPhotoGone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [line, setLine] = useState(0);

  const cityRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<MapsAutocomplete | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const focusField = useCallback((field: FieldName) => {
    const target =
      field === "city"
        ? cityRef.current
        : field === "budget"
          ? budgetRef.current
          : daysRef.current;
    target?.focus();
    target?.setSelectionRange?.(0, target.value.length);
  }, []);

  useEffect(() => {
    const seed = takeSeed();
    if (!seed) return;
    if (seed.cityName) setCity(seed.cityName);
    if (seed.days) setDays(seed.days);
    if (seed.budget) setBudget(seed.budget);
  }, []);

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
            const name = place.name;
            setCity(name);
            setErrors((prev) =>
              prev.city ? { ...prev, city: undefined } : prev,
            );
            setPhoto(null);
            setPhotoGone(false);
            void fetchCityImage(name).then((url) => {
              if (cancelled) return;
              if (!url || url.includes("picsum.photos")) return;
              setPhoto(url);
            });
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
        window.google.maps.event.clearInstanceListeners(
          autocompleteRef.current,
        );
        autocompleteRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!working) return;
    setElapsed(0);
    setLine(0);
    const started = Date.now();
    const clock = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    const words = window.setInterval(() => {
      setLine((prev) => (prev + 1) % NARRATION.length);
    }, 4000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(words);
    };
  }, [working]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const check = (): Errors => {
    const next: Errors = {};
    const cityName = city.trim();
    const budgetNum = Number(budget);
    const daysNum = Number(days);

    if (cityName.length < 2) {
      next.city = "Name the city the route runs through.";
    }
    if (!Number.isFinite(budgetNum) || budgetNum < 1000) {
      next.budget = `At least ${CURRENCY_MARK[currency] ?? currency}${(CURRENCY_MARK[currency] ?? "").length > 1 ? " " : ""}1,000 — the trip is costed, not guessed at.`;
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
    const controller = new AbortController();
    abortRef.current = controller;
    setWorking(true);

    try {
      const response = await postItinerary(
        {
          cityName: city.trim(),
          budget: Number(budget),
          days: Number(days),
          email,
          travellers: Number(travellers) || 2,
          pace,
          travelMode,
          currency,
          interests,
          ...(startDate ? { startDate } : {}),
          ...(originCity.trim() ? { originCity: originCity.trim() } : {}),
        },
        { signal: controller.signal },
      );
      storeResult(response);
      router.push("/result");
    } catch (error) {
      if (controller.signal.aborted) {
        setWorking(false);
        return;
      }
      if (error instanceof PlanRequestError && error.status === 400) {
        const said = error.details
          .map((detail) => detail.message)
          .filter(Boolean)
          .join(" ");
        setRefusal(
          said ||
            "The planner refused those entries. Adjust them and issue again.",
        );
      } else {
        setRefusal(
          "The route could not be worked out. Nothing was changed — issue it again.",
        );
      }
      setWorking(false);
    }
  };

  const blank = (field: FieldName) =>
    Boolean(errors[field]) &&
    `${field === "city" ? city : field === "budget" ? budget : days}`.trim() ===
      "";

  const described = (field: FieldName) =>
    `mx-plan-${field}-hint${errors[field] ? ` mx-plan-${field}-error` : ""}`;

  const daysNum = Number(days);
  const planRef = `TT/ROUTE · ${Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 60 ? String(daysNum).padStart(2, "0") : "—"} DAYS`;
  const showPlate = photo && !photoGone;

  if (working) {
    return (
      <div className="mx-plan-side" role="status" aria-live="polite">
        <div className="mx-plan-side-spine" aria-hidden="true">
          <span className="mx-plan-spine-side">SIDE A</span>
          <span className="mx-plan-spine-title">
            TRIPTRIBE{(city.trim() ? ` — ${city.trim().toUpperCase()}` : "")}
          </span>
          <span className="mx-plan-spine-ref">{planRef}</span>
          <span className="mx-plan-spine-stripe" />
        </div>
        <div className="mx-plan-side-body">
          <p className="mx-plan-side-city">
            {city.trim() ? `${city.trim()} on one tape.` : "Dubbing the trip."}
          </p>
          <div className="mx-plan-cassette" aria-hidden="true">
            <span className="mx-plan-spool mx-plan-spool-left mx-plan-spool-spin" />
            <span className="mx-plan-spool mx-plan-spool-right" />
          </div>
          <p className="mx-plan-tape">{`${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`}</p>
          <p className="mx-plan-narration">
            {(() => {
              const n = Number.isInteger(daysNum) && daysNum >= 1 ? daysNum : null;
              const text =
                NARRATION[line % NARRATION.length] ??
                "The planner is working the route.";
              return text.replace("N days", n ? `${n} days` : "the days");
            })()}
          </p>
          <p className="mx-plan-side-note">
            Nothing is booked for you. The wallet is worked out from these three entries and the costs on it are estimates.
          </p>
          <button
            type="button"
            className="mx-plan-abort"
            onClick={() => abortRef.current?.abort()}
          >
            Abort
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-plan-wrap">
      <div className="mx-plan-spine" aria-hidden="true">
        <span className="mx-plan-spine-side">SIDE A</span>
        <span className="mx-plan-spine-title">
          TRIPTRIBE{(city.trim() ? ` — ${city.trim().toUpperCase()}` : "")}
        </span>
        <span className="mx-plan-spine-ref">{planRef}</span>
        <span className="mx-plan-spine-stripe" />
      </div>

      <div className="mx-plan-main">
        <div className="mx-plan-folio" aria-hidden="true">
          <span>TT / Booking counter</span>
          <span>Three entries · one wallet</span>
        </div>
        <h1 className="mx-plan-title">
          {city.trim() ? (
            <>
              {city.trim()} on <em>one tape.</em>
            </>
          ) : (
            <>
              The trip on <em>one tape.</em>
            </>
          )}
        </h1>
        <p className="mx-plan-lede">
          Three entries in, one wallet out. The carry list below ships with the case.
        </p>

        <div className="mx-plan-dest">
          {showPlate && (
            <img
              className="mx-plan-dest-pin"
              src={photo}
              alt={`${city.trim()}, in photographs`}
              loading="lazy"
              onError={() => setPhotoGone(true)}
            />
          )}
          {city.trim() ? (
            <span>
              <span className="mx-plan-dest-name">{city.trim()}</span>
              <span className="mx-plan-dest-cap">Destination survey</span>
            </span>
          ) : (
            <span className="mx-plan-dest-empty">
              The picked city lands here, with its photo pin.
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate aria-labelledby="mx-plan-title">
          <ol className="mx-plan-entries">
            <li className="mx-plan-row">
              <label htmlFor="mx-plan-city">The city is</label>
              <input
                id="mx-plan-city"
                ref={cityRef}
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
              <p className="mx-plan-hint" id="mx-plan-city-hint">
                Start typing; suggestions appear as you go.
              </p>
              {errors.city && (
                <p
                  className="mx-plan-error"
                  id="mx-plan-city-error"
                  data-missing={blank("city")}
                >
                  {errors.city}
                </p>
              )}
            </li>

            <li className="mx-plan-row">
              <label htmlFor="mx-plan-budget">The trip costs under</label>
              <div className="mx-plan-affix">
                <span className="mx-plan-mark" aria-hidden="true">
                  {CURRENCY_MARK[currency] ?? currency}
                </span>
                <input
                  id="mx-plan-budget"
                  ref={budgetRef}
                  className="mx-plan-fig"
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
              <p className="mx-plan-hint" id="mx-plan-budget-hint">
                {CURRENCY_PLURAL[currency] ?? currency}, for the whole trip and everyone on it — not per day. Min 1,000 · step 100.
              </p>
              {errors.budget && (
                <p
                  className="mx-plan-error"
                  id="mx-plan-budget-error"
                  data-missing={blank("budget")}
                >
                  {errors.budget}
                </p>
              )}
            </li>

            <li className="mx-plan-row">
              <label htmlFor="mx-plan-days">You have</label>
              <div className="mx-plan-affix">
                <input
                  id="mx-plan-days"
                  ref={daysRef}
                  className="mx-plan-fig"
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
                <span className="mx-plan-unit">days, the whole trip</span>
              </div>
              <p className="mx-plan-hint" id="mx-plan-days-hint">
                Calendar days, 1 to 60. The route is sequenced across every one of
                them.
              </p>
              {errors.days && (
                <p
                  className="mx-plan-error"
                  id="mx-plan-days-error"
                  data-missing={blank("days")}
                >
                  {errors.days}
                </p>
              )}
            </li>
          </ol>

          <section className="mx-plan-cond" aria-labelledby="mx-plan-cond-title">
            <h2 className="mx-plan-cond-title" id="mx-plan-cond-title">
              Conditions of travel
            </h2>
            <p className="mx-plan-cond-note">
              Optional. Each one changes the route it produces.
            </p>

            <div className="mx-plan-cond-grid">
              <div className="mx-plan-cond-cell">
                <label htmlFor="mx-plan-travellers">Travelling</label>
                <input
                  id="mx-plan-travellers"
                  className="mx-plan-fig"
                  type="text"
                  inputMode="numeric"
                  placeholder="2"
                  value={travellers}
                  onChange={(event) => setTravellers(event.target.value)}
                />
                <p className="mx-plan-cell-hint">How many share the budget.</p>
              </div>

              <div className="mx-plan-cond-cell">
                <label htmlFor="mx-plan-pace">Pace</label>
                <select
                  id="mx-plan-pace"
                  value={pace}
                  onChange={(event) =>
                    setPace(
                      event.target.value as (typeof PACES)[number]["value"],
                    )
                  }
                >
                  {PACES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mx-plan-cell-hint">
                  Stops the route fits in a day.
                </p>
              </div>

              <div className="mx-plan-cond-cell">
                <label htmlFor="mx-plan-mode">Getting about</label>
                <select
                  id="mx-plan-mode"
                  value={travelMode}
                  onChange={(event) =>
                    setTravelMode(
                      event.target
                        .value as (typeof TRAVEL_MODES)[number]["value"],
                    )
                  }
                >
                  {TRAVEL_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mx-plan-cell-hint">Sets every travel estimate.</p>
              </div>

              <div className="mx-plan-cond-cell">
                <label htmlFor="mx-plan-currency">Costed in</label>
                <select
                  id="mx-plan-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {CURRENCIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mx-plan-cell-hint">
                  The budget entry above is read in this currency.
                </p>
              </div>

              <div className="mx-plan-cond-cell">
                <label htmlFor="mx-plan-start-date">Leaving on</label>
                <input
                  id="mx-plan-start-date"
                  className="mx-plan-fig"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
                <p className="mx-plan-cell-hint">
                  Decides which days are weekdays. Leave blank for today.
                </p>
              </div>

              <div className="mx-plan-cond-cell">
                <label htmlFor="mx-plan-origin">Coming from</label>
                <input
                  id="mx-plan-origin"
                  type="text"
                  autoComplete="off"
                  placeholder="Delhi"
                  value={originCity}
                  onChange={(event) => setOriginCity(event.target.value)}
                />
                <p className="mx-plan-cell-hint">
                  Optional. Shapes day one only.
                </p>
              </div>
            </div>

            <fieldset className="mx-plan-interests">
              <legend className="mx-plan-cond-legend">Drawn to</legend>
              <div className="mx-plan-chips">
                {INTERESTS.map((interest) => {
                  const on = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      className="mx-plan-chip"
                      aria-pressed={on}
                      data-on={on || undefined}
                      onClick={() =>
                        setInterests((prev) =>
                          on
                            ? prev.filter((x) => x !== interest)
                            : [...prev, interest],
                        )
                      }
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          {refusal && (
            <p className="mx-plan-refusal" role="alert">
              {refusal}
            </p>
          )}

          <div className="mx-plan-run">
            <p className="mx-plan-note">
              Nothing is booked for you. The wallet is worked out from these three entries and the costs on it are estimates. Stay stubs link out to live prices; TripTribe may earn a fee on those links — labelled as such on the wallet.
            </p>
            <button className="mx-plan-dub" type="submit">
              Dub this trip
              <IconArrow />
            </button>
          </div>
        </form>

        <aside className="mx-plan-carry" aria-labelledby="mx-plan-carry-title">
          <h2 className="mx-plan-carry-title" id="mx-plan-carry-title">
            What it carries
          </h2>
          <ul className="mx-plan-carry-list">
            {CARRIED.map((item) => (
              <li key={item.id}>{item.body}</li>
            ))}
          </ul>
          <p className="mx-plan-carry-foot">
            Three entries in, one sheet out. Nothing else is asked of you.
          </p>
        </aside>
      </div>
    </div>
  );
}
