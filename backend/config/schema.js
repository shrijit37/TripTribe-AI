/**
 * The itinerary *request* contract — what a caller is allowed to ask for.
 *
 * Enforced before any money is spent: the solver is only ever handed a request
 * that has already been normalised and bounded here. This module used to also
 * carry the LLM *response* contract (a json_schema plus a validator). That
 * machinery was deleted when the solver became the source of truth for the
 * plan — the model now only writes prose on top of computed facts, so nothing
 * generated is validated against a schema any more.
 *
 * Bounds are shared with the frontend so the form and the API agree. The
 * frontend is not trusted to have run them — a hand-rolled curl bypasses it
 * entirely.
 */

// Bounds shared with the frontend so the form and the API agree. The frontend
// is not trusted to have run them — a hand-rolled curl bypasses it entirely.
export const REQUEST_LIMITS = {
    MIN_DAYS: 1,
    MAX_DAYS: 60,
    MIN_BUDGET: 1000,
    MAX_BUDGET: 100_000_000,
    MAX_CITY_LENGTH: 120,
    MIN_TRAVELLERS: 1,
    MAX_TRAVELLERS: 40,
    MAX_INTERESTS: 12,
    MAX_INTEREST_LENGTH: 40,
};

// ── Planning inputs that change the plan, not just its prose ──────────────

// Pace sets how many stops a day can physically hold, so it is a solver
// parameter rather than a description. RELAXED and PACKED differ by more than
// prose: they change the daily stop budget and minutes the optimiser works to.
export const PACES = Object.freeze({
    RELAXED: { stopsPerDay: 3, minutesPerDay: 420, label: "Relaxed" },
    BALANCED: { stopsPerDay: 4, minutesPerDay: 540, label: "Balanced" },
    PACKED: { stopsPerDay: 6, minutesPerDay: 660, label: "Packed" },
});

// Decides the Routes `travelMode`, and therefore whether a 6 km hop is a taxi
// fare or a walk. Chosen by the traveller because a day's cost and its hours
// both follow from it.
export const TRAVEL_MODES = Object.freeze({
    WALK: "Walk",
    TRANSIT: "Public transport",
    DRIVE: "Taxi or car",
});

// Offered as suggestions, not as a whitelist: free text is still accepted,
// because a fixed list would exclude the reason someone is going.
export const INTEREST_PRESETS = Object.freeze([
    "History", "Architecture", "Art and museums", "Food and street food",
    "Nature and parks", "Views and photography", "Shopping",
    "Nightlife", "Local culture", "Religious sites", "Family friendly",
    "Beaches", "Hiking", "Live music",
]);

// `startDate` is accepted in any form a person would type. Stored normalised to
// `YYYY-MM-DD` so the solver's weekday and season maths never has to parse.
export const START_DATE_FORMATS = Object.freeze({
    ISO: /^(\d{4})-(\d{2})-(\d{2})$/,
    SLASHED_DMY: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    DASHED_DMY: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
});

// A date is only useful if it is plausible: not 70 years past, not a leap day
// that does not exist, not beyond the day an itinerary could still be booked.
const MAX_PAST_YEARS = 1;
const MAX_FUTURE_DAYS = 730;

// ── Request contract ──────────────────────────────────────────────────────

const error = (path, message) => ({ path, message });

/**
 * Normalise a typed date to `YYYY-MM-DD`, or return null if it is not a real
 * calendar date.
 *
 * Accepts the three forms a person actually types. `DD/MM/YYYY` is tried
 * first rather than `MM/DD/YYYY`: outside the US the day-first reading is the
 * intended one, and a silent swap would move a trip by months. A value where
 * both readings are valid (03/04) is genuinely ambiguous — the caller cannot
 * resolve it here, so it is reported rather than guessed.
 */
const isRealDate = (y, m, d) => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const probe = new Date(Date.UTC(y, m - 1, d));
    // Round-tripping catches 31 April and 29 February in a common year.
    return (
        probe.getUTCFullYear() === y &&
        probe.getUTCMonth() === m - 1 &&
        probe.getUTCDate() === d
    );
};

const pad = (n) => String(n).padStart(2, "0");

export const normaliseStartDate = (value, { now = new Date() } = {}) => {
    if (typeof value !== "string" || value.trim() === "") {
        return { ok: false, reason: "empty" };
    }
    const text = value.trim();

    let y;
    let m;
    let d;

    const iso = text.match(START_DATE_FORMATS.ISO);
    if (iso) {
        [, y, m, d] = iso.map(Number);
    } else {
        const slashed = text.match(START_DATE_FORMATS.SLASHED_DMY) ?? text.match(START_DATE_FORMATS.DASHED_DMY);
        if (!slashed) {
            return { ok: false, reason: "unparseable" };
        }
        const first = Number(slashed[1]);
        const second = Number(slashed[2]);
        y = Number(slashed[3]);

        // Both readings valid — 03/04/2026 is 3 April or 4 March. Refuse
        // rather than pick: being wrong here silently shifts every weekday,
        // season and opening-hour decision downstream.
        const firstIsDay = first > 12;
        const secondIsDay = second > 12;
        if (!firstIsDay && !secondIsDay) {
            return { ok: false, reason: "ambiguous" };
        }
        if (firstIsDay) {
            d = first;
            m = second;
        } else {
            m = first;
            d = second;
        }
    }

    if (!isRealDate(y, m, d)) {
        return { ok: false, reason: "not_a_real_date" };
    }

    // Plausibility: a trip planned for last year, or three years out, is a
    // typo rather than an intention.
    const candidate = new Date(Date.UTC(y, m - 1, d));
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const daysFromToday = Math.round((candidate.getTime() - todayUtc) / 86_400_000);

    if (daysFromToday < -365 * MAX_PAST_YEARS) {
        return { ok: false, reason: "too_far_past" };
    }
    if (daysFromToday > MAX_FUTURE_DAYS) {
        return { ok: false, reason: "too_far_future" };
    }

    return { ok: true, value: `${y}-${pad(m)}-${pad(d)}`, daysFromToday };
};

/** Free-text tag: trimmed, length-bounded, duplicates collapsed. */
const normaliseInterests = (raw) => {
    if (raw === undefined || raw === null) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        if (typeof item !== "string") continue;
        const text = item.trim();
        if (!text) continue;
        if (text.length > REQUEST_LIMITS.MAX_INTEREST_LENGTH) {
            return { error: `Each interest must be under ${REQUEST_LIMITS.MAX_INTEREST_LENGTH} characters.` };
        }
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
    }
    if (out.length > REQUEST_LIMITS.MAX_INTERESTS) {
        return { error: `At most ${REQUEST_LIMITS.MAX_INTERESTS} interests.` };
    }
    return out;
};

/**
 * Validate and normalise a generation request.
 *
 * Returns `{ ok: true, value }` or `{ ok: false, errors }` — never throws, so
 * the route can answer 400 with something a form can render.
 */
export const parsePlanRequest = (body, { now } = {}) => {
    const errors = [];
    const raw = body && typeof body === "object" ? body : {};

    const cityName = typeof raw.cityName === "string" ? raw.cityName.trim() : "";
    if (!cityName) {
        errors.push(error("cityName", "City is required."));
    } else if (cityName.length > REQUEST_LIMITS.MAX_CITY_LENGTH) {
        errors.push(error("cityName", `City must be under ${REQUEST_LIMITS.MAX_CITY_LENGTH} characters.`));
    }

    const days = Number(raw.days);
    if (!Number.isInteger(days) || days < REQUEST_LIMITS.MIN_DAYS || days > REQUEST_LIMITS.MAX_DAYS) {
        errors.push(error("days", `Days must be a whole number between ${REQUEST_LIMITS.MIN_DAYS} and ${REQUEST_LIMITS.MAX_DAYS}.`));
    }

    const budget = Number(raw.budget);
    if (!Number.isFinite(budget) || budget < REQUEST_LIMITS.MIN_BUDGET || budget > REQUEST_LIMITS.MAX_BUDGET) {
        errors.push(error("budget", `Budget must be between ${REQUEST_LIMITS.MIN_BUDGET} and ${REQUEST_LIMITS.MAX_BUDGET}.`));
    }

    // Blank is legal: generation works signed-out (see PRODUCT.md). Only a
    // present-but-unusable value is a problem.
    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(error("email", "Email is not a valid address."));
    }

    // ── Origin ───────────────────────────────────────────────────────────
    // Optional, but when present it is geocoded into real coordinates so the
    // intercity leg and the "how to reach" section are computed rather than
    // guessed. Equal to the destination means a local trip — legitimate, and
    // not an error, so it is recorded rather than rejected.
    let originCity = "";
    if (typeof raw.originCity === "string" && raw.originCity.trim()) {
        originCity = raw.originCity.trim();
        if (originCity.length > REQUEST_LIMITS.MAX_CITY_LENGTH) {
            errors.push(error("originCity", `Origin must be under ${REQUEST_LIMITS.MAX_CITY_LENGTH} characters.`));
        }
    }

    // ── Start date ───────────────────────────────────────────────────────
    // Optional; absent means "any time of year" and the plan carries no
    // weekday-dependent choices. Present and unparseable is an error, because
    // silently dropping it would quietly discard every season decision.
    let startDate = null;
    let startDateOffset = null;
    if (raw.startDate !== undefined && raw.startDate !== null && String(raw.startDate).trim() !== "") {
        const parsed = normaliseStartDate(raw.startDate, { now });
        if (!parsed.ok) {
            const message = {
                unparseable: "Start date must look like 2026-04-12, 12/04/2026 or 12-04-2026.",
                ambiguous: "That date reads the same either way. Write the year first, for example 2026-04-12.",
                not_a_real_date: "That date does not exist. Check the day and month.",
                too_far_past: "Start date cannot be in the past.",
                too_far_future: "Start date cannot be more than two years ahead.",
                empty: "Start date is not a valid date.",
            }[parsed.reason] ?? "Start date is not a valid date.";
            errors.push(error("startDate", message));
        } else {
            startDate = parsed.value;
            startDateOffset = parsed.daysFromToday;
        }
    }

    // ── Travellers ───────────────────────────────────────────────────────
    // Drives every cost calculation. Absent defaults to 2, which is the
    // product's stated audience (a couple or group) rather than a solo
    // default that would understate a shared trip.
    let travellers = 2;
    if (raw.travellers !== undefined && raw.travellers !== null && raw.travellers !== "") {
        const parsed = Number(raw.travellers);
        if (!Number.isInteger(parsed) || parsed < REQUEST_LIMITS.MIN_TRAVELLERS || parsed > REQUEST_LIMITS.MAX_TRAVELLERS) {
            errors.push(error("travellers", `Travellers must be a whole number between ${REQUEST_LIMITS.MIN_TRAVELLERS} and ${REQUEST_LIMITS.MAX_TRAVELLERS}.`));
        } else {
            travellers = parsed;
        }
    }

    // ── Pace ─────────────────────────────────────────────────────────────
    // Case-insensitive; unknown values fall back to BALANCED rather than
    // failing the whole request, since pace has a sensible default and a typo
    // should not cost the user their trip.
    let pace = "BALANCED";
    if (typeof raw.pace === "string" && raw.pace.trim()) {
        const wanted = raw.pace.trim().toUpperCase();
        if (wanted in PACES) {
            pace = wanted;
        }
    }

    // ── Travel mode ──────────────────────────────────────────────────────
    let travelMode = "TRANSIT";
    if (typeof raw.travelMode === "string" && raw.travelMode.trim()) {
        const wanted = raw.travelMode.trim().toUpperCase();
        if (wanted in TRAVEL_MODES) {
            travelMode = wanted;
        }
    }

    // ── Interests ────────────────────────────────────────────────────────
    const interests = normaliseInterests(raw.interests);
    if (!Array.isArray(interests)) {
        errors.push(error("interests", interests.error));
    }

    if (errors.length) return { ok: false, errors };

    return {
        ok: true,
        value: {
            cityName,
            days,
            budget,
            email,
            originCity,
            startDate,
            startDateOffset,
            travellers,
            pace,
            travelMode,
            interests,
            // Derived once so the solver and the prompt cannot disagree about
            // how long a day is meant to last.
            paceSettings: PACES[pace],
            isLocalTrip: originCity.length > 0 && originCity.toLowerCase() === cityName.toLowerCase(),
        },
    };
};

