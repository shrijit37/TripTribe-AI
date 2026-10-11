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

export interface BudgetBlock {
  total: string;
  breakdown: {
    accommodation: string;
    meals: string;
    activities: string;
    transportation: string;
  };
  insufficientBudget: boolean;
  insufficientBudgetMessage: string;
  alternativeOptions: string;
  averageTotalCost: string;
  averageAccommodationCost: string;
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
  trip?: Record<string, unknown>;
}

/** One record from the authenticated `GET /api/itenary/all`. */
export interface TripsApiRecord {
  _id: string;
  cityName?: string;
  itenary?: PlanPayload;
  createdAt?: string;
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

/** What `parsePlanRequest` accepts, mirrored for the client's own validation. */
export interface PlanRequest {
  cityName: string;
  days: number;
  budget: number;
  email: string;
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