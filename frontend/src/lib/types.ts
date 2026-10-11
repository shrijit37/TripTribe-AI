/**
 * The wire contract of `POST /api/itenary`, as composed by
 * `backend/services/compose.js`.
 *
 * Every field here is consumed by a render path, so the shapes are declared
 * once and imported everywhere. Anything the backend can omit is optional
 * here, and anything it always sends is not — the type is a description of the
 * real response, not a guess at one.
 */

/** One place, named, with the narration the model wrote about it. */
export interface NamedPlace {
  place: string;
  description: string;
  placeId?: string;
  arriveAt?: number | null;
  departAt?: number | null;
  waitMinutes?: number;
  openedAfterWait?: boolean;
}

/**
 * A meal slot. The solver seats breakfast/lunch/dinner where they fit the
 * day's hours, and sends `null` when nothing nearby does — an honest gap
 * rather than an invented venue, so `null` is a first-class case here.
 */
export type MealSlot = NamedPlace | null;

export type MealName = "breakfast" | "lunch" | "dinner";

export interface ItineraryDay {
  day: number;
  /** Empty when the solver could not place the day on a calendar. */
  weekday: string;
  activities: NamedPlace[];
  meals: Record<MealName, MealSlot>;
  travelMinutes: number;
  waitMinutes: number;
  endMinute: number | null;
}

export interface Hotel {
  hotelName: string;
  location: string;
  prices: string;
  rating: string;
  placeId?: string;
}

/** The plan's own parameters, echoed so the sheet can name what it is. */
export interface TripBlock {
  days: number;
  stopsPerDay: number;
  headcount: number;
  travelMode: string;
  startWeekday: number;
  startDate: string | null;
}

export interface CityBlock {
  name: string;
  description: string;
  IconicPlace: string;
  Country: string;
  "Region/State": string;
  Currency: string;
  Language: string;
  BestTimeToVisit: string;
}

/**
 * Transport data the solver does not gather yet. Served as `null` rather than
 * invented; the Result page shows an honest gap when it is absent.
 */
export interface ReachBlock {
  nearestAirport: [string, string];
  nearestRailwayStation: [string, string];
  nearestBusStation: [string, string];
}

/**
 * Every figure is a string because it is rendered as one, and every figure is
 * nullable because the composer genuinely emits null when the solver had no
 * number to format — a plan costed without a hotel, for instance. Declaring
 * these as `string` was a claim the server did not keep; `sum()` already
 * renders null as an em dash rather than a zero, which is the honest reading.
 */
export interface BudgetBlock {
  total: string | null;
  breakdown: {
    accommodation: string | null;
    meals: string | null;
    activities: string | null;
    transportation: string | null;
  };
  insufficientBudget: boolean;
  insufficientBudgetMessage: string;
  alternativeOptions: string;
  averageTotalCost: string | null;
  averageAccommodationCost: string | null;
  isEstimate: boolean;
  currency: string;
}

export interface PlanPayload {
  city: CityBlock;
  /** Names the source of truth for the plan: always the solver. */
  computedBy: string;
  itinerary: ItineraryDay[];
  hotels: Hotel[];
  Tips: string[];
  Budget: BudgetBlock;
  Reach: ReachBlock | null;
  metrics?: Record<string, unknown>;
  warnings?: string[];
  verification?: unknown;
  trip?: TripBlock;
  /** Set on the generate/regenerate responses: the handle for email + re-plan. */
  tripUuid?: string;
  /** True when the answer came from the 24 h plan cache rather than the solver. */
  cached?: boolean;
}

/**
 * What `POST /api/plan` accepts.
 *
 * Six fields here were collected by the Search form and then thrown away: the
 * old `controllers/gptResponse.js` read `travellers`, `pace`, `interests`,
 * `originCity`, `startDate` and `travelMode` off the body and forwarded hardcoded
 * values instead (`headcount=2`, `stopsPerDay=4`, `WALK`), so a traveller who
 * asked for six people, a relaxed pace and a start date got a plan for two, on a
 * packed schedule, starting today, on foot. They are declared here because the
 * client sends them, and the server parses them for the same reason.
 */
export interface PlanRequest {
  cityName: string;
  days: number;
  budget: number;
  /** Delivery address for the hand-off. Never identity — see `auth/session.ts`. */
  email: string;
  /** How many people the plan is for. Defaults to 2. */
  travellers?: number;
  /** "RELAXED" | "BALANCED" | "PACKED" — decides stops per day. */
  pace?: PaceName;
  /** "WALK" | "TRANSIT" | "DRIVE" | "BICYCLE" — decides travel estimates. */
  travelMode?: TravelModeName;
  interests?: string[];
  /** Where the trip starts from, when the traveller said. */
  originCity?: string;
  /** ISO `YYYY-MM-DD`. */
  startDate?: string;
  /** ISO 4217. Defaults to INR. */
  currency?: string;
}

export type PaceName = "RELAXED" | "BALANCED" | "PACKED";
export type TravelModeName = "WALK" | "TRANSIT" | "DRIVE" | "BICYCLE";

/** One record from the authenticated `GET /api/trips`. */
export interface TripsApiRecord {
  /** The trip's uuid — the handle the email and regenerate routes take. */
  uuid: string;
  cityName: string;
  /** When it was generated. */
  time?: string;
  itenary: PlanPayload;
}

/** A saved trip in the account drawer's own shape. */
export interface TripSummary {
  id: string;
  cityName: string;
  createdAt: string;
  /** The plan, reopened on `/result` when the row is clicked. */
  plan: PlanPayload;
}

/** The Google Custom Search shape behind `/api/itenary/city-image`. */
export interface CityImageResponse {
  items?: { link?: string }[];
}

/** One validation failure, as `POST /api/itenary` reports it on a 400. */
export interface PlanErrorDetail {
  message: string;
}

export interface UserInfo {
  email: string;
  name?: string;
  fname?: string;
  image?: string;
  [key: string]: unknown;
}

export interface AuthSession {
  user?: UserInfo | null;
  session?: unknown;
}

/**
 * The app's own profile — the port of Express `GET /profile`.
 * `authId`/`email` are read-only (session cookie); the rest is editable in
 * `/account` and stored by `PUT /api/profile`.
 */
export interface UserProfile {
  authId: string;
  email: string;
  fname: string;
  lname: string;
  userInterest: string[];
  userAddress: string;
}
