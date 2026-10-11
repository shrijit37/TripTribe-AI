/**
 * ContourRoute — the surface's thesis, drawn rather than described.
 *
 * A hypsometric map: contour bands stepping from the coast inland, with a
 * single prussian route threading them from a marked origin to a marked
 * terminus. The route is the trip. The bands are the day accumulating.
 *
 * When the visitor enters a city, the route redraws to reach it. This is the
 * product's one real mechanic shown before a word of copy is read, so the
 * drawing is driven by actual state, not by a timer.
 */

const ORIGIN = { x: 62, y: 288 };
// The route climbs from the low ground at the origin, across the massif,
// to the far ridge — direction of travel as a literal axis.
const ROUTE = [
  [62, 288],
  [110, 274],
  [158, 254],
  [204, 238],
  [246, 216],
  [292, 200],
  [340, 178],
  [386, 162],
  [430, 140],
  [478, 126],
  [528, 104],
  [586, 88],
];

/**
 * Radial terrain profile for one band. Superimposed harmonics give a
 * ridge-and-valley outline instead of an ellipse. The same profile is reused
 * by every band at a different radius, so the bands are scaled copies of one
 * landform rather than four unrelated blobs.
 */
const radiusAt = (a, scale, phase) =>
  scale *
  (1 +
    0.26 * Math.sin(a * 2 + phase) +
    0.15 * Math.sin(a * 3 - phase * 0.6) +
    0.09 * Math.sin(a * 5 + phase * 1.4) +
    0.05 * Math.sin(a * 8 - phase * 0.3));

// One phase for every band. Per-band phases made each outline a different
// shape, and differently-shaped outlines cross.
const PHASE = 0.7;

/**
 * One closed contour band, as a smooth closed spline (Catmull-Rom → cubic
 * Bézier).
 *
 * Nesting is guaranteed by construction, not by eye: every band shares one
 * centre, one phase and one squash, and differs only in radius. Giving each
 * band its own phase and centre made them differently-*shaped* outlines that
 * crossed each other — 11.8% of the innermost band's perimeter sat outside
 * the next one out, which reads as a pinwheel rather than terrain.
 */
const bandPath = (index) => {
  // The massif fills the sheet: the outermost band nearly spans it, so the
  // route crosses real terrain instead of flying over empty paper.
  const scale = 118 + index * 44;
  const cx = 330;
  const cy = 186;
  const squash = 0.66;
  const steps = 40;
  const pts = [];

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = radiusAt(a, scale, PHASE);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash]);
  }

  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < steps; i++) {
    const p0 = pts[(i - 1 + steps) % steps];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % steps];
    const p3 = pts[(i + 2) % steps];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
};

// Outermost first: a tint scale only nests when each band paints over the
// lighter one beneath it.
const BANDS = [3, 2, 1, 0].map((index) => ({
  index,
  d: bandPath(index),
  fill: `var(--tt-band-${index + 1})`,
}));

/**
 * Spot heights, each verified against the band polygons actually generated
 * above: 214 and 347 sit in band 0 (lightest), then 482 in band 1, 611 in
 * band 2 and 728 in band 3 (darkest). The reading is monotonic
 * non-decreasing, which is what a hypsometric scale promises. An earlier set
 * put 728 outside the massif entirely and 482 in the lightest band, teaching
 * the reader the scale backwards.
 */
const SPOTS = [
  { x: 299, y: 223, v: '214' },
  { x: 347, y: 250, v: '347' },
  { x: 218, y: 139, v: '482' },
  { x: 440, y: 295, v: '611' },
  { x: 521, y: 151, v: '728' },
];

/** The route re-terminates at the terminus the visitor's city implies. */
const routeFor = (reach) => {
  if (!reach) return ROUTE;
  return [...ROUTE.slice(0, ROUTE.length - 2), reach];
};

const ContourRoute = ({ city, days, budget }) => {
  const hasTrip = Boolean(city);
  // The destination sets where the route ends: more days carries it further
  // along the ridge, a larger budget lifts the terminus higher up it.
  //
  // Both channels are normalised log ramps pinned to the ends of their real
  // range, so every value a traveller actually types moves the terminus. The
  // earlier clamped curve saturated at ₹5,000 and rendered every budget above
  // it identically — the exact figure the organiser is most accountable for,
  // shown as dead.
  //
  // The ramp is then clamped to [0,1] so an absurd input cannot walk the
  // marker off the sheet: unbounded, a ₹23.9 crore budget pushed y past 0 and
  // the terminus left the map entirely. The clamp is a guard rail, not the
  // encoding — inside the pinned range it is never reached.
  const RAMP = (v, min, max) =>
    Math.min(1, Math.max(0, (Math.log10(Math.max(v, min)) - Math.log10(min)) /
      (Math.log10(max) - Math.log10(min))));
  const terminus = hasTrip
    ? [
        452 + RAMP(days, 1, 60) * 134,
        152 - RAMP(budget, 1000, 300000) * 70,
      ]
    : null;
  const route = terminus ? routeFor(terminus) : ROUTE;

  const path = route
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(' ');

  const end = route[route.length - 1];

  // The figure is labelled by its caption; the SVG names the same caption,
  // so a screen reader hears the sentence once rather than twice.
  return (
    <figure className="tt-map">
      <svg
        className="tt-map__svg"
        viewBox="0 0 660 340"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        aria-labelledby="tt-map-caption"
      >
        <defs>
          <pattern
            id="tt-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--tt-ink)" strokeOpacity="0.07" strokeWidth="1" />
          </pattern>
          <filter id="tt-seam-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>

        {/* Ground: the stock itself, hatched below the waterline. */}
        <rect width="660" height="340" fill="var(--tt-paper)" />
        <path
          d="M 0 306 C 150 292, 320 316, 486 300 C 578 291, 622 304, 660 297 L 660 340 L 0 340 Z"
          fill="url(#tt-hatch)"
        />

        {/* Contour bands, outermost first so the tint scale nests. */}
        <g filter="url(#tt-seam-soft)">
          {BANDS.map((b) => (
            <path key={b.index} d={b.d} fill={b.fill} />
          ))}
        </g>

        {/* Band edges: the contour lines themselves, hairline. */}
        <g fill="none" stroke="var(--tt-ink)" strokeOpacity="0.22" strokeWidth="0.75">
          {BANDS.map((b) => (
            <path key={b.index} d={b.d} />
          ))}
        </g>

        {/* Spot heights: measurement, set in the measuring face. */}
        <g
          fill="var(--tt-ink-map)"
          fontFamily="var(--tt-face-data)"
          fontSize="7.5"
          letterSpacing="0.06em"
        >
          {SPOTS.map((s) => (
            <text key={s.v + s.x} x={s.x} y={s.y}>
              {s.v}
            </text>
          ))}
        </g>

        {/* The route. One prussian stroke, drawn on for the destination. */}
        <path
          d={path}
          fill="none"
          stroke="var(--tt-prussian)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={hasTrip ? 'tt-map__route tt-map__route--drawn' : 'tt-map__route'}
          pathLength="1"
        />

        {/* Origin: where the trip starts, always shown. */}
        <g>
          <circle cx={ORIGIN.x} cy={ORIGIN.y} r="9" fill="var(--tt-paper)" />
          <circle cx={ORIGIN.x} cy={ORIGIN.y} r="6.5" fill="none" stroke="var(--tt-ink)" strokeWidth="1.5" />
          <circle cx={ORIGIN.x} cy={ORIGIN.y} r="2.5" fill="var(--tt-ink)" />
          <text
            x={ORIGIN.x + 16}
            y={ORIGIN.y + 4}
            fill="var(--tt-ink)"
            fontFamily="var(--tt-face-data)"
            fontSize="8"
            letterSpacing="0.1em"
          >
            ORIGIN
          </text>
        </g>

        {/* Terminus: the city. Absent until the visitor names one. */}
        {hasTrip && (
          <g className="tt-map__terminus">
            <circle cx={end[0]} cy={end[1]} r="13" fill="var(--tt-prussian)" fillOpacity="0.12" />
            <circle cx={end[0]} cy={end[1]} r="6" fill="var(--tt-prussian)" />
            <circle cx={end[0]} cy={end[1]} r="2" fill="var(--tt-paper)" />
            <text
              x={end[0] - 14}
              y={end[1] - 18}
              textAnchor="middle"
              fill="var(--tt-prussian-deep)"
              fontFamily="var(--tt-face-data)"
              fontSize="8.5"
              letterSpacing="0.1em"
            >
              {city.toUpperCase()}
            </text>
          </g>
        )}

        {/* Marginalia: the route reads as a printed measurement. */}
        <g fill="var(--tt-ink-map)" fontFamily="var(--tt-face-data)" fontSize="7.5" letterSpacing="0.12em">
          <text x="16" y="26">N</text>
          <line x1="16" y1="32" x2="16" y2="52" stroke="var(--tt-ink-map)" strokeWidth="0.75" />
          <polygon points="16,30 13,37 19,37" fill="var(--tt-ink-map)" />
          <text x="16" y="66">SCALE 1:50k</text>
          <line x1="16" y1="74" x2="76" y2="74" stroke="var(--tt-ink)" strokeOpacity="0.4" strokeWidth="0.75" />
          <line x1="16" y1="71" x2="16" y2="77" stroke="var(--tt-ink)" strokeOpacity="0.4" strokeWidth="0.75" />
          <line x1="46" y1="71" x2="46" y2="77" stroke="var(--tt-ink)" strokeOpacity="0.4" strokeWidth="0.75" />
          <line x1="76" y1="71" x2="76" y2="77" stroke="var(--tt-ink)" strokeOpacity="0.4" strokeWidth="0.75" />
        </g>
      </svg>

      <figcaption id="tt-map-caption" className="tt-map__caption">
        {hasTrip ? (
          <>
            <strong>{city}</strong> plotted as a route, not a list of places. Set the
            days and the budget and the terminus moves — further along, and further up.
          </>
        ) : (
          <>
            Every plan TripTribe issues is a route: stops sequenced so one leads to the
            next, meals chosen where you will already be.
          </>
        )}
      </figcaption>
    </figure>
  );
};

export default ContourRoute;