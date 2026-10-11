import "server-only";
import {
  estimateTravelMinutes,
  haversineMeters,
} from "@/server/domain/solver/geo";
import type { GeoPoint, Place, TravelMode } from "@/server/domain/types";

/**
 * Order the stops within one day.
 * Ported from `backend/solver/sequence.js` — algorithm unchanged:
 * nearest-neighbour seed, then 2-opt to a local optimum, then Or-opt
 * (relocate single stops and short segments) to escape 2-opt's weakness
 * of being unable to move a lone vertex.
 */

type SequencePlace = Place & { placeId?: string };

const locOf = (place: SequencePlace | GeoPoint): GeoPoint =>
  (place as Place)?.location ?? (place as GeoPoint);

export const legMinutes = (
  a: SequencePlace | GeoPoint,
  b: SequencePlace | GeoPoint,
  mode: TravelMode,
): number | null => estimateTravelMinutes(locOf(a), locOf(b), { mode });

export interface PathOptions {
  mode?: TravelMode;
  anchor?: GeoPoint | null;
}

export const pathMinutes = (
  ordered: readonly (SequencePlace | GeoPoint)[],
  { mode = "WALK", anchor = null }: PathOptions = {},
): number => {
  if (!Array.isArray(ordered) || ordered.length === 0) return 0;
  let total = 0;
  if (anchor) {
    const first = ordered[0];
    if (first) total += legMinutes(anchor, first, mode) ?? 0;
  }
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (prev && cur) total += legMinutes(prev, cur, mode) ?? 0;
  }
  if (anchor) {
    const last = ordered[ordered.length - 1];
    if (last) total += legMinutes(last, anchor, mode) ?? 0;
  }
  return total;
};

export const nearestNeighbour = (
  places: readonly SequencePlace[],
  { mode = "WALK", anchor = null }: PathOptions = {},
): SequencePlace[] => {
  if (!Array.isArray(places) || places.length === 0) return [];
  const remaining: number[] = places.map((_, i) => i);
  const ordered: SequencePlace[] = [];
  let current: SequencePlace | null = null;
  if (anchor) {
    let best = 0;
    let bestDistance = Infinity;
    remaining.forEach((index, position) => {
      const p = places[index];
      if (!p) return;
      const d = legMinutes(anchor, p, mode) ?? Infinity;
      if (d < bestDistance) {
        bestDistance = d;
        best = position;
      }
    });
    const first = places[remaining[best] as number];
    if (first) {
      current = first;
      ordered.push(first);
      remaining.splice(best, 1);
    }
  }
  while (remaining.length > 0) {
    // `from` is the stop we are standing at, or the first remaining place when
    // there is no current position yet. Null-safe: a sparse index yields
    // undefined, which used to reach `legMinutes` and throw.
    const from: SequencePlace | undefined =
      current ?? places[remaining[0] as number];
    if (!from) break;
    let bestDistance = Infinity;
    let bestPosition = 0;
    remaining.forEach((index, position) => {
      const p = places[index];
      if (!p) return;
      const d = legMinutes(from, p, mode) ?? Infinity;
      if (d < bestDistance) {
        bestDistance = d;
        bestPosition = position;
      }
    });
    const next = places[remaining[bestPosition] as number];
    if (!next) break;
    current = next;
    ordered.push(next);
    remaining.splice(bestPosition, 1);
  }
  return ordered;
};

export interface ImproveOptions extends PathOptions {
  maxPasses?: number;
}

export const twoOpt = (
  ordered: readonly SequencePlace[],
  { mode = "WALK", anchor = null, maxPasses = 50 }: ImproveOptions = {},
): SequencePlace[] => {
  if (!Array.isArray(ordered) || ordered.length < 3)
    return [...(ordered ?? [])];
  let best = [...ordered];
  let bestCost = pathMinutes(best, { mode, anchor });
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let improvedThisPass = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const cost = pathMinutes(candidate, { mode, anchor });
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

export const orOpt = (
  ordered: readonly SequencePlace[],
  { mode = "WALK", anchor = null, maxPasses = 20 }: ImproveOptions = {},
): SequencePlace[] => {
  if (!Array.isArray(ordered) || ordered.length < 3)
    return [...(ordered ?? [])];
  let best = [...ordered];
  let bestCost = pathMinutes(best, { mode, anchor });
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let improvedThisPass = false;
    for (let length = 1; length <= 3; length += 1) {
      for (let start = 0; start + length <= best.length; start += 1) {
        const segment = best.slice(start, start + length);
        const remainder = [
          ...best.slice(0, start),
          ...best.slice(start + length),
        ];
        for (let insertAt = 0; insertAt <= remainder.length; insertAt += 1) {
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

export const sequenceDay = (
  places: readonly SequencePlace[],
  { mode = "WALK", anchor = null }: PathOptions = {},
): { order: SequencePlace[]; travelMinutes: number } => {
  if (!Array.isArray(places) || places.length === 0)
    return { order: [], travelMinutes: 0 };
  if (places.length === 1) return { order: [...places], travelMinutes: 0 };
  const seed = nearestNeighbour(places, { mode, anchor });
  const improved = orOpt(twoOpt(seed, { mode, anchor }), { mode, anchor });
  return {
    order: improved,
    travelMinutes: pathMinutes(improved, { mode, anchor }),
  };
};

export const daySpread = (
  places: readonly (SequencePlace | GeoPoint)[],
): number => {
  let worst = 0;
  for (let i = 0; i < places.length; i += 1) {
    for (let j = i + 1; j < places.length; j += 1) {
      const a = places[i];
      const b = places[j];
      if (!a || !b) continue;
      const d = haversineMeters(locOf(a), locOf(b));
      if (d !== null && d > worst) worst = d;
    }
  }
  return worst;
};
