import { estimateTravelMinutes, haversineMeters } from "./geo.js";

/**
 * Order the stops within one day.
 *
 * This is the part a single LLM prompt cannot do: it optimises a permutation
 * against a real objective. Given N stops it returns the order that minimises
 * travel time plus penalties, subject to the day's time budget.
 *
 * Algorithm: nearest-neighbour seed, then 2-opt to a local optimum, then
 * Or-opt (relocate single stops and short segments) to escape 2-opt's
 * weakness of being unable to move a lone vertex.
 *
 * Held-Karp would be exact but is O(N²·2ᴺ) — fine at N=12, pointless here,
 * because the real objective (measured drive times, opening hours, meals) is
 * not the same function the solver optimises. Google then reorders the day
 * against real roads via `computeRoutesOptimized`, which is strictly better than
 * anything computed from straight lines.
 *
 * Every function is pure and deterministic: no randomness, no clock, no I/O.
 */

const locOf = (place) => place?.location ?? place;

/**
 * Cost of a leg, in minutes.
 *
 * `null` on unusable input rather than 0 — a zero-minute leg would make an
 * unroutable pair look ideal and win the optimisation.
 */
export const legMinutes = (a, b, mode) => estimateTravelMinutes(locOf(a), locOf(b), { mode });

/** Total travel minutes for an ordered sequence, optionally anchored both ends. */
export const pathMinutes = (ordered, { mode = "WALK", anchor = null } = {}) => {
    if (!Array.isArray(ordered) || ordered.length === 0) return 0;

    let total = 0;
    if (anchor) total += legMinutes(anchor, ordered[0], mode) ?? 0;
    for (let i = 1; i < ordered.length; i += 1) {
        total += legMinutes(ordered[i - 1], ordered[i], mode) ?? 0;
    }
    if (anchor) total += legMinutes(ordered[ordered.length - 1], anchor, mode) ?? 0;

    return total;
};

/**
 * Nearest-neighbour seed.
 *
 * Greedy: from the current stop, go to the closest unvisited one. Start from
 * whichever stop is closest to the anchor so the day does not open with the
 * trip's longest journey.
 */
export const nearestNeighbour = (places, { mode = "WALK", anchor = null } = {}) => {
    if (!Array.isArray(places) || places.length === 0) return [];

    const remaining = places.map((_, i) => i);
    const ordered = [];

    let current = null;
    if (anchor) {
        // Open on the stop nearest the base, not merely the first in the list.
        let best = 0;
        let bestDistance = Infinity;
        remaining.forEach((index, position) => {
            const d = legMinutes(anchor, places[index], mode) ?? Infinity;
            if (d < bestDistance) {
                bestDistance = d;
                best = position;
            }
        });
        current = places[remaining[best]];
        ordered.push(current);
        remaining.splice(best, 1);
    }

    while (remaining.length > 0) {
        const from = current ?? places[remaining[0]];
        let bestPosition = 0;
        let bestDistance = Infinity;

        remaining.forEach((index, position) => {
            const d = legMinutes(from, places[index], mode) ?? Infinity;
            if (d < bestDistance) {
                bestDistance = d;
                bestPosition = position;
            }
        });

        current = places[remaining[bestPosition]];
        ordered.push(current);
        remaining.splice(bestPosition, 1);
    }

    return ordered;
};

/**
 * 2-opt: reverse the segment between two positions when that shortens the path.
 *
 * Strictly-improving moves only (`<`), which is what makes it terminate. The
 * anchor legs are re-costed around every reversal, so a day that starts and
 * ends at the hotel is optimised as a loop, not as an open path.
 */
export const twoOpt = (ordered, { mode = "WALK", anchor = null, maxPasses = 50 } = {}) => {
    if (!Array.isArray(ordered) || ordered.length < 3) return [...(ordered ?? [])];

    let best = [...ordered];
    let bestCost = pathMinutes(best, { mode, anchor });

    for (let pass = 0; pass < maxPasses; pass += 1) {
        let improvedThisPass = false;

        for (let i = 0; i < best.length - 1; i += 1) {
            for (let k = i + 1; k < best.length; k += 1) {
                const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
                const cost = pathMinutes(candidate, { mode, anchor });

                // Strictly less: equal-cost reversals would loop forever and
                // churn the output without improving it.
                if (cost < bestCost - 1e-9) {
                    best = candidate;
                    bestCost = cost;
                    improvedThisPass = true;
                }
            }
        }

        if (!improvedThisPass) break;
    }

    return best;
};

/**
 * Or-opt: relocate a run of 1–3 stops elsewhere in the sequence.
 *
 * 2-opt alone cannot move a single vertex — reversing a segment of length one
 * is a no-op — so it gets stuck on "one badly placed stop surrounded by good
 * ones". This is the case that matters most in practice: a museum on the far
 * side of town among four nearby sights.
 */
export const orOpt = (ordered, { mode = "WALK", anchor = null, maxPasses = 20 } = {}) => {
    if (!Array.isArray(ordered) || ordered.length < 3) return [...(ordered ?? [])];

    let best = [...ordered];
    let bestCost = pathMinutes(best, { mode, anchor });

    for (let pass = 0; pass < maxPasses; pass += 1) {
        let improvedThisPass = false;

        for (let length = 1; length <= 3; length += 1) {
            for (let start = 0; start + length <= best.length; start += 1) {
                const segment = best.slice(start, start + length);
                const remainder = [...best.slice(0, start), ...best.slice(start + length)];

                for (let insertAt = 0; insertAt <= remainder.length; insertAt += 1) {
                    // Skip the position the segment was just removed from.
                    if (insertAt === start) continue;

                    const candidate = [
                        ...remainder.slice(0, insertAt),
                        ...segment,
                        ...remainder.slice(insertAt),
                    ];
                    const cost = pathMinutes(candidate, { mode, anchor });

                    if (cost < bestCost - 1e-9) {
                        best = candidate;
                        bestCost = cost;
                        improvedThisPass = true;
                    }
                }
            }
        }

        if (!improvedThisPass) break;
    }

    return best;
};

/**
 * Order one day.
 *
 * Returns the sequence plus its cost, so the caller can check it against the
 * day's time budget and drop a stop if it does not fit.
 *
 * `maxMinutes` is a soft cap: `schedule.js` decides what to cut. This function
 * reports the true cost rather than silently padding or truncating the day.
 */
export const sequenceDay = (places, { mode = "WALK", anchor = null } = {}) => {
    if (!Array.isArray(places) || places.length === 0) {
        return { order: [], travelMinutes: 0 };
    }
    if (places.length === 1) {
        return { order: [...places], travelMinutes: 0 };
    }

    const seed = nearestNeighbour(places, { mode, anchor });
    const improved = orOpt(twoOpt(seed, { mode, anchor }), { mode, anchor });

    return {
        order: improved,
        travelMinutes: pathMinutes(improved, { mode, anchor }),
    };
};

/**
 * Total straight-line spread of a day's stops.
 *
 * Reported alongside the optimised order so the clustering step's quality can be
 * inspected independently of the sequencing.
 */
export const daySpread = (places) => {
    let worst = 0;
    for (let i = 0; i < places.length; i += 1) {
        for (let j = i + 1; j < places.length; j += 1) {
            const d = haversineMeters(locOf(places[i]), locOf(places[j]));
            if (d !== null && d > worst) worst = d;
        }
    }
    return worst;
};