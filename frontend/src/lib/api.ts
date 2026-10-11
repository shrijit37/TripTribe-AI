/**
 * The one place the app talks to its own backend.
 *
 * `/api/*` is same-origin: nginx (or `next.config.ts` rewrites, or the dev
 * proxy) forwards it to Express, which mounts the same prefix. Nothing here
 * names a host, so the same code works locally, in the swarm, and in a
 * container.
 */
import type {
  CityImageResponse,
  PlanErrorDetail,
  PlanPayload,
  PlanRequest,
  TripsApiRecord,
} from "./types";

const ITENARY = process.env.NEXT_PUBLIC_ITENARY_API_URL ?? "/api/itenary";

/**
 * A 400 names the offending fields; anything else is not the user's input and
 * must not be described as though it were. So the caller gets the detail list
 * when there is one and a generic failure otherwise — the Result and Search
 * pages both branch on this.
 */
export class PlanRequestError extends Error {
  readonly status: number;
  readonly details: PlanErrorDetail[];

  constructor(status: number, message: string, details: PlanErrorDetail[] = []) {
    super(message);
    this.name = "PlanRequestError";
    this.status = status;
    this.details = details;
  }
}

export async function postItinerary(input: PlanRequest): Promise<PlanPayload> {
  const res = await fetch(ITENARY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // The body is best-effort: a 502 from the proxy has no JSON at all, and
    // reading it must not turn one failure into another.
    const body = (await res.json().catch(() => null)) as
      | { message?: string; details?: PlanErrorDetail[] }
      | null;
    throw new PlanRequestError(
      res.status,
      body?.message ?? "Itinerary request failed",
      Array.isArray(body?.details) ? body.details : [],
    );
  }

  return (await res.json()) as PlanPayload;
}

const FALLBACK_IMAGE = "https://picsum.photos/1920/1080?grayscale&random=2";

/**
 * The city photograph. Falls back to the same placeholder the Result page has
 * always used when Custom Search has nothing usable — an image is decoration
 * here, so a miss must not take the page down with it.
 */
export async function fetchCityImage(query: string): Promise<string> {
  try {
    const res = await fetch(
      `${ITENARY}/city-image?query=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return FALLBACK_IMAGE;
    const data = (await res.json()) as CityImageResponse;
    const link = data.items?.[1]?.link ?? data.items?.[0]?.link;
    return link ? `${ITENARY}/proxy-image?url=${encodeURIComponent(link)}` : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

export { FALLBACK_IMAGE };

/** The authenticated trip history. Returns `null` when the call fails. */
export async function fetchTrips(): Promise<TripsApiRecord[] | null> {
  try {
    const res = await fetch(`${ITENARY}/all`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as TripsApiRecord[]) : [];
  } catch {
    return null;
  }
}