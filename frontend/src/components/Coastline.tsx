'use client';

/**
 * Coastline — the turnstile's cut, and the only shape on this surface.
 *
 * The landing supplement already draws an irregular seam where the photograph
 * meets the paper: one authored path stretched full-bleed, so its swell stays a
 * fraction of the viewport at any width. Here the same device does layout work
 * instead of decoration. It is the boundary between the lobe that carries the
 * form and the bare ground that carries what an account holds.
 *
 * Both paths are authored in the same `0 0 100 900` user space, because
 * `preserveAspectRatio="none"` maps that space onto whatever box the coast is
 * given. The orientation follows the box rather than a transform: the wide layout
 * runs the path down its 88px column, the narrow layout runs one across the 56px
 * band. A rotated path would degenerate into a diagonal, so the narrow layout gets
 * its own curve.
 *
 * Amplitude is the part that had to be re-authored per orientation, because
 * `none` scales each axis independently and the same numbers land at wildly
 * different sizes in an 88×990 box and a 390×56 one. Both paths below are measured,
 * not guessed: the wide cut swings about 60px across its column, the narrow cut
 * about 20px across its band.
 *
 * The low ground is hatched in CSS, the way `ContourRoute` hatches water; the SVG
 * draws only the coastline, as the edge stroke. The landing's fold gradient is
 * deliberately absent — it belongs to a real join between two materials, and over
 * a hatch it only softened the edge into a blur.
 */

// Wide: the 88px middle column, running top to bottom. x carries a ~56-unit
// swing, which the column's ~1:1 vertical scale renders as ~56px of undulation.
const WIDE =
  'M 0 0 C 26 46, 62 34, 50 96 C 36 168, 70 214, 58 300 C 46 386, 82 428, 70 520 C 58 612, 88 660, 74 748 C 62 826, 30 856, 0 900';

// Narrow: the 56px band, running left to right. Here y carries the swing, and
// `none` squashes the full 900-unit y-range into those 56px — so a swing authored
// across 0–900 renders as a real undulation in the band. Two crests and two
// troughs across the width; the ends sit high and low so the band stays whole.
const NARROW =
  'M 0 620 C 6 240, 14 210, 20 470 C 26 730, 34 760, 40 430 C 46 190, 54 200, 60 500 C 66 790, 74 820, 80 480 C 86 230, 94 240, 100 560';

const Coastline = () => (
  <div className="tt-coast" aria-hidden="true">
    <svg
      className="tt-coast__svg"
      viewBox="0 0 100 900"
      preserveAspectRatio="none"
      focusable="false"
    >
      {/* The wide layout's cut, running down the column. */}
      <path
        className="tt-coast__edge tt-coast__edge--wide"
        d={WIDE}
        fill="none"
        stroke="var(--tt-ink)"
        strokeOpacity="0.34"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* The narrow layout's cut, the same divide lying down. */}
      <path
        className="tt-coast__edge tt-coast__edge--narrow"
        d={NARROW}
        fill="none"
        stroke="var(--tt-ink)"
        strokeOpacity="0.34"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  </div>
);

export default Coastline;
