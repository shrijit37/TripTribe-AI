import { haversineMeters, centroid, diameterMeters } from "./geo.js";

/**
 * Split a candidate pool into one geographic group per day.
 *
 * The product claim is "a day is a route, not a list" — a day whose stops are an
 * hour apart is not a day out. So partitioning comes *before* sequencing: decide
 * which places belong together, then order within each group.
 *
 * Every collection here holds **indices into the original array**, never object
 * references. Two earlier versions carried objects and used
 * `filter(p => p !== outlier)` to remove one; that silently removed nothing
 * whenever the array had been spread-cloned, so places were duplicated across
 * days instead of moved. Index-based removal makes that class of bug
 * impossible.
 *
 * Deterministic throughout: ties break on array index (which is itself derived
 * from a stable quality sort), never on object identity or iteration luck. The
 * same pool always produces the same itinerary — that is the property that
 * makes the whole solver testable.
 */

/** Beyond this, two places are effectively not a single outing. */
const FAR_METERS = 6000;

const locOf = (place) => place?.location ?? place;

/**
 * Stable quality ordering: better places first, then by id.
 *
 * The tiebreak is what makes the sort total. Two places with identical scores
 * must not swap between runs, or a regenerated plan would not match the saved
 * one the traveller is looking at.
 */
export const byQuality = (a, b) => {
    const ra = a.bayesianRating ?? a.rating ?? -1;
    const rb = b.bayesianRating ?? b.rating ?? -1;
    if (rb !== ra) return rb - ra;
    return String(a.placeId ?? a.name ?? "").localeCompare(String(b.placeId ?? b.name ?? ""));
};

/** Largest distance between any place in `groupA` and any in `groupB`. */
const spreadBetween = (groupA, groupB, places) => {
    let worst = 0;
    for (const i of groupA) {
        for (const j of groupB) {
            const d = haversineMeters(locOf(places[i]), locOf(places[j]));
            if (d !== null && d > worst) worst = d;
        }
    }
    return worst;
};

/** Internal spread of a single group. */
const spreadWithin = (group, places) => {
    let worst = 0;
    for (let a = 0; a < group.length; a += 1) {
        for (let b = a + 1; b < group.length; b += 1) {
            const d = haversineMeters(locOf(places[group[a]]), locOf(places[group[b]]));
            if (d !== null && d > worst) worst = d;
        }
    }
    return worst;
};

/**
 * Greedy agglomerative clustering, merging the two closest groups whose merged
 * spread stays within `FAR_METERS`.
 *
 * Adequate rather than optimal on purpose: the ordering inside each day is
 * re-optimised afterwards by 2-opt, so this stage only has to get group
 * *membership* roughly right. An exact clustering solution would buy nothing.
 */
const agglomerate = (chunks, targetGroups, places) => {
    // Chunks arrive already bounded by `targetSize`, so merging whole chunks
    // can never produce a day that exceeds the stop budget.
    let groups = chunks.map((chunk) => [...chunk]);

    while (groups.length > targetGroups) {
        let best = null;

        for (let i = 0; i < groups.length; i += 1) {
            for (let j = i + 1; j < groups.length; j += 1) {
                const spread = spreadBetween(groups[i], groups[j], places);
                if (spread > FAR_METERS) continue;
                // Closest merge wins; ties break on index, which is stable
                // because group order only ever changes by merging.
                if (!best || spread < best.spread) {
                    best = { i, j, spread };
                }
            }
        }

        // Nothing merges within FAR_METERS: these places are already as close
        // as the city allows. Forcing a merge would build a day with a punishing
        // commute, which is worse than an uneven split.
        if (!best) break;

        const merged = [...groups[best.i], ...groups[best.j]];
        const remaining = groups.filter((_, index) => index !== best.i && index !== best.j);
        groups = [...remaining, merged];
    }

    return groups;
};

/**
 * Move one place from the largest group to the smallest while the largest
 * exceeds the target.
 *
 * Gives the place furthest from the receiving group's centre, so the donor is
 * left coherent rather than shorn at its edge.
 */
const balance = (groups, places, targetSize) => {
    const work = groups.map((group) => [...group]);
    const centreOf = (group) => centroid(group.map((i) => places[i]));

    let guard = 0;
    while (guard < 10_000) {
        let largestIndex = 0;
        let smallestIndex = 0;
        for (let i = 1; i < work.length; i += 1) {
            if (work[i].length > work[largestIndex].length) largestIndex = i;
            if (work[i].length < work[smallestIndex].length) smallestIndex = i;
        }

        const largest = work[largestIndex];
        const smallest = work[smallestIndex];

        if (largest.length <= targetSize) break;      // within target
        if (largest.length <= smallest.length) break; // already even
        if (largest.length <= 1) break;               // cannot give the last stop
        if (spreadBetween(largest, smallest, places) > FAR_METERS) break; // bad move

        const centre = centreOf(smallest);
        let worstOffset = 0;
        let worstDistance = -1;
        for (const offset of largest) {
            const d = haversineMeters(locOf(places[offset]), centre) ?? 0;
            if (d > worstDistance) {
                worstDistance = d;
                worstOffset = offset;
            }
        }

        largest.splice(largest.indexOf(worstOffset), 1);
        smallest.push(worstOffset);
        guard += 1;
    }

    return work;
};


/**
 * Carve a pool into consecutive compact chunks of at most `targetSize`.
 *
 * Each chunk grows from its own centre by repeatedly taking the nearest
 * remaining place, so every chunk is a tight cluster rather than an arbitrary
 * slice in index order. This runs *before* clustering, which is what guarantees
 * no day can exceed the per-day stop budget: clustering then only ever merges
 * whole chunks.
 */
const chunkBySize = (places, targetSize) => {
    const remaining = places.map((_, index) => index);
    const chunks = [];

    while (remaining.length > 0) {
        const take = Math.min(targetSize, remaining.length);
        const chunk = [];

        while (chunk.length < take) {
            const centre = centroid(chunk.map((i) => places[i]));

            if (centre === null) {
                chunk.push(remaining.shift());
                continue;
            }

            let bestPosition = 0;
            let bestDistance = Infinity;
            for (let k = 0; k < remaining.length; k += 1) {
                const d = haversineMeters(locOf(places[remaining[k]]), centre) ?? Infinity;
                if (d < bestDistance) {
                    bestDistance = d;
                    bestPosition = k;
                }
            }

            chunk.push(remaining.splice(bestPosition, 1)[0]);
        }

        chunks.push(chunk);
    }

    return chunks;
};

/**
 * Partition candidates into days.
 *
 * @param {Array}  places    Candidates with `.location`; must not be empty.
 * @param {Object} options
 * @param {number} options.dayCount    Days requested.
 * @param {number} options.stopsPerDay Target stops per day, from `pace`.
 * @param {Object} [options.anchor]    Hotel, so day 1 starts near base.
 */
export const partitionIntoDays = (places, { dayCount, stopsPerDay, anchor = null }) => {
    if (!Array.isArray(places) || places.length === 0) {
        throw new Error("partitionIntoDays requires at least one place");
    }
    if (!Number.isInteger(dayCount) || dayCount < 1) {
        throw new Error(`partitionIntoDays requires a positive integer dayCount, received ${dayCount}`);
    }

    // An unlocatable place cannot be routed to, so it belongs to no day.
    const locatable = places
        .filter((p) => {
            const l = locOf(p);
            // NaN passes a bare typeof check and would silently break every
            // distance comparison downstream.
            return (
                l &&
                typeof l.lat === "number" && Number.isFinite(l.lat) &&
                typeof l.lng === "number" && Number.isFinite(l.lng)
            );
        })
        .sort(byQuality);

    if (locatable.length === 0) {
        throw new Error("partitionIntoDays requires at least one place with coordinates");
    }

    const targetSize = Math.max(stopsPerDay ?? 4, 1);

    // `pace` caps stops per day, so N days can absorb at most N × stopsPerDay
    // places. A 2-day trip at 4 stops per day cannot meaningfully use a 40-place
    // pool — filling it would produce days nobody walks in one sitting.
    const usable = locatable.slice(0, dayCount * targetSize);

    // One day per requested day, but never more days than there are places:
    // an empty day breaks the itinerary contract.
    const targetGroups = Math.max(1, Math.min(dayCount, usable.length));

    // Chunk first, merge second.
    //
    // Splitting *after* agglomeration produced singleton days: a 12-place pool
    // for 2 days came back as [2,1,1,4] because each carve-off peeled a single
    // place off an already-merged group. Chunking the pool to `targetSize` first
    // means agglomeration only ever merges whole, well-formed days, so the
    // result can never exceed the per-day stop budget.
    const chunks = chunkBySize(usable, targetSize);
    let groups = balance(agglomerate(chunks, targetGroups, usable), usable, targetSize);

    // `agglomerate` deliberately refuses to merge clusters further apart than
    // FAR_METERS — a day with a punishing commute is worse than an uneven
    // split. That refusal can leave fewer days than requested (six places in
    // two distant clusters, asked to fill 4 days), and the itinerary contract
    // needs one entry per day. So when the traveller asked for more days than
    // geography allows, split the largest remaining group instead.
    while (groups.length < targetGroups) {
        let largestIndex = 0;
        for (let i = 1; i < groups.length; i += 1) {
            if (groups[i].length > groups[largestIndex].length) largestIndex = i;
        }

        const donor = groups[largestIndex];
        if (donor.length <= 1) break; // cannot split further without duplicating

        // Carve off the place furthest from the donor's centre.
        const centre = centroid(donor.map((i) => usable[i]));
        let outlier = donor[0];
        let furthest = -1;
        for (const index of donor) {
            const d = haversineMeters(locOf(usable[index]), centre) ?? 0;
            if (d > furthest) {
                furthest = d;
                outlier = index;
            }
        }

        donor.splice(donor.indexOf(outlier), 1);
        groups.push([outlier]);
    }

    // Day 1 sits nearest the hotel: the first morning should not open with the
    // longest journey of the trip.
    if (locOf(anchor) && groups.length > 1) {
        const anchorPoint = locOf(anchor);
        groups.sort((a, b) => {
            const ca = centroid(a.map((i) => usable[i]));
            const cb = centroid(b.map((i) => usable[i]));
            return (
                (haversineMeters(ca, anchorPoint) ?? Infinity) -
                (haversineMeters(cb, anchorPoint) ?? Infinity)
            );
        });
    }

    const days = groups
        .filter((group) => group.length > 0)
        .map((group) => group.map((index) => usable[index]).sort(byQuality));

    const allAssigned = days.flat().length;

    return {
        days,
        metrics: {
            requestedDays: dayCount,
            actualDays: days.length,
            stopsAvailable: locatable.length,
            stopsUsed: allAssigned,
            stopsDroppedByPace: locatable.length - usable.length,
            stopsUnlocatable: places.length - locatable.length,
            targetSize,
            sizes: days.map((d) => d.length),
            // Spread per day: the honest measure of "a day is a route".
            dayDiameters: days.map((d) => Math.round(diameterMeters(d))),
            // Must equal `sizes` — anything less means a place was duplicated.
            distinctPerDay: days.map((d) => new Set(d.map((p) => p.placeId)).size),
        },
    };
};

export { FAR_METERS };