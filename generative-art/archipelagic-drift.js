/**
 * ARCHIPELAGIC DRIFT — standalone p5.js generator.
 * Philosophy: ./archipelagic-drift-philosophy.md
 *
 * Travelers released at the edges advect over a precomputed noise flow
 * field bent into gyres around hidden seamount cores. Trails sediment
 * into archipelagos; bathymetric rings are washed in at equilibrium.
 * Seeded (Art Blocks pattern): same seed => identical chart.
 */

/* Tunable world — keep small by design (philosophy §5). */
let params = {
  seed: 12345,
  particleCount: 4200,
  islandCount: 5,
  turbulence: 2.2,   // angle multiplier on the noise field
  flowSpeed: 1.4,    // px advected per substep
  noiseScale: 0.0035,
  trailWeight: 1.0,  // stroke weight of each path segment
  colorPalette: ['#1e3a5f', '#3e8e8c', '#d97757'], // deep, shallow, drift
  paper: '#f4f1e8',
};

const WORLD = 1000;      // square world; CSS scales it responsively
const FIELD_CELL = 10;   // flow-field resolution (100 x 100 grid)
const MAX_STEPS = 320;   // generations until equilibrium
const STEPS_PER_FRAME = 5;
const TRAVELER_LIFE = 220;

let field;        // Float32Array of headings, length fCols*fRows
let fCols, fRows;
let islands = []; // {x, y, radius, strength}
let travelers = [];
let stepCount = 0;
let inkDeep, inkShallow, inkDrift;

function setup() {
  createCanvas(WORLD, WORLD);
  initializeSystem();
}

function initializeSystem() {
  randomSeed(params.seed);
  noiseSeed(params.seed);
  noiseDetail(2, 0.55); // broad swell + fine chop (philosophy §2)

  stepCount = 0;
  inkDeep = color(params.colorPalette[0]);
  inkShallow = color(params.colorPalette[1]);
  inkDrift = color(params.colorPalette[2]);

  seedIslands();
  buildFlowField();
  seedTravelers();

  background(params.paper);
}

function seedIslands() {
  islands = [];
  let guard = 0;
  while (islands.length < params.islandCount && guard++ < 400) {
    const m = WORLD * 0.14;
    const candidate = {
      x: random(m, WORLD - m),
      y: random(m, WORLD - m),
      radius: random(60, 150),
      strength: random(0.7, 1.4),
    };
    // Min separation so archipelagos read as distinct landmasses.
    const ok = islands.every(
      (o) => dist(candidate.x, candidate.y, o.x, o.y) > (candidate.radius + o.radius) * 1.15
    );
    if (ok) islands.push(candidate);
  }
}

/* Master-level optimization: island gyres are baked into the grid once
   per regeneration instead of evaluated per-particle per-step. */
function buildFlowField() {
  fCols = Math.floor(WORLD / FIELD_CELL);
  fRows = Math.floor(WORLD / FIELD_CELL);
  field = new Float32Array(fCols * fRows);
  const z = (params.seed % 1000) * 0.013; // weather offset per seed
  for (let gy = 0; gy < fRows; gy++) {
    for (let gx = 0; gx < fCols; gx++) {
      const x = gx * FIELD_CELL;
      const y = gy * FIELD_CELL;
      let angle = noise(x * params.noiseScale, y * params.noiseScale, z) * TWO_PI * params.turbulence;
      // Bend headings into tangential gyres around each core.
      for (const isl of islands) {
        const dx = x - isl.x;
        const dy = y - isl.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
        const influence = Math.exp(-(d * d) / (2 * isl.radius * isl.radius)) * isl.strength;
        const tangent = Math.atan2(dy, dx) + HALF_PI;
        angle = lerpAngle(angle, tangent, Math.min(0.85, influence));
      }
      field[gy * fCols + gx] = angle;
    }
  }
}

function lerpAngle(a, b, t) {
  let d = (b - a) % TWO_PI;
  if (d > PI) d -= TWO_PI;
  if (d < -PI) d += TWO_PI;
  return a + d * t;
}

function fieldAngle(x, y) {
  const gx = constrain(Math.floor(x / FIELD_CELL), 0, fCols - 1);
  const gy = constrain(Math.floor(y / FIELD_CELL), 0, fRows - 1);
  return field[gy * fCols + gx];
}

function seedTravelers() {
  travelers = [];
  for (let i = 0; i < params.particleCount; i++) travelers.push(spawnTraveler());
}

function spawnTraveler() {
  // Born at a random edge, like a ship appearing on the horizon.
  const edge = Math.floor(random(4));
  const t = random(WORLD);
  const m = 4;
  let x, y;
  if (edge === 0) { x = t; y = m; }
  else if (edge === 1) { x = t; y = WORLD - m; }
  else if (edge === 2) { x = m; y = t; }
  else { x = WORLD - m; y = t; }
  return { x, y, px: x, py: y, life: Math.floor(random(TRAVELER_LIFE * 0.4, TRAVELER_LIFE)) };
}

function draw() {
  for (let s = 0; s < STEPS_PER_FRAME && stepCount < MAX_STEPS; s++) {
    advectTravelers();
    stepCount++;
  }
  if (stepCount >= MAX_STEPS) {
    washBathymetry(); // the only direct mark; everything else sedimented
    noLoop();
  }
}

function advectTravelers() {
  for (let i = 0; i < travelers.length; i++) {
    const t = travelers[i];
    t.px = t.x;
    t.py = t.y;
    const a = fieldAngle(t.x, t.y);
    t.x += Math.cos(a) * params.flowSpeed;
    t.y += Math.sin(a) * params.flowSpeed;
    t.life--;

    // Speed => meaning: swift crossings thin and bright, gyre circlings dark.
    const speedN = constrain(params.flowSpeed / 3, 0, 1);
    let ink;
    if (speedN < 0.5) ink = lerpColor(inkDeep, inkShallow, speedN * 2);
    else ink = lerpColor(inkShallow, inkDrift, (speedN - 0.5) * 2);

    // Slow travelers near a core lay heavier sediment (grounding).
    let grounding = 0;
    for (const isl of islands) {
      const d = dist(t.x, t.y, isl.x, isl.y);
      if (d < isl.radius) { grounding = 1 - d / isl.radius; break; }
    }
    const alpha = 10 + speedN * 10 + grounding * 22;
    stroke(red(ink), green(ink), blue(ink), alpha);
    strokeWeight(params.trailWeight * (0.6 + grounding * 0.8));
    line(t.px, t.py, t.x, t.y);

    const beached = t.x < 0 || t.x > WORLD || t.y < 0 || t.y > WORLD || t.life <= 0;
    if (beached) travelers[i] = spawnTraveler();
  }
}

/* Faint depth rings around each core, washed in once at equilibrium. */
function washBathymetry() {
  noFill();
  for (const isl of islands) {
    for (let r = isl.radius * 0.45; r < isl.radius * 1.9; r += 13) {
      stroke(red(inkShallow), green(inkShallow), blue(inkShallow), 16);
      strokeWeight(1);
      circle(isl.x, isl.y, r * 2);
    }
    // Island heart: one dark breath of sediment.
    noStroke();
    fill(red(inkDeep), green(inkDeep), blue(inkDeep), 26);
    circle(isl.x, isl.y, isl.radius * 0.55);
  }
}

function exportImage() {
  saveCanvas('archipelagic-drift-' + params.seed, 'png');
}
