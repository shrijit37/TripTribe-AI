import "server-only";
import type { CostResult, Place } from "@/server/domain/types";

/**
 * Cost the trip in code.
 * Ported from `backend/solver/cost.js` — every band and factor unchanged.
 * Two fixes from the migration bug register are applied here (step 8):
 * `mealsCost` averages every distinct place actually used per role instead of
 * pricing `list[0]` for the whole trip, and `lodgingCost` accepts a list and
 * averages the band so a single outlier hotel cannot set the whole line.
 */

export const BAND_USD = Object.freeze({
  lodging: [6, 14, 32, 78, 170],
  meal: [2, 5, 11, 22, 45],
  activity: [0, 8, 17, 35, 70],
  transit_ride: [0, 0.6, 1.2, 2.5, 5],
});

export const CURRENCY_FACTOR: Readonly<Record<string, number>> = Object.freeze({
  INR: 83,
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 157,
  CNY: 7.2,
  KRW: 1380,
  THB: 36,
  SGD: 1.35,
  AUD: 1.52,
  CAD: 1.37,
  NZD: 1.66,
  AED: 3.67,
  BRL: 5.4,
  MXN: 17.1,
  ZAR: 18.4,
  TRY: 32,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.9,
  CHF: 0.89,
  PLN: 4.0,
  IDR: 15800,
  MYR: 4.7,
  PHP: 56,
  VND: 25000,
  TWD: 31.5,
  HKD: 7.8,
  SAR: 3.75,
  QAR: 3.64,
  MAD: 9.9,
});

export const DEFAULT_FACTOR = 60;

type CostPlace =
  Pick<Place, "priceLevel"> | { priceLevel?: number | null } | null | undefined;

const clampBand = (band: unknown): number => {
  if (typeof band !== "number" || !Number.isFinite(band)) return 2;
  return Math.min(4, Math.max(0, Math.round(band)));
};

export const parseCurrencyCode = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const text = raw.toUpperCase();
  const code = text.match(/\b([A-Z]{3})\b/);
  if (code && code[1] && CURRENCY_FACTOR[code[1]]) return code[1];
  const aliases: Record<string, string> = {
    RUPEE: "INR",
    RUPEES: "INR",
    "₹": "INR",
    DOLLAR: "USD",
    DOLLARS: "USD",
    $: "USD",
    EURO: "EUR",
    "€": "EUR",
    POUND: "GBP",
    POUNDS: "GBP",
    "£": "GBP",
    YEN: "JPY",
    "¥": "JPY",
    WON: "KRW",
    "₩": "KRW",
    REAL: "BRL",
    REAIS: "BRL",
    DIRHAM: "AED",
    RIYAL: "SAR",
    FRANC: "CHF",
  };
  for (const [needle, mapped] of Object.entries(aliases)) {
    if (text.includes(needle)) return mapped;
  }
  return null;
};

export const currencyFactor = (currency: string): number =>
  CURRENCY_FACTOR[currency] ?? DEFAULT_FACTOR;

export const occasionCostUsd = (_kind: string, place: CostPlace): number =>
  clampBand(place?.priceLevel);

export const bandUsd = (
  kind: keyof typeof BAND_USD,
  place: CostPlace,
): number => {
  const table = BAND_USD[kind];
  if (!table) return 0;
  return table[clampBand(place?.priceLevel)] as number;
};

export interface OccasionOptions {
  headcount?: number;
  currency?: string;
}

export const occasionCost = (
  kind: keyof typeof BAND_USD,
  place: CostPlace,
  { headcount = 1, currency = "USD" }: OccasionOptions = {},
): number => {
  const usd = bandUsd(kind, place) * Math.max(1, headcount);
  return usd * currencyFactor(currency);
};

export interface TransportOptions extends OccasionOptions {
  mode?: string;
  fuel?: { kmPerLitre?: number; pricePerLitre?: number } | null;
}

export const transportCost = (
  meters: number,
  {
    mode = "TRANSIT",
    headcount = 1,
    currency = "USD",
    fuel = null,
  }: TransportOptions = {},
): number => {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  const km = meters / 1000;
  if (
    mode === "DRIVE" &&
    (fuel?.kmPerLitre ?? 0) > 0 &&
    (fuel?.pricePerLitre ?? 0) > 0
  ) {
    const litres = (km * 2) / (fuel!.kmPerLitre as number);
    const fuelCost =
      litres * (fuel!.pricePerLitre as number) * Math.max(1, headcount);
    const tolls = Math.max(0, km * 2 - 15) * 2.4;
    return fuelCost + tolls * currencyFactor(currency);
  }
  const band =
    mode === "WALK" ? 0 : clampBand(1 + (mode === "TRANSIT" ? 0 : 1));
  const perBoarding =
    (BAND_USD.transit_ride[band] as number) * currencyFactor(currency);
  const boardings = Math.max(1, Math.ceil(km / 5));
  return perBoarding * boardings * Math.max(1, headcount);
};

export interface LodgingOptions extends OccasionOptions {
  days?: number;
  rooms?: number | null;
}

type HotelInput = CostPlace | CostPlace[];

const hotelList = (hotel: HotelInput | null | undefined): CostPlace[] => {
  if (!hotel) return [];
  return (Array.isArray(hotel) ? hotel : [hotel]).filter(Boolean);
};

export const lodgingCost = (
  hotel: HotelInput | null | undefined,
  { days, headcount = 1, currency = "USD", rooms = null }: LodgingOptions = {},
): number => {
  const list = hotelList(hotel);
  if (list.length === 0) return 0;
  const nights = Math.max(1, (days ?? 1) - 1);
  const occupancy = rooms ?? Math.max(1, Math.ceil(headcount / 2));
  // Average the nightly band across the hotels actually used, so one outlier
  // cannot set the whole accommodation line (migration fix, was `list[0]`).
  const nightlyUsd =
    list.reduce((sum, h) => sum + bandUsd("lodging", h), 0) / list.length;
  return nightlyUsd * nights * occupancy * currencyFactor(currency);
};

export interface MealsInput {
  breakfast?: CostPlace[];
  lunch?: CostPlace[];
  dinner?: CostPlace[];
}

const avgRoleUsd = (list: CostPlace[] | undefined): number | null => {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.reduce((sum, p) => sum + bandUsd("meal", p), 0) / list.length;
};

export const mealsCost = (
  placesByType: MealsInput | null | undefined,
  { days, headcount = 1, currency = "USD" }: LodgingOptions = {},
): number => {
  const { breakfast = [], lunch = [], dinner = [] } = placesByType ?? {};
  // Average every distinct place actually used per role (migration fix, was
  // `list[0]` per role for the whole trip, so all days cost the same).
  const lunchAvg =
    avgRoleUsd(lunch) ?? avgRoleUsd(dinner) ?? bandUsd("meal", null);
  const b = avgRoleUsd(breakfast) ?? lunchAvg;
  const l = avgRoleUsd(lunch) ?? avgRoleUsd(dinner) ?? lunchAvg;
  const d = avgRoleUsd(dinner) ?? avgRoleUsd(lunch) ?? lunchAvg;
  const perDayUsd = b + l + d;
  return (
    perDayUsd *
    Math.max(1, headcount) *
    currencyFactor(currency) *
    Math.max(1, days ?? 1)
  );
};

export const activitiesCost = (
  activities: CostPlace[] | undefined | null,
  { headcount = 1, currency = "USD" }: OccasionOptions = {},
): number => {
  if (!Array.isArray(activities)) return 0;
  return activities.reduce(
    (sum, place) =>
      sum + occasionCost("activity", place, { headcount, currency }),
    0,
  );
};

export interface CostTripInput {
  days: number;
  budget: number;
  currency?: string;
  headcount?: number;
  hotel?: HotelInput | null;
  activities?: CostPlace[];
  meals?: MealsInput;
  totalMeters?: number;
  travelMode?: string;
  fuel?: { kmPerLitre?: number; pricePerLitre?: number } | null;
  rooms?: number | null;
}

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
}: CostTripInput): CostResult => {
  const lodging = lodgingCost(hotel, { days, headcount, currency, rooms });
  const mealsTotal = mealsCost(meals, { days, headcount, currency });
  const acts = activitiesCost(activities, { headcount, currency });
  const transport = transportCost(totalMeters, {
    mode: travelMode,
    headcount,
    currency,
    fuel,
  });
  const total = lodging + mealsTotal + acts + transport;
  const perDay = total / Math.max(1, days);
  const perPersonPerDay = total / Math.max(1, days * headcount);
  const feasible = Number.isFinite(budget) ? total <= budget : true;
  const shortfall = feasible ? 0 : Math.max(0, total - budget);
  const suggestions: string[] = [];
  if (!feasible) {
    if (lodging > total * 0.35) {
      suggestions.push(
        "Staying at a lower price tier would be the single biggest saving.",
      );
    }
    if (mealsTotal > total * 0.35) {
      suggestions.push(
        "Mixing cheaper meals into the day, especially dinner, would cut the food line noticeably.",
      );
    }
    if (transport > total * 0.2) {
      suggestions.push(
        "Using public transport or walking between nearby stops would reduce the transport line.",
      );
    }
    if (acts > total * 0.2) {
      suggestions.push(
        "Dropping one or two paid attractions would close part of the gap.",
      );
    }
    if (suggestions.length === 0) {
      suggestions.push(
        "Shortening the trip by a day is the surest way to bring it within budget.",
      );
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
      meals: Math.round(mealsTotal),
      activities: Math.round(acts),
      transportation: Math.round(transport),
    },
    isEstimate: true,
    budget: Number.isFinite(budget)
      ? Math.round(budget)
      : (null as unknown as number),
    feasible,
    shortfall: Math.round(shortfall),
    suggestions,
  };
};
