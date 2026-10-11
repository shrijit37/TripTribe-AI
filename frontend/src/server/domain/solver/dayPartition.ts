import "server-only";
import {
  haversineMeters,
  centroid,
  diameterMeters,
} from "@/server/domain/solver/geo";
import type { GeoPoint, Place } from "@/server/domain/types";

/**
 * Split a candidate pool into one geographic group per day.
 * Ported from `backend/solver/dayPartition.js` — index-based collections,
 * stable quality sort, chunk-first-then-merge. Behaviour unchanged.
 */

type PartitionPlace = Place & { placeId?: string };
export const FAR_METERS = 6000;

const locOf = (place: PartitionPlace | GeoPoint): GeoPoint =>
  (place as Place)?.location ?? (place as GeoPoint);

const idOf = (p: PartitionPlace): string => p.placeId ?? p.id ?? p.name ?? "";

export const byQuality = (a: PartitionPlace, b: PartitionPlace): number => {
  const ra = a.bayesianRating ?? a.rating ?? -1;
  const rb = b.bayesianRating ?? b.rating ?? -1;
  if (rb !== ra) return rb - ra;
  return idOf(a).localeCompare(idOf(b));
};

const spreadBetween = (
  groupA: readonly number[],
  groupB: readonly number[],
  places: readonly PartitionPlace[],
): number => {
  let worst = 0;
  for (const i of groupA) {
    for (const j of groupB) {
      const a = places[i];
      const b = places[j];
      if (!a || !b) continue;
      const d = haversineMeters(locOf(a), locOf(b));
      if (d !== null && d > worst) worst = d;
    }
  }
  return worst;
};

const agglomerate = (
  chunks: number[][],
  targetGroups: number,
  places: readonly PartitionPlace[],
): number[][] => {
  let groups = chunks.map((chunk) => [...chunk]);
  while (groups.length > targetGroups) {
    let best: { i: number; j: number; spread: number } | null = null;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const gi = groups[i];
        const gj = groups[j];
        if (!gi || !gj) continue;
        const spread = spreadBetween(gi, gj, places);
        if (spread > FAR_METERS) continue;
        if (!best || spread < best.spread) best = { i, j, spread };
      }
    }
    if (!best) break;
    const gi = groups[best.i];
    const gj = groups[best.j];
    if (!gi || !gj) break;
    const merged = [...gi, ...gj];
    const remaining = groups.filter(
      (_, index) => index !== best!.i && index !== best!.j,
    );
    groups = [...remaining, merged];
  }
  return groups;
};

const balance = (
  groups: number[][],
  places: readonly PartitionPlace[],
  targetSize: number,
): number[][] => {
  const work = groups.map((group) => [...group]);
  const centreOf = (group: number[]) =>
    centroid(
      group.map((i) => places[i]).filter((p): p is PartitionPlace => !!p),
    );

  let guard = 0;
  while (guard < 10_000) {
    let largestIndex = 0;
    let smallestIndex = 0;
    for (let i = 1; i < work.length; i += 1) {
      const wi = work[i];
      const wl = work[largestIndex];
      const ws = work[smallestIndex];
      if (wi && wl && wi.length > wl.length) largestIndex = i;
      if (wi && ws && wi.length < ws.length) smallestIndex = i;
    }
    const largest = work[largestIndex];
    const smallest = work[smallestIndex];
    if (!largest || !smallest) break;
    if (largest.length <= targetSize) break;
    if (largest.length <= smallest.length) break;
    if (largest.length <= 1) break;
    if (spreadBetween(largest, smallest, places) > FAR_METERS) break;

    const centre = centreOf(smallest);
    let worstOffset = largest[0] as number;
    let worstDistance = -1;
    for (const offset of largest) {
      const p = places[offset];
      if (!p) continue;
      const d = centre ? (haversineMeters(locOf(p), centre) ?? 0) : 0;
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

const chunkBySize = (
  places: readonly PartitionPlace[],
  targetSize: number,
): number[][] => {
  const remaining = places.map((_, index) => index);
  const chunks: number[][] = [];
  while (remaining.length > 0) {
    const take = Math.min(targetSize, remaining.length);
    const chunk: number[] = [];
    while (chunk.length < take) {
      const centre = centroid(
        chunk.map((i) => places[i]).filter((p): p is PartitionPlace => !!p),
      );
      if (centre === null) {
        const shifted = remaining.shift();
        if (shifted !== undefined) chunk.push(shifted);
        continue;
      }
      let bestPosition = 0;
      let bestDistance = Infinity;
      for (let k = 0; k < remaining.length; k += 1) {
        const idx = remaining[k];
        const p = idx !== undefined ? places[idx] : undefined;
        if (p === undefined) continue;
        const d = haversineMeters(locOf(p), centre) ?? Infinity;
        if (d < bestDistance) {
          bestDistance = d;
          bestPosition = k;
        }
      }
      const picked = remaining.splice(bestPosition, 1)[0];
      if (picked !== undefined) chunk.push(picked);
    }
    chunks.push(chunk);
  }
  return chunks;
};

export interface PartitionOptions {
  dayCount: number;
  stopsPerDay: number;
  anchor?: GeoPoint | PartitionPlace | null;
}

export interface PartitionMetrics {
  requestedDays: number;
  actualDays: number;
  stopsAvailable: number;
  stopsUsed: number;
  stopsDroppedByPace: number;
  stopsUnlocatable: number;
  targetSize: number;
  sizes: number[];
  dayDiameters: number[];
  distinctPerDay: number[];
}

const isLocatable = (p: PartitionPlace): boolean => {
  const l = locOf(p);
  const pt = (l as { location?: unknown })?.location ?? l;
  const c = pt as { lat?: unknown; lng?: unknown };
  return (
    !!c &&
    typeof c.lat === "number" &&
    Number.isFinite(c.lat) &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lng)
  );
};

export const partitionIntoDays = (
  places: readonly PartitionPlace[],
  { dayCount, stopsPerDay, anchor = null }: PartitionOptions,
): { days: PartitionPlace[][]; metrics: PartitionMetrics } => {
  if (!Array.isArray(places) || places.length === 0) {
    throw new Error("partitionIntoDays requires at least one place");
  }
  if (!Number.isInteger(dayCount) || dayCount < 1) {
    throw new Error(
      `partitionIntoDays requires a positive integer dayCount, received ${dayCount}`,
    );
  }
  const locatable = places.filter(isLocatable).sort(byQuality);
  if (locatable.length === 0) {
    throw new Error(
      "partitionIntoDays requires at least one place with coordinates",
    );
  }
  const targetSize = Math.max(stopsPerDay ?? 4, 1);
  const usable = locatable.slice(0, dayCount * targetSize);
  const targetGroups = Math.max(1, Math.min(dayCount, usable.length));
  const chunks = chunkBySize(usable, targetSize);
  const groups = balance(
    agglomerate(chunks, targetGroups, usable),
    usable,
    targetSize,
  );

  while (groups.length < targetGroups) {
    let largestIndex = 0;
    for (let i = 1; i < groups.length; i += 1) {
      const gi = groups[i];
      const gl = groups[largestIndex];
      if (gi && gl && gi.length > gl.length) largestIndex = i;
    }
    const donor = groups[largestIndex];
    if (!donor || donor.length <= 1) break;
    const centre = centroid(
      donor.map((i) => usable[i]).filter((p): p is PartitionPlace => !!p),
    );
    let outlier = donor[0] as number;
    let furthest = -1;
    for (const index of donor) {
      const p = usable[index];
      if (!p) continue;
      const d = centre ? (haversineMeters(locOf(p), centre) ?? 0) : 0;
      if (d > furthest) {
        furthest = d;
        outlier = index;
      }
    }
    donor.splice(donor.indexOf(outlier), 1);
    groups.push([outlier]);
  }

  if (anchor && groups.length > 1) {
    const anchorPoint = locOf(anchor as PartitionPlace);
    groups.sort((a, b) => {
      const ca = centroid(
        a.map((i) => usable[i]).filter((p): p is PartitionPlace => !!p),
      );
      const cb = centroid(
        b.map((i) => usable[i]).filter((p): p is PartitionPlace => !!p),
      );
      return (
        (ca ? (haversineMeters(ca, anchorPoint) ?? Infinity) : Infinity) -
        (cb ? (haversineMeters(cb, anchorPoint) ?? Infinity) : Infinity)
      );
    });
  }

  const days = groups
    .filter((group) => group.length > 0)
    .map((group) =>
      group
        .map((index) => usable[index])
        .filter((p): p is PartitionPlace => !!p)
        .sort(byQuality),
    );

  return {
    days,
    metrics: {
      requestedDays: dayCount,
      actualDays: days.length,
      stopsAvailable: locatable.length,
      stopsUsed: days.flat().length,
      stopsDroppedByPace: locatable.length - usable.length,
      stopsUnlocatable: places.length - locatable.length,
      targetSize,
      sizes: days.map((d) => d.length),
      dayDiameters: days.map((d) => Math.round(diameterMeters(d))),
      distinctPerDay: days.map((d) => new Set(d.map((p) => idOf(p))).size),
    },
  };
};
