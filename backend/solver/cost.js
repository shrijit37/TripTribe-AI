/**
 * Cost the trip in code.
 *
 * Every number here is derived from grounded data — Google's `priceLevel`,
 * measured `distanceMeters` from Routes, and the traveller's own headcount.
 * **Nothing is asked of the model.** It is given a budget and writes prose; it
 * never produces a price.
 *
 * This matters for more than accuracy. The existing result page hardcoded
 * `distance = 380; tolls = 480` and displayed the sum, so every city showed the
 * same fake road-trip cost. That is the failure mode this module exists to
 * eliminate: a wrong number on a document someone hands to other people costs
 * more than no number at all.
 *
 * `priceLevel` is Google's four-band qualitative enum (0 free … 4 expensive),
 * not a currency amount. Band midpoints are converted through a per-currency
 * purchasing-power factor, so the result is an **estimate** and is labelled as
 * one everywhere it is surfaced (see PRODUCT.md: hotel prices "are model
 * estimates… not a price guarantee").
 */

/**
 * Indicative spend per person per band, in USD.
 *
 * Midpoints of Google's bands, deliberately conservative. Lodging is per night,
 * meals per sitting, activities per entry — the caller multiplies by the right
 * one, so these are per-occasion figures, not daily totals.
 */
const BAND_USD = Object.freeze({
    // Per room per night. Bands 1–4 are real hotels; band 0 is hostel/guesthouse.
    lodging: [6, 14, 32, 78, 170],
    // Per person per sitting.
    meal: [2, 5, 11, 22, 45],
    // Per person per entry.
    activity: [0, 8, 17, 35, 70],
    transit_ride: [0, 0.6, 1.2, 2.5, 5],
});

/**
 * Rough purchasing-power factor relative to the US dollar, for converting a
 * USD-band figure into local currency.
 *
 * A coarse table on purpose. The point is to land within an order of magnitude
 * for the currency, not to model exchange rates — anything more precise would
 * be false accuracy on an explicitly-labelled estimate.
 */
const CURRENCY_FACTOR = Object.freeze({
    INR: 83, USD: 1, EUR: 0.92, GBP: 0.79, JPY: 157, CNY: 7.2, KRW: 1380,
    THB: 36, SGD: 1.35, AUD: 1.52, CAD: 1.37, NZD: 1.66, AED: 3.67,
    BRL: 5.4, MXN: 17.1, ZAR: 18.4, TRY: 32, SEK: 10.5, NOK: 10.8,
    DKK: 6.9, CHF: 0.89, PLN: 4.0, IDR: 15800, MYR: 4.7, PHP: 56,
    VND: 25000, TWD: 31.5, HKD: 7.8, SAR: 3.75, QAR: 3.64, MAD: 9.9,
});

/** Currencies outside the table fall back to this rather than guessing wildly. */
const DEFAULT_FACTOR = 60;

const clampBand = (band) => {
    if (typeof band !== "number" || !Number.isFinite(band)) return 2; // unknown → mid
    return Math.min(4, Math.max(0, Math.round(band)));
};

/**
 * Read a currency code out of the free-text `city.Currency` string.
 *
 * The model returns values like "INR (₹)" or "Japanese Yen (JPY)". Matching
 * on the code first, then a small alias table, keeps this robust to phrasing
 * without asking the model to normalise it.
 */
export const parseCurrencyCode = (raw) => {
    if (typeof raw !== "string") return null;
    const text = raw.toUpperCase();

    const code = text.match(/\b([A-Z]{3})\b/);
    if (code && CURRENCY_FACTOR[code[1]]) return code[1];

    const aliases = {
        RUPEE: "INR", RUPEES: "INR", "₹": "INR",
        DOLLAR: "USD", DOLLARS: "USD", "$": "USD",
        EURO: "EUR", "€": "EUR",
        POUND: "GBP", POUNDS: "GBP", "£": "GBP",
        YEN: "JPY", "¥": "JPY",
        WON: "KRW", "₩": "KRW",
        REAL: "BRL", REAIS: "BRL",
        DIRHAM: "AED", RIYAL: "SAR",
        FRANC: "CHF",
    };

    for (const [needle, code_] of Object.entries(aliases)) {
        if (text.includes(needle)) return code_;
    }

    return null;
};

export const currencyFactor = (currency) => CURRENCY_FACTOR[currency] ?? DEFAULT_FACTOR;

/**
 * Cost of one occasion for one person.
 *
 * A place with no `priceLevel` is priced at band 2 — mid. Band 0 would make an
 * unrated place look free and band 4 would make it look exclusive; neither is
 * evidence.
 */
export const occasionCostUsd = (kind, place) => clampBand(place?.priceLevel);

/** Band midpoint in USD for a category and price level. */
export const bandUsd = (kind, place) => {
    const table = BAND_USD[kind];
    if (!table) return 0;
    return table[clampBand(place?.priceLevel)];
};

/**
 * Local-currency cost for one occasion for `headcount` people.
 */
export const occasionCost = (kind, place, { headcount = 1, currency = "USD" } = {}) => {
    const usd = bandUsd(kind, place) * Math.max(1, headcount);
    return usd * currencyFactor(currency);
};

/**
 * Per-kilometre cost for a whole journey leg.
 *
 * Local transport is the one line the model cannot invent at all: it is the
 * measured distance from Routes multiplied by a per-km rate. `kmPerLitre` and
 * `pricePerLitre` are the traveller's own inputs — the old page asked for them
 * and then ignored both, hardcoding 380 km and 480 in tolls.
 */
export const transportCost = (meters, { mode = "TRANSIT", headcount = 1, currency = "USD", fuel = null } = {}) => {
    if (!Number.isFinite(meters) || meters <= 0) return 0;

    const km = meters / 1000;

    if (mode === "DRIVE" && fuel?.kmPerLitre > 0 && fuel?.pricePerLitre > 0) {
        // Distance is round-trip: you drive to the city and back.
        const litres = (km * 2) / fuel.kmPerLitre;
        const fuelCost = litres * fuel.pricePerLitre * Math.max(1, headcount);
        // Indicative tolls, scaled by distance — not a fixed 480.
        const tolls = Math.max(0, (km * 2 - 15)) * 2.4;
        return fuelCost + tolls * currencyFactor(currency);
    }

    // Walking and transit are priced per boarding, not per kilometre.
    const band = mode === "WALK" ? 0 : clampBand(1 + (mode === "TRANSIT" ? 0 : 1));
    const perBoarding = BAND_USD.transit_ride[band] * currencyFactor(currency);
    // One boarding per ~5 km is a conservative average for city transit.
    const boardings = Math.max(1, Math.ceil(km / 5));
    return perBoarding * boardings * Math.max(1, headcount);
};

/**
 * Lodging for the whole trip.
 *
 * Nightly rate × `max(1, days - 1)`: a traveller has a bed on every night
 * except the one they leave. The old code multiplied nights by days.
 */
export const lodgingCost = (hotel, { days, headcount = 1, currency = "USD", rooms = null } = {}) => {
    if (!hotel) return 0;

    const nights = Math.max(1, (days ?? 1) - 1);
    const occupancy = rooms ?? Math.max(1, Math.ceil(headcount / 2));
    // Two people share a room, so the rate is per room not per person.
    return bandUsd("lodging", hotel) * nights * occupancy * currencyFactor(currency);
};

/**
 * Meals for the whole trip.
 *
 * Three meals a day, every day. Breakfast is assumed cheaper than dinner, which
 * is true almost everywhere.
 */
export const mealsCost = (placesByType, { days, headcount = 1, currency = "USD" } = {}) => {
    const { breakfast = [], lunch = [], dinner = [] } = placesByType ?? {};
    const pick = (list) => (Array.isArray(list) && list.length > 0 ? list[0] : null);

    const b = pick(breakfast) ?? pick(lunch);
    const l = pick(lunch) ?? pick(dinner);
    const d = pick(dinner) ?? pick(lunch);

    const perDay =
        occasionCost("meal", b, { headcount, currency }) +
        occasionCost("meal", l, { headcount, currency }) +
        occasionCost("meal", d, { headcount, currency });

    return perDay * Math.max(1, days ?? 1);
};

/**
 * Activities for the whole trip.
 */
export const activitiesCost = (activities, { headcount = 1, currency = "USD" } = {}) => {
    if (!Array.isArray(activities)) return 0;
    return activities.reduce(
        (sum, place) => sum + occasionCost("activity", place, { headcount, currency }),
        0
    );
};

/**
 * Assemble the full trip cost and judge it against the stated budget.
 *
 * `feasible` is the product's central promise made checkable: when the budget
 * cannot cover the trip, say so plainly rather than quietly returning something
 * unaffordable (PRODUCT.md principle 2). `shortfall` is what is missing, and
 * `suggestions` names the levers that actually close it — driven by where the
 * money actually goes, not boilerplate.
 */
export const costTrip = ({
    days,
    budget,
    currency = "USD",
    headcount = 1,
    hotel = null,
    activities = [],
    meals = {},
    totalMeters = 0,
    travelMode = "TRANSIT",
    fuel = null,
    rooms = null,
}) => {
    const lodging = lodgingCost(hotel, { days, headcount, currency, rooms });
    const meals_ = mealsCost(meals, { days, headcount, currency });
    const acts = activitiesCost(activities, { headcount, currency });
    const transport = transportCost(totalMeters, { mode: travelMode, headcount, currency, fuel });

    const total = lodging + meals_ + acts + transport;
    const perDay = total / Math.max(1, days);
    const perPersonPerDay = total / Math.max(1, days * headcount);

    const feasible = Number.isFinite(budget) ? total <= budget : true;
    const shortfall = feasible ? 0 : Math.max(0, total - budget);

    // Rank the levers by what they would actually save.
    const suggestions = [];
    if (!feasible) {
        if (lodging > total * 0.35) {
            suggestions.push("Staying at a lower price tier would be the single biggest saving.");
        }
        if (meals_ > total * 0.35) {
            suggestions.push("Mixing cheaper meals into the day, especially dinner, would cut the food line noticeably.");
        }
        if (transport > total * 0.2) {
            suggestions.push("Using public transport or walking between nearby stops would reduce the transport line.");
        }
        if (activities > total * 0.2) {
            suggestions.push("Dropping one or two paid attractions would close part of the gap.");
        }
        if (suggestions.length === 0) {
            suggestions.push("Shortening the trip by a day is the surest way to bring it within budget.");
        }
    }

    return {
        currency,
        headcount,
        days,
        total: Math.round(total),
        perDay: Math.round(perDay),
        perPersonPerDay: Math.round(perPersonPerDay),
        breakdown: {
            accommodation: Math.round(lodging),
            meals: Math.round(meals_),
            activities: Math.round(acts),
            transportation: Math.round(transport),
        },
        // Every figure above is derived, never generated. The flag travels with
        // the numbers so no surface can present an estimate as a quote.
        isEstimate: true,
        budget: Number.isFinite(budget) ? Math.round(budget) : null,
        feasible,
        shortfall: Math.round(shortfall),
        suggestions,
    };
};

export { BAND_USD, CURRENCY_FACTOR, DEFAULT_FACTOR };