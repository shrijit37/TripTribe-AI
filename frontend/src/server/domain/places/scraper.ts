import "server-only";
import { timeoutMs, optional } from "@/server/env";
import type { EnrichedPlace } from "@/server/domain/places/client";

/**
 * Adapter for the self-hosted gosom/google-maps-scraper sidecar.
 *
 * It exists only as a *prewarm* source: the weekly cron scrapes each curated
 * city once, stores the rows in `placeCache`, and records the ordered
 * `placeIds` under `prewarm:<citySlug>`. When Google's per-day Places cap is
 * spent, the planner reads those snapshots instead of failing the request
 * (see `domain/places/fallback.ts`). It is never called inline on the plan
 * path — a scrape takes 45–55 s against a 15 s inline budget.
 *
 * Two gosom columns are deliberately not mapped: `status` is category-dependent
 * (a nightly rate for hotels, an editorial blurb for restaurants) so it is not
 * Google's business status; and `price_range` is absent for categories Google
 * does not price (museums, hotels), which `clampBand` already tolerates.
 */

const SCRAPER_BASE = optional("SCRAPER_BASE_URL") ?? "";

/** Off by default: without a configured sidecar URL the fallback is inert. */
export const isScraperConfigured = (): boolean => SCRAPER_BASE !== "";

const scraperBase = (): string => {
  if (!SCRAPER_BASE) throw new Error("SCRAPER_BASE_URL is not configured");
  return SCRAPER_BASE.replace(/\/$/, "");
};

// ── CSV ──────────────────────────────────────────────────────────────────────
// A minimal RFC4180 parser: quoted fields, embedded commas, doubled quotes and
// embedded newlines. gosom quotes every field, so the whole file is one record
// stream. No dependency — the rows arrive as one HTTP body, not a file stream.

export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] as string;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

/** Header row → a lookup from column name to index, for `rowToEnriched`. */
export const csvIndex = (header: string[]): Map<string, number> =>
  new Map(header.map((name, i) => [name.trim(), i]));

// ── Column mappers ───────────────────────────────────────────────────────────

/** "Restaurant" → "restaurant"; "Fast food restaurant" → "fast_food_restaurant". */
const toPrimaryType = (category: string): string =>
  category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const toRating = (raw: string): number | null => {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

const toReviewCount = (raw: string): number | null => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

/** Same shrinkage as `normalisePlace`: rating pulled toward 4.0 by volume. */
const bayesian = (rating: number | null, count: number | null): number => {
  if (rating === null || count === null) return null as unknown as number;
  return (count / (count + 25)) * rating + (25 / (count + 25)) * 4.0;
};

/** "$20–30" / "$100+" → Google's 0–4 band. Absent → null (clampBand → 2). */
export const priceBand = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const upper = Number.parseFloat(raw.replace(/[^0-9.]/g, " ").trim().split(/\s+/).pop() ?? "");
  if (!Number.isFinite(upper)) return null;
  if (upper < 10) return 1;
  if (upper <= 30) return 2;
  if (upper < 100) return 3;
  return 4;
};

/** "9 am" → 9, "12 pm" → 12, "11 pm" → 23, "12 am" → 0. 24h values pass through. */
const toHour = (part: string): number | null => {
  const m = part.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = Number.parseInt(m[1] as string, 10);
  const minute = m[2] ? Number.parseInt(m[2], 10) : 0;
  const meridiem = m[3];
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
};

/**
 * One day's display string → an open/close pair in minutes past midnight.
 * gosom shows "4–11 pm" (open inherits the closer's meridiem) or "9 am–5 pm".
 * "Closed" and anything unparsable yield null (the day gets no period).
 */
const parseDayWindow = (
  dayName: string,
  window: string,
): { day: number; open: number; close: number } | null => {
  if (/closed/i.test(window)) return null;
  const day = DAY_INDEX[dayName];
  if (day === undefined) return null;
  const parts = window.split(/[–—-]/u);
  if (parts.length < 2) return null;
  const openRaw = parts[0] as string;
  const closeRaw = parts.slice(1).join("-");
  // A bare closer like "11 pm" lets the opener inherit "pm" ("4–11 pm").
  const meridiem = (closeRaw.match(/\b(am|pm)\b/i)?.[1] ?? "").toLowerCase();
  const openText = /\b(am|pm)\b/i.test(openRaw) || !meridiem ? openRaw : `${openRaw} ${meridiem}`;
  const open = toHour(openText);
  const close = toHour(closeRaw);
  if (open === null || close === null) return null;
  return { day, open, close };
};

const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/** `{"Friday":["4–11 pm"],"Monday":["Closed"]}` → Google's `{periods:[…]}` shape. */
export const parseOpenHours = (raw: string): unknown => {
  if (!raw.trim()) return null;
  let byDay: Record<string, string[]>;
  try {
    byDay = JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return null;
  }
  const periods: { open: { day: number; hour: number; minute: number }; close: { hour: number; minute: number } }[] = [];
  for (const [dayName, windows] of Object.entries(byDay)) {
    if (!Array.isArray(windows)) continue;
    for (const window of windows) {
      const w = parseDayWindow(dayName, window);
      if (!w) continue;
      periods.push({
        open: { day: w.day, hour: Math.floor(w.open / 60), minute: w.open % 60 },
        close: { hour: Math.floor(w.close / 60), minute: w.close % 60 },
      });
    }
  }
  return periods.length > 0 ? { periods } : null;
};

/** IANA zone ("America/Chicago") → minutes to add to UTC. Null when unknown. */
export const tzToUtcOffset = (iana: string, at = new Date()): number | null => {
  if (!iana.trim()) return null;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: iana, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = dtf.formatToParts(at);
    const get = (type: string): number =>
      Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return null;
  }
};

// ── Row → EnrichedPlace ──────────────────────────────────────────────────────

const cell = (row: string[], index: Map<string, number>, key: string): string =>
  (row[index.get(key) ?? -1] ?? "").trim();

/** One CSV data row → the same `EnrichedPlace` the Places client produces. */
export const csvRowToEnriched = (
  row: string[],
  index: Map<string, number>,
): EnrichedPlace | null => {
  const placeId = cell(row, index, "place_id");
  const name = cell(row, index, "title");
  if (!placeId || !name) return null;
  const primaryType = toPrimaryType(cell(row, index, "category"));
  const rating = toRating(cell(row, index, "review_rating"));
  const reviewCount = toReviewCount(cell(row, index, "review_count"));
  const lat = Number.parseFloat(cell(row, index, "latitude"));
  const lng = Number.parseFloat(cell(row, index, "longitude"));
  return {
    id: placeId,
    placeId,
    name,
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    primaryType: primaryType || null,
    primaryTypeName: cell(row, index, "category") || null,
    types: primaryType ? [primaryType] : [],
    address: cell(row, index, "address"),
    utcOffsetMinutes: tzToUtcOffset(cell(row, index, "timezone")),
    rating,
    reviewCount,
    bayesianRating: bayesian(rating, reviewCount),
    priceLevel: priceBand(cell(row, index, "price_range")),
    regularOpeningHours: parseOpenHours(cell(row, index, "open_hours")),
    photoName: null,
    businessStatus: null,
    isOperational: true,
    vicinity: "",
    editorialSummary: cell(row, index, "descriptions") || null,
  };
};

// ── HTTP client ──────────────────────────────────────────────────────────────

interface ScrapeJob { id?: string; status?: string; error?: string }

/** Derived from `fetch` itself: naming `RequestInit` trips `no-undef`. */
type FetchInit = NonNullable<Parameters<typeof globalThis.fetch>[1]>;

const scraperFetch = async (path: string, init?: FetchInit): Promise<Response> =>
  fetch(`${scraperBase()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs("SCRAPER_TIMEOUT_MS", 120_000)),
  });

/** Submit a scrape and return its job id. */
export const submitScrape = async (body: {
  name: string; keywords: string[]; lang: string;
  zoom: number; lat: number; lon: number; radius?: number; depth?: number;
}): Promise<string> => {
  const response = await scraperFetch("/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`scraper submit failed: ${response.status}`);
  const job = (await response.json()) as ScrapeJob;
  if (!job.id) throw new Error(`scraper submit returned no job id: ${job.error ?? ""}`);
  return job.id;
};

/** Poll until the job reports finished (or the timeout aborts the fetch). */
export const waitForScrape = async (jobId: string): Promise<void> => {
  for (;;) {
    const response = await scraperFetch(`/api/v1/jobs/${jobId}`);
    if (!response.ok) throw new Error(`scraper poll failed: ${response.status}`);
    const job = (await response.json()) as ScrapeJob;
    if (job.status === "finished") return;
    if (job.status === "failed") throw new Error(`scrape failed: ${job.error ?? ""}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
};

/** Fetch the finished job's CSV and map every usable row to an EnrichedPlace. */
export const downloadScrape = async (jobId: string): Promise<EnrichedPlace[]> => {
  const response = await scraperFetch(`/api/v1/export?jobId=${jobId}&type=csv`);
  if (!response.ok) throw new Error(`scraper export failed: ${response.status}`);
  const rows = parseCsv(await response.text());
  const header = rows[0];
  if (!header) return [];
  const index = csvIndex(header);
  const places: EnrichedPlace[] = [];
  for (const row of rows.slice(1)) {
    const place = csvRowToEnriched(row, index);
    if (place) places.push(place);
  }
  return places;
};
