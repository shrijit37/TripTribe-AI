import { estimateTravelMinutes } from "./geo.js";

/**
 * Turn an ordered day into timed stops, and reject what cannot actually happen.
 *
 * The rule this module exists to enforce: **a place closed at 14:00 never
 * appears in a 15:00 slot.** That is a constraint the optimiser satisfies, not
 * something a prompt can be trusted to produce. A model asked politely will
 * usually comply, but "usually" is the failure mode — a plan that sends someone
 * to a closed museum is worse than no plan at all.
 *
 * Opening hours come from Google's `regularOpeningHours` (Enterprise SKU), so
 * they are real published data, not a model's recollection.
 *
 * Times are minutes from midnight in the destination's local time. No timezone
 * arithmetic happens here: `utcOffsetMinutes` is on the place, but converting a
 * wall-clock opening hour across zones is a correctness trap with no benefit for
 * a plan read by people standing in that city.
 */

/** Google's day numbering: 0 = Sunday … 6 = Saturday. */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Dwell time in minutes by primary type.
 *
 * What a person actually spends, not what a listing claims. A museum at 120
 * minutes and a viewpoint at 30 is the difference between a day that fits and
 * one that overruns into dinner.
 */
const DWELL_MINUTES = Object.freeze({
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

const DEFAULT_DWELL = 45;

/** How long a meal takes, so lunch does not overlap the next stop. */
const MEAL_DWELL = { breakfast: 45, lunch: 60, dinner: 75 };

/** Realistic window for being out and about. */
const FIRST_START = 9 * 60;   // 09:00
const LAST_END = 21 * 60;     // 21:00
const DAY_MINUTES = 720;

/**
 * Dwell time for a place.
 *
 * Falls back through primaryType → types[] → a default. A place with no
 * recognised type still gets a plausible dwell rather than zero, which would let
 * the optimiser stack twelve stops into a morning.
 */
export const dwellMinutes = (place) => {
    const primary = place?.primaryType;
    if (primary && DWELL_MINUTES[primary] !== undefined) return DWELL_MINUTES[primary];

    for (const type of place?.types ?? []) {
        if (DWELL_MINUTES[type] !== undefined) return DWELL_MINUTES[type];
    }

    return DEFAULT_DWELL;
};

const toMinutes = (hour, minute = 0) => hour * 60 + minute;

/**
 * Read Google's `regularOpeningHours` into per-weekday windows.
 *
 * Returns `null` when the place publishes no hours — which means *unknown*, not
 * *closed*. Treating unknown as closed would silently delete most places, since
 * many listings publish no hours at all.
 */
export const parseOpeningHours = (place) => {
    const periods = place?.regularOpeningHours?.periods;
    if (!Array.isArray(periods) || periods.length === 0) return null;

    const byDay = new Map();
    for (let day = 0; day < 7; day += 1) byDay.set(day, []);

    for (const period of periods) {
        const open = period?.open;
        if (typeof open?.day !== "number" || typeof open.hour !== "number") continue;

        const openFrom = toMinutes(open.hour, open.minute ?? 0);

        // A missing close hour means open to end of day.
        const close = period.close;
        const closesAt =
            typeof close?.hour === "number" ? toMinutes(close.hour, close.minute ?? 0) : DAY_MINUTES;

        // A window that wraps midnight is recorded against the day it opens: a
        // 20:00–02:00 bar is reachable at 21:00 on the opening day.
        byDay.get(open.day).push({ open: openFrom, close: closesAt });
    }

    return byDay;
};

const isOpenAt = (windows, weekday, minute) => {
    if (!windows) return true; // unknown, not closed
    const forDay = windows.get(weekday);
    if (!forDay || forDay.length === 0) return false; // published, closed that day
    return forDay.some((w) => minute >= w.open && minute <= w.close);
};

/**
 * Minutes from now until the venue next opens.
 *
 * Searches forward up to two weeks so a "closed today" place moves to its next
 * real opening day rather than being dropped outright.
 */
const minutesUntilOpen = (windows, weekday, minute) => {
    if (!windows) return 0;

    for (const window of windows.get(weekday) ?? []) {
        // Already inside the window: no wait. This must check `open` as well as
        // `close` — testing only `close` returned 0 for someone standing outside
        // a noon opening at 11:15, which scheduled the stop before it opened.
        if (minute >= window.open && minute <= window.close) return 0;

        // Arriving before it opens today.
        if (minute < window.open) return window.open - minute;
    }

    // Closed for the rest of today: look forward to the next real opening.
    for (let offset = 1; offset < 14; offset += 1) {
        const day = (weekday + offset) % 7;
        for (const window of windows.get(day) ?? []) {
            return offset * 24 * 60 + window.open - minute;
        }
    }

    return Infinity;
};

/**
 * Place stops on the clock, honouring opening hours.
 *
 * Walks the ordered stops from `startMinute`, adding travel and dwell time. A
 * stop reached while closed is pushed to its next opening time when that is
 * same-day feasible within `maxWaitMinutes` (default 60 — nobody plans to
 * stand outside for two hours), and dropped when it is not — always reported
 * in `dropped`, never silently omitted.
 *
 * Each returned stop carries `arriveAt`, `departAt`, and the `waitMinutes`
 * spent sitting outside.
 */
export const scheduleDay = (
    orderedPlaces,
    {
        weekday = new Date().getDay(),
        startMinute = FIRST_START,
        mode = "WALK",
        anchor = null,
        maxWaitMinutes = 60,
    } = {}
) => {
    const stops = [];
    const dropped = [];

    let clock = startMinute;
    let previous = anchor;
    let waitTotal = 0;

    for (const place of orderedPlaces) {
        const travel = estimateLeg(previous, place, mode);
        const arrival = clock + travel;

        const windows = parseOpeningHours(place);
        const dwell = dwellMinutes(place);

        let waitMinutes = 0;
        if (!isOpenAt(windows, weekday, arrival)) {
            const wait = minutesUntilOpen(windows, weekday, arrival);

            // Waiting hours for a stop that is not worth the day: drop it and
            // say so. Silently squeezing it in would produce an impossible plan.
            if (!Number.isFinite(wait) || wait > maxWaitMinutes) {
                dropped.push({
                    placeId: place.placeId,
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
            placeId: place.placeId,
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

/**
 * Minutes between two places, using the same estimate the sequencing step used.
 *
 * The schedule must cost a leg exactly as the optimiser cost it, or a day
 * optimised to fit will not fit on the clock.
 */
const estimateLeg = (from, to, mode) => {
    if (!from || !to) return 0;
    const fromLoc = from.location ?? from;
    const toLoc = to.location ?? to;
    if (!fromLoc || !toLoc) return 0;
    return estimateTravelMinutes(fromLoc, toLoc, { mode }) ?? 0;
};

/** `HH:MM` from minutes past midnight, for display. */
export const formatClock = (minutes) => {
    if (typeof minutes !== "number" || !Number.isFinite(minutes)) return null;
    const clamped = Math.max(0, Math.round(minutes));
    return `${String(Math.floor(clamped / 60) % 24).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

/** Weekday name from Google's 0–6 index, for display. */
export const weekdayName = (weekday) => DAY_NAMES[weekday] ?? null;

export { DAY_NAMES, DWELL_MINUTES, MEAL_DWELL, FIRST_START, LAST_END, DAY_MINUTES, DEFAULT_DWELL };