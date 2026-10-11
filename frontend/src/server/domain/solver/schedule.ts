import "server-only";
import { estimateTravelMinutes } from "@/server/domain/solver/geo";
import type {
  GeoPoint,
  MealSlot,
  Place,
  TravelMode,
} from "@/server/domain/types";
/**
 * Turn an ordered day into timed stops, and reject what cannot actually happen.
 * Ported from `backend/solver/schedule.js` — same windows, same dwells,
 * same 09:00–21:00 day. The only change is types.
 */

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DWELL_MINUTES: Readonly<Record<string, number>> = Object.freeze({
  museum: 120,
  art_gallery: 75,
  aquarium: 100,
  zoo: 150,
  botanical_garden: 75,
  park: 45,
  tourist_attraction: 60,
  historical_landmark: 45,
  monument: 30,
  memorial_cemetery: 25,
  place_of_worship: 35,
  church: 35,
  mosque: 35,
  temple: 35,
  hindu_temple: 35,
  castle: 70,
  palace: 70,
  fort: 70,
  city_hall: 30,
  natural_feature: 30,
  viewpoint: 30,
  promenade: 30,
  neighborhood: 45,
  store: 25,
  market: 45,
  night_club: 90,
  bar: 75,
});

export const DEFAULT_DWELL = 45;
export const MEAL_DWELL = { breakfast: 45, lunch: 60, dinner: 75 } as const;
export const FIRST_START = 9 * 60;
export const LAST_END = 21 * 60;
export const DAY_MINUTES = 720;

type SchedulePlace = Place & { placeId?: string };

export const dwellMinutes = (place: SchedulePlace): number => {
  const primary = place?.primaryType;
  if (primary && DWELL_MINUTES[primary] !== undefined)
    return DWELL_MINUTES[primary] as number;
  for (const type of place?.types ?? []) {
    if (DWELL_MINUTES[type] !== undefined) return DWELL_MINUTES[type] as number;
  }
  return DEFAULT_DWELL;
};

const toMinutes = (hour: number, minute = 0): number => hour * 60 + minute;

interface DayWindow {
  open: number;
  close: number;
}

interface OpeningPeriod {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { hour?: number; minute?: number };
}

export const parseOpeningHours = (
  place: SchedulePlace,
): Map<number, DayWindow[]> | null => {
  const raw = place?.regularOpeningHours as
    { periods?: OpeningPeriod[] } | null | undefined;
  const periods = raw?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const byDay = new Map<number, DayWindow[]>();
  for (let day = 0; day < 7; day += 1) byDay.set(day, []);
  for (const period of periods) {
    const open = period?.open;
    if (typeof open?.day !== "number" || typeof open.hour !== "number")
      continue;
    const openFrom = toMinutes(open.hour, open.minute ?? 0);
    const close = period.close;
    const closesAt =
      typeof close?.hour === "number"
        ? toMinutes(close.hour, close.minute ?? 0)
        : DAY_MINUTES;
    byDay.get(open.day)?.push({ open: openFrom, close: closesAt });
  }
  return byDay;
};

const isOpenAt = (
  windows: Map<number, DayWindow[]> | null,
  weekday: number,
  minute: number,
): boolean => {
  if (!windows) return true;
  const forDay = windows.get(weekday);
  if (!forDay || forDay.length === 0) return false;
  return forDay.some((w) => minute >= w.open && minute <= w.close);
};

const minutesUntilOpen = (
  windows: Map<number, DayWindow[]> | null,
  weekday: number,
  minute: number,
): number => {
  if (!windows) return 0;
  for (const window of windows.get(weekday) ?? []) {
    if (minute >= window.open && minute <= window.close) return 0;
    if (minute < window.open) return window.open - minute;
  }
  for (let offset = 1; offset < 14; offset += 1) {
    const day = (weekday + offset) % 7;
    for (const window of windows.get(day) ?? []) {
      return offset * 24 * 60 + window.open - minute;
    }
  }
  return Infinity;
};

/** Which meal a stop fills, once `assignMealRoles` has decided. */
export type MealRole = MealSlot["role"];

export interface ScheduledStop {
  placeId: string;
  name: string;
  place: SchedulePlace;
  arriveAt: number;
  departAt: number;
  dwellMinutes: number;
  travelMinutes: number;
  waitMinutes: number;
  openedAt: boolean;
  /**
   * Set on the stop that wins a meal slot; null or absent on every other.
   * `assignMealRoles` writes this in place, exactly as the backend did.
   */
  role?: MealRole | null;
}

export interface DroppedStop {
  placeId: string;
  name: string;
  reason: string;
  arrivalMinute: number;
}

export interface ScheduleOptions {
  weekday?: number;
  startMinute?: number;
  mode?: TravelMode;
  anchor?: GeoPoint | SchedulePlace | null;
  maxWaitMinutes?: number;
}

const locOf = (place: GeoPoint | SchedulePlace): GeoPoint =>
  (place as Place)?.location ?? (place as GeoPoint);

const estimateLeg = (
  from: GeoPoint | SchedulePlace | null | undefined,
  to: GeoPoint | SchedulePlace | null | undefined,
  mode: TravelMode,
): number => {
  if (!from || !to) return 0;
  const fromLoc = locOf(from);
  const toLoc = locOf(to);
  if (!fromLoc || !toLoc) return 0;
  return estimateTravelMinutes(fromLoc, toLoc, { mode }) ?? 0;
};

export const scheduleDay = (
  orderedPlaces: readonly SchedulePlace[],
  {
    weekday = new Date().getDay(),
    startMinute = FIRST_START,
    mode = "WALK",
    anchor = null,
    maxWaitMinutes = 60,
  }: ScheduleOptions = {},
): {
  stops: ScheduledStop[];
  dropped: DroppedStop[];
  waitMinutes: number;
  totalMinutes: number;
  startMinute: number;
  endMinute: number;
  overrunsNight: boolean;
} => {
  const stops: ScheduledStop[] = [];
  const dropped: DroppedStop[] = [];
  let clock = startMinute;
  let previous: GeoPoint | SchedulePlace | null = anchor;
  let waitTotal = 0;

  for (const place of orderedPlaces) {
    const travel = estimateLeg(previous, place, mode);
    const arrival = clock + travel;
    const windows = parseOpeningHours(place);
    const dwell = dwellMinutes(place);
    let waitMinutes = 0;
    if (!isOpenAt(windows, weekday, arrival)) {
      const wait = minutesUntilOpen(windows, weekday, arrival);
      if (!Number.isFinite(wait) || wait > maxWaitMinutes) {
        dropped.push({
          placeId: place.placeId ?? place.id ?? place.name,
          name: place.name,
          reason: "closed",
          arrivalMinute: Math.round(arrival),
        });
        continue;
      }
      waitMinutes = wait;
      waitTotal += wait;
    }
    const arriveAt = arrival + waitMinutes;
    const departAt = arriveAt + dwell;
    stops.push({
      placeId: place.placeId ?? place.id ?? place.name,
      name: place.name,
      place,
      arriveAt: Math.round(arriveAt),
      departAt: Math.round(departAt),
      dwellMinutes: dwell,
      travelMinutes: Math.round(travel),
      waitMinutes: Math.round(waitMinutes),
      openedAt: waitMinutes > 0,
    });
    clock = departAt;
    previous = place;
  }

  return {
    stops,
    dropped,
    waitMinutes: Math.round(waitTotal),
    totalMinutes: stops.length === 0 ? 0 : Math.round(clock - startMinute),
    startMinute,
    endMinute: Math.round(clock),
    overrunsNight: clock > LAST_END,
  };
};

// The parameter is nullable because the guard below already answered that: the
// backend took whatever a stop carried and returned null for a missing clock.
export const formatClock = (minutes: number | null): string | null => {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return null;
  const clamped = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(clamped / 60) % 24).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

export const weekdayName = (weekday: number): string | null =>
  (DAY_NAMES[weekday] as string | undefined) ?? null;
