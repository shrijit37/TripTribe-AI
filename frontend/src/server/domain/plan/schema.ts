import "server-only";

/**
 * The itinerary *request* contract — what a caller is allowed to ask for.
 * Ported from `backend/config/schema.js` with every bound, default and error
 * string unchanged, plus one addition: `currency`.
 *
 * The old contract validated `travellers`, `pace`, `interests`, `originCity`
 * and `startDate` and then the controller threw them away (migration bug #4).
 * Here the parsed value carries everything through, and the route handler
 * forwards it whole — there is no second place where defaults get re-decided.
 *
 * Deliberately not zod: the ambiguous-date refusal (`03/04/2026` is an error,
 * not a guess) and the per-field messages a form renders are clearer as code,
 * and the existing `schema.test.js` cases port one-to-one against this shape.
 */

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
} as const;

export const PACES = Object.freeze({
  RELAXED: { stopsPerDay: 3, minutesPerDay: 420, label: "Relaxed" },
  BALANCED: { stopsPerDay: 4, minutesPerDay: 540, label: "Balanced" },
  PACKED: { stopsPerDay: 6, minutesPerDay: 660, label: "Packed" },
});
export type PaceName = keyof typeof PACES;

export const TRAVEL_MODES = Object.freeze({
  WALK: "Walk",
  TRANSIT: "Public transport",
  DRIVE: "Taxi or car",
});
export type TravelModeName = keyof typeof TRAVEL_MODES;

export const INTEREST_PRESETS: readonly string[] = Object.freeze([
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
]);

export const START_DATE_FORMATS = Object.freeze({
  ISO: /^(\d{4})-(\d{2})-(\d{2})$/,
  SLASHED_DMY: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  DASHED_DMY: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
});

const MAX_PAST_YEARS = 1;
const MAX_FUTURE_DAYS = 730;

export interface PlanErrorDetail {
  path: string;
  message: string;
}

const error = (path: string, message: string): PlanErrorDetail => ({
  path,
  message,
});

const isRealDate = (y: number, m: number, d: number): boolean => {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d))
    return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
};

const pad = (n: number): string => String(n).padStart(2, "0");

export type StartDateFailure =
  | "empty"
  | "unparseable"
  | "ambiguous"
  | "not_a_real_date"
  | "too_far_past"
  | "too_far_future";

export const normaliseStartDate = (
  value: unknown,
  { now = new Date() }: { now?: Date } = {},
):
  | { ok: true; value: string; daysFromToday: number }
  | { ok: false; reason: StartDateFailure } => {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, reason: "empty" };
  }
  const text = value.trim();
  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;

  const iso = text.match(START_DATE_FORMATS.ISO);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const slashed =
      text.match(START_DATE_FORMATS.SLASHED_DMY) ??
      text.match(START_DATE_FORMATS.DASHED_DMY);
    if (!slashed) return { ok: false, reason: "unparseable" };
    const first = Number(slashed[1]);
    const second = Number(slashed[2]);
    y = Number(slashed[3]);
    const firstIsDay = first > 12;
    const secondIsDay = second > 12;
    if (!firstIsDay && !secondIsDay) return { ok: false, reason: "ambiguous" };
    if (firstIsDay) {
      d = first;
      m = second;
    } else {
      m = first;
      d = second;
    }
  }

  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    !isRealDate(y, m, d)
  ) {
    return { ok: false, reason: "not_a_real_date" };
  }

  const candidate = new Date(Date.UTC(y, m - 1, d));
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const daysFromToday = Math.round(
    (candidate.getTime() - todayUtc) / 86_400_000,
  );

  if (daysFromToday < -365 * MAX_PAST_YEARS)
    return { ok: false, reason: "too_far_past" };
  if (daysFromToday > MAX_FUTURE_DAYS)
    return { ok: false, reason: "too_far_future" };

  return { ok: true, value: `${y}-${pad(m)}-${pad(d)}`, daysFromToday };
};

const normaliseInterests = (raw: unknown): string[] | { error: string } => {
  if (raw === undefined || raw === null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    if (text.length > REQUEST_LIMITS.MAX_INTEREST_LENGTH) {
      return {
        error: `Each interest must be under ${REQUEST_LIMITS.MAX_INTEREST_LENGTH} characters.`,
      };
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

const normaliseCurrency = (raw: unknown): string | { error: string } => {
  if (raw === undefined || raw === null || String(raw).trim() === "")
    return "INR";
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return {
      error: "Currency must be a 3-letter code such as INR, USD or EUR.",
    };
  }
  return code;
};

export interface ParsedPlanRequest {
  cityName: string;
  days: number;
  budget: number;
  email: string;
  originCity: string;
  startDate: string | null;
  startDateOffset: number | null;
  travellers: number;
  pace: PaceName;
  travelMode: TravelModeName;
  interests: string[];
  currency: string;
  paceSettings: (typeof PACES)[PaceName];
  isLocalTrip: boolean;
}

export type ParseResult =
  | { ok: true; value: ParsedPlanRequest }
  | { ok: false; errors: PlanErrorDetail[] };

/**
 * Validate and normalise a generation request.
 * Returns `{ ok: true, value }` or `{ ok: false, errors }` — never throws, so
 * the route can answer 400 with something a form can render.
 */
export const parsePlanRequest = (
  body: unknown,
  { now }: { now?: Date } = {},
): ParseResult => {
  const errors: PlanErrorDetail[] = [];
  const raw = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;

  const cityName = typeof raw.cityName === "string" ? raw.cityName.trim() : "";
  if (!cityName) {
    errors.push(error("cityName", "City is required."));
  } else if (cityName.length > REQUEST_LIMITS.MAX_CITY_LENGTH) {
    errors.push(
      error(
        "cityName",
        `City must be under ${REQUEST_LIMITS.MAX_CITY_LENGTH} characters.`,
      ),
    );
  }

  const days = Number(raw.days);
  if (
    !Number.isInteger(days) ||
    days < REQUEST_LIMITS.MIN_DAYS ||
    days > REQUEST_LIMITS.MAX_DAYS
  ) {
    errors.push(
      error(
        "days",
        `Days must be a whole number between ${REQUEST_LIMITS.MIN_DAYS} and ${REQUEST_LIMITS.MAX_DAYS}.`,
      ),
    );
  }

  const budget = Number(raw.budget);
  if (
    !Number.isFinite(budget) ||
    budget < REQUEST_LIMITS.MIN_BUDGET ||
    budget > REQUEST_LIMITS.MAX_BUDGET
  ) {
    errors.push(
      error(
        "budget",
        `Budget must be between ${REQUEST_LIMITS.MIN_BUDGET} and ${REQUEST_LIMITS.MAX_BUDGET}.`,
      ),
    );
  }

  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push(error("email", "Email is not a valid address."));
  }

  let originCity = "";
  if (typeof raw.originCity === "string" && raw.originCity.trim()) {
    originCity = raw.originCity.trim();
    if (originCity.length > REQUEST_LIMITS.MAX_CITY_LENGTH) {
      errors.push(
        error(
          "originCity",
          `Origin must be under ${REQUEST_LIMITS.MAX_CITY_LENGTH} characters.`,
        ),
      );
    }
  }

  let startDate: string | null = null;
  let startDateOffset: number | null = null;
  if (
    raw.startDate !== undefined &&
    raw.startDate !== null &&
    String(raw.startDate).trim() !== ""
  ) {
    const parsed = normaliseStartDate(raw.startDate, { now });
    if (!parsed.ok) {
      const message =
        {
          unparseable:
            "Start date must look like 2026-04-12, 12/04/2026 or 12-04-2026.",
          ambiguous:
            "That date reads the same either way. Write the year first, for example 2026-04-12.",
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

  let travellers = 2;
  if (
    raw.travellers !== undefined &&
    raw.travellers !== null &&
    raw.travellers !== ""
  ) {
    const parsed = Number(raw.travellers);
    if (
      !Number.isInteger(parsed) ||
      parsed < REQUEST_LIMITS.MIN_TRAVELLERS ||
      parsed > REQUEST_LIMITS.MAX_TRAVELLERS
    ) {
      errors.push(
        error(
          "travellers",
          `Travellers must be a whole number between ${REQUEST_LIMITS.MIN_TRAVELLERS} and ${REQUEST_LIMITS.MAX_TRAVELLERS}.`,
        ),
      );
    } else {
      travellers = parsed;
    }
  }

  let pace: PaceName = "BALANCED";
  if (typeof raw.pace === "string" && raw.pace.trim()) {
    const wanted = raw.pace.trim().toUpperCase();
    if (wanted in PACES) pace = wanted as PaceName;
  }

  let travelMode: TravelModeName = "TRANSIT";
  if (typeof raw.travelMode === "string" && raw.travelMode.trim()) {
    const wanted = raw.travelMode.trim().toUpperCase();
    if (wanted in TRAVEL_MODES) travelMode = wanted as TravelModeName;
  }

  const interests = normaliseInterests(raw.interests);
  if (!Array.isArray(interests)) {
    errors.push(error("interests", interests.error));
  }

  const currency = normaliseCurrency(raw.currency);
  if (typeof currency !== "string") {
    errors.push(error("currency", currency.error));
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
      interests: interests as string[],
      currency: currency as string,
      paceSettings: PACES[pace],
      isLocalTrip:
        originCity.length > 0 &&
        originCity.toLowerCase() === cityName.toLowerCase(),
    },
  };
};
