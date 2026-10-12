"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ContourRoute from '@/components/ContourRoute';
import { onMapsReady } from '@/lib/maps';
import { storeSeed } from '@/lib/nav';
import type { MapsAutocomplete } from '@/lib/maps';

/* ─────────────────────────────────────────────────────────────────────────
   Icons — drawn, one consistent stroke and weight. No glyph standing in
   for an icon system anywhere on this page.
   ───────────────────────────────────────────────────────────────────────── */

const IconRoute = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 19c3.5 0 3.5-4 7-4s3.5-4 7-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="4" cy="19" r="2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="20" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconMeals = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 3v8a2.5 2.5 0 0 0 5 0V3M7.5 11v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M16 3c-1.5 1.5-2 3.5-2 6s1 4 2 4 2-1.5 2-4-.5-4.5-2-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M16 13v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconBudget = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="16.5" cy="14.5" r="1.75" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconArrow = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ───────────────────────────────────────────────────────────────────────── */

// The CSS media query cannot reach JS-initiated motion, so the preference is
// read here too.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
};

// Ordered exactly as the form asks for them, so the numbered run describes
// the sheet the visitor is actually looking at below it.
const STEPS = [
  {
    n: '01',
    title: 'Name the destination',
    body: 'Tell us where you are going. The city sets the route, and the route sets everything downstream of it.',
  },
  {
    n: '02',
    title: 'Give us the days',
    body: 'How long you actually have. This is the constraint that decides what fits and what has to wait for next time.',
  },
  {
    n: '03',
    title: 'Set the budget',
    body: 'What the whole trip can cost. Not a per-day figure — the real number, in rupees, that you are accountable for.',
  },
];

const CARE_ROWS = [
  {
    Icon: IconRoute,
    title: 'A route, in order',
    body: 'Day by day, the stops are sequenced so one leads into the next rather than sending you back across the city.',
  },
  {
    Icon: IconMeals,
    title: 'Meals near the stops',
    body: 'Breakfast, lunch and dinner are picked where you will already be, not in a different district at midday.',
  },
  {
    Icon: IconBudget,
    title: 'Hotels inside the budget',
    body: 'A shortlist that respects the figure you gave us, with the prices the plan was built from.',
  },
];

const Hero = () => {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);

  // The map is a live read of what the visitor has typed. Real state, not a loop.
  const [city, setCity] = useState('');
  const [days, setDays] = useState('');
  const [budget, setBudget] = useState('');

  // `.vl-js` gates the hidden pre-reveal state so no-JS readers never stare
  // at blanks; `heroReady` fires the first-viewport line masks on load.
  const [js, setJs] = useState(false);
  const [heroReady, setHeroReady] = useState(false);

  const cityRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<MapsAutocomplete | null>(null);

  useEffect(() => {
    setJs(true);
    const frame = requestAnimationFrame(() => setHeroReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Bound once: the closure runs later, when React's narrowing of
    // `cityRef.current` no longer applies.
    const input = cityRef.current;
    if (!input) return;
    let cancelled = false;

    // @/lib/maps owns readiness now (loading=async defers execution). If the
    // API is already up the hook fires immediately; a late arrival calls
    // through the same path. No polling, no timeout race.
    const init = () => {
      if (cancelled || autocompleteRef.current) return;
      if (!window.google?.maps?.places) return;
      try {
        const ac = new window.google.maps.places.Autocomplete(input, {
          types: ['(cities)'],
          fields: ['name', 'place_id'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (place?.name) setCity(place.name);
        });
        autocompleteRef.current = ac;
      } catch (error) {
        console.error('Places Autocomplete unavailable:', error);
      }
    };

    const off = onMapsReady(init);

    return () => {
      cancelled = true;
      off();
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  // One observer for every reveal on the page; each element fires once.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      root?.querySelectorAll('.vl-rv').forEach((el) => el.classList.add('is-in'));
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            seen.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' },
    );
    root.querySelectorAll('.vl-rv').forEach((el) => seen.observe(el));
    return () => seen.disconnect();
  }, [js]);

  // One rAF-throttled scroll listener drives every parallax plate. Each plate
  // declares its speed in `data-plx`; the image headroom (scale ≥ 1.1) means
  // the travel never exposes an edge.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      rootRef.current?.querySelectorAll<HTMLElement>('[data-plx]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        const speed = Number(el.dataset.plx) || 0.08;
        const drift = (rect.top + rect.height / 2 - vh / 2) * speed;
        const clamped = Math.max(-140, Math.min(140, drift));
        el.style.setProperty('--plx', `${(-clamped).toFixed(1)}px`);
      });
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [js]);

  // Validate explicitly: min/max attributes alone never fire on a noValidate
  // form, so days=999 would otherwise sail through to the planner.
  const dayNum = Number(days);
  const budgetNum = Number(budget);
  const cityOk = city.trim().length > 1;
  const daysOk = Number.isFinite(dayNum) && dayNum >= 1 && dayNum <= 60;
  const budgetOk = Number.isFinite(budgetNum) && budgetNum >= 1000;
  const ready = cityOk && daysOk && budgetOk;

  // Names the specific field and the recovery, instead of "fill everything".
  const needText = !cityOk
    ? 'Name the city you are planning for.'
    : !daysOk
      ? `Enter how many days — between 1 and 60.`
      : !budgetOk
        ? 'Enter a total budget of at least ₹1,000.'
        : '';

  const focusCity = () => {
    // Scroll first: focusing before the scroll lands keyboard focus on a
    // field that is then moved out of view. `preventScroll` keeps the browser
    // from undoing it a frame later.
    scrollToId('plan');
    window.setTimeout(() => {
      document.getElementById('vl-city')?.focus({ preventScroll: true });
    }, prefersReducedMotion() ? 0 : 450);
  };

  return (
    <main ref={rootRef} className={`vl${js ? ' vl-js' : ''}`}>
      {/* ── Hero. Full-bleed coast, bottom-left thesis. ─────────────────── */}
      <section className={`vl-hero${heroReady ? ' is-ready' : ''}`} aria-labelledby="vl-hero-title">
        <div className="vl-hero__media" data-plx="0.1" aria-hidden="true">
          <img
            src="/landing/landing-pier.webp"
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="vl-hero__scrim" aria-hidden="true" />
        <div className="vl-rail vl-hero__inner">
          <p className="vl-hero__ref">
            <span>TripTribe — TT / Route</span>
            <span>City · Days · Budget</span>
          </p>
          <h1 id="vl-hero-title" className="vl-hero__title">
            <span className="vl-mask">
              <span style={{ ['--rvd' as string]: '0.15s' }}>A trip is a route,</span>
            </span>
            <span className="vl-mask">
              <span style={{ ['--rvd' as string]: '0.3s' }}>
                <em>not a list.</em>
              </span>
            </span>
          </h1>
          <p className="vl-hero__lede">
            Most itinerary generators hand you a pile of famous places and leave you to
            work out the order. TripTribe sequences the day instead — each stop placed so
            the next one leads from it — and picks your meals where you will already be.
          </p>
          <div className="vl-hero__actions">
            <button type="button" className="vl-btn vl-btn--solid" onClick={focusCity}>
              <span>Plan a trip</span>
              <IconArrow size={18} />
            </button>
            <button type="button" className="vl-btn vl-btn--ghost" onClick={() => scrollToId('route')}>
              <span>What comes back</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Intro. Centred statement, then a plate pair. ────────────────── */}
      <section className="vl-intro" aria-labelledby="vl-intro-title">
        <div className="vl-rail">
          <div className="vl-folio vl-rv">
            <span>TT / Orientation</span>
            <span>The whole argument, before the detail</span>
          </div>
          <h2 id="vl-intro-title" className="vl-intro__statement vl-rv">
            Planned around the order you will walk it,{' '}
            <em>priced against the money you have.</em>
          </h2>
          <div className="vl-intro__pair">
            <figure className="vl-plate vl-rv">
              <div className="vl-plate__frame vl-plate__frame--std" data-plx="0.06">
                <img
                  src="/landing/landing-city-rooftops.webp"
                  alt="Rooftops of an old town in winter light"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>
                <span>The destination, surveyed</span>
                <span>Plate I</span>
              </figcaption>
            </figure>
            <figure className="vl-plate vl-rv" style={{ ['--rvd' as string]: '0.12s' }}>
              <div className="vl-plate__frame vl-plate__frame--std" data-plx="0.06">
                <img
                  src="/landing/landing-route-canal.webp"
                  alt="A canal running between old city buildings"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>
                <span>The order, before the places</span>
                <span>Plate II</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── Bands. One plate and one argument each, alternating. ────────── */}
      <section className="vl-bands" id="route" aria-label="What the plan holds">
        <div className="vl-rail">
          <div className="vl-folio vl-rv">
            <span>TT / The stay</span>
            <span>Three plates, three promises</span>
          </div>

          <div className="vl-band">
            <div className="vl-band__grid">
              <div className="vl-band__copy vl-rv">
                <p className="vl-band__index">Noches — 01 · The sequence</p>
                <h2 className="vl-band__title">
                  Days that walk <em>in order.</em>
                </h2>
                <p className="vl-band__body">
                  Day by day, the stops are sequenced so one leads into the next rather
                  than sending you back across the city. The route is drawn first; the
                  famous places slot into it.
                </p>
                <button type="button" className="vl-band__link" onClick={focusCity}>
                  <span>Start this route</span>
                  <IconArrow size={16} />
                </button>
              </div>
              <figure className="vl-plate vl-band__media vl-rv" style={{ ['--rvd' as string]: '0.1s' }}>
                <div className="vl-plate__frame vl-plate__frame--tall" data-plx="0.07">
                  <img
                    src="/landing/landing-street.webp"
                    alt="A city street lined with tall trees and towers"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span>One route, walked end to end</span>
                  <span>Plate III</span>
                </figcaption>
              </figure>
            </div>
          </div>

          <div className="vl-band vl-band--flip">
            <div className="vl-band__grid">
              <div className="vl-band__copy vl-rv">
                <p className="vl-band__index">Luma — 02 · The table</p>
                <h2 className="vl-band__title">
                  Meals where you <em>already are.</em>
                </h2>
                <p className="vl-band__body">
                  Breakfast, lunch and dinner are picked near the day&apos;s stops — not in
                  a different district at midday. Hunger never reroutes the afternoon.
                </p>
                <button type="button" className="vl-band__link" onClick={focusCity}>
                  <span>Start this route</span>
                  <IconArrow size={16} />
                </button>
              </div>
              <figure className="vl-plate vl-band__media vl-rv" style={{ ['--rvd' as string]: '0.1s' }}>
                <div className="vl-plate__frame vl-plate__frame--tall" data-plx="0.07">
                  <img
                    src="/landing/landing-table.webp"
                    alt="A cup of raspberries on a table, dessert after a long walk"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span>Dinner near the last stop</span>
                  <span>Plate IV</span>
                </figcaption>
              </figure>
            </div>
          </div>

          <div className="vl-band">
            <div className="vl-band__grid">
              <div className="vl-band__copy vl-rv">
                <p className="vl-band__index">Aya — 03 · The ledger</p>
                <h2 className="vl-band__title">
                  Hotels inside <em>the budget.</em>
                </h2>
                <p className="vl-band__body">
                  A shortlist that respects the figure you gave us, with the prices the
                  plan was built from. The number you typed governs the result — including
                  when it is too small, in which case the plan says so plainly.
                </p>
                <p className="vl-band__note">
                  Hotel prices are generated estimates, not live availability. Check fares
                  with the operator before you book.
                </p>
                <button type="button" className="vl-band__link" onClick={focusCity}>
                  <span>Start this route</span>
                  <IconArrow size={16} />
                </button>
              </div>
              <figure className="vl-plate vl-band__media vl-rv" style={{ ['--rvd' as string]: '0.1s' }}>
                <div className="vl-plate__frame vl-plate__frame--tall" data-plx="0.07">
                  <img
                    src="/landing/landing-road-van.webp"
                    alt="A camper van ready for a road trip"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span>The road, costed honestly</span>
                  <span>Plate V</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ── Field. Full-bleed interlude over the pier. ──────────────────── */}
      <section className="vl-field" aria-labelledby="vl-field-title">
        <div className="vl-field__media" data-plx="0.12" aria-hidden="true">
          <img
            src="/landing/landing-avenue.webp"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="vl-field__scrim" aria-hidden="true" />
        <div className="vl-rail vl-field__inner">
          <div className="vl-folio vl-folio--dark vl-rv">
            <span>TT / Elsewhere</span>
            <span>The awaiting part</span>
          </div>
          <h2 id="vl-field-title" className="vl-field__quote vl-rv">
            Between the city&apos;s noise and a dozen possible orders,{' '}
            <em>the walkable day awaits.</em>
          </h2>
          <div className="vl-field__actions vl-rv">
            <button type="button" className="vl-btn vl-btn--ghost" onClick={focusCity}>
              <span>Discover the planner</span>
              <IconArrow size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Care. The concierge band. ───────────────────────────────────── */}
      <section className="vl-care" aria-labelledby="vl-care-title">
        <div className="vl-rail">
          <div className="vl-folio vl-rv">
            <span>TT / The care</span>
            <span>Handled, not listed</span>
          </div>
          <h2 id="vl-care-title" className="vl-care__title vl-rv">
            Sit back and relax — <em>the sequencing is handled.</em>
          </h2>
          <div className="vl-care__grid">
            <div className="vl-rv">
              <ul className="vl-care__rows">
                {CARE_ROWS.map(({ Icon, title, body }) => (
                  <li className="vl-care__row" key={title}>
                    <span className="vl-care__icon">
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="vl-care__name">{title}</h3>
                      <p className="vl-care__body">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="vl-care__actions">
                <button type="button" className="vl-btn vl-btn--dark" onClick={focusCity}>
                  <span>Discover the planner</span>
                  <IconArrow size={18} />
                </button>
              </div>
            </div>
            <div className="vl-care__media">
              <figure className="vl-plate vl-rv" style={{ ['--rvd' as string]: '0.1s' }}>
                <div className="vl-plate__frame vl-plate__frame--wide" data-plx="0.06">
                  <img
                    src="/landing/landing-lamps.webp"
                    alt="Street lamps glowing on a snowy night"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span>Evenings, accounted for</span>
                  <span>Plate VI</span>
                </figcaption>
              </figure>
              <figure className="vl-plate vl-rv" style={{ ['--rvd' as string]: '0.18s' }}>
                <div className="vl-plate__frame vl-plate__frame--std" data-plx="0.06">
                  <img
                    src="/landing/landing-mug.webp"
                    alt="A coffee mug with a travel illustration"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span>Mornings, near the first stop</span>
                  <span>Plate VII</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ── Plan. The close: getaway line, numbered run, live sheet. ────── */}
      <section className="vl-plan" id="plan" aria-labelledby="vl-plan-title">
        <div className="vl-rail">
          <div className="vl-folio vl-rv">
            <span>TT / The close</span>
            <span>Three inputs, one route</span>
          </div>
          <h2 id="vl-plan-title" className="vl-plan__title vl-rv">
            Begin your <em>dream getaway.</em>
          </h2>

          <ol className="vl-plan__run">
            {STEPS.map((step, i) => (
              <li key={step.n} className="vl-rv" style={{ ['--rvd' as string]: `${i * 0.1}s` }}>
                <span className="vl-plan__n">{step.n}</span>
                <h3 className="vl-plan__name">{step.title}</h3>
                <p className="vl-plan__body">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="vl-plan__sheet vl-rv">
            <form
              className="vl-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ready) return;
                // Carry the three inputs forward: the visitor must never
                // retype what they just told us.
                storeSeed({
                  cityName: city.trim(),
                  days: String(dayNum),
                  budget: String(budgetNum),
                });
                router.push('/plan');
              }}
              noValidate
            >
              <div className="vl-field-row">
                <label className="vl-label" htmlFor="vl-city">
                  City
                </label>
                <input
                  id="vl-city"
                  ref={cityRef}
                  className="vl-input"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Where are you going?"
                  autoComplete="off"
                  aria-describedby="vl-city-hint"
                />
                <p className="vl-hint" id="vl-city-hint">
                  Start typing; suggestions appear as you go.
                </p>
              </div>

              <div className="vl-field-row">
                <label className="vl-label" htmlFor="vl-days">
                  Days
                </label>
                <input
                  id="vl-days"
                  className="vl-input"
                  type="number"
                  min="1"
                  max="60"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="4"
                  aria-invalid={days !== '' && !daysOk}
                  aria-describedby={days !== '' && !daysOk ? 'vl-days-error' : undefined}
                />
                {days !== '' && !daysOk && (
                  <p className="vl-error" id="vl-days-error" role="alert">
                    Between 1 and 60 days.
                  </p>
                )}
              </div>

              <div className="vl-field-row">
                <label className="vl-label" htmlFor="vl-budget">
                  Total budget
                </label>
                <div className="vl-affix">
                  <span className="vl-currency" aria-hidden="true">
                    ₹
                  </span>
                  <input
                    id="vl-budget"
                    className="vl-input--affixed"
                    type="number"
                    min="1000"
                    step="100"
                    inputMode="numeric"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="48000"
                    aria-invalid={budget !== '' && !budgetOk}
                    aria-describedby={
                      budget !== '' && !budgetOk ? 'vl-budget-error' : 'vl-budget-hint'
                    }
                  />
                </div>
                {budget !== '' && !budgetOk ? (
                  <p className="vl-error" id="vl-budget-error" role="alert">
                    At least ₹1,000.
                  </p>
                ) : (
                  <p className="vl-hint" id="vl-budget-hint">
                    For the whole trip, not per day.
                  </p>
                )}
              </div>

              <div className="vl-form__action">
                <button type="submit" className="vl-btn vl-btn--ink" disabled={!ready}>
                  <span>Generate the route</span>
                  <IconArrow size={18} />
                </button>
                {/* Announced in reading order, not stranded on a disabled
                    control that keyboard users can never reach. */}
                <p className="vl-need" role="status">
                  {needText}
                </p>
              </div>
            </form>

            <figure className="vl-plan__map">
              <div className="vl-map__frame">
                <ContourRoute
                  city={city.trim()}
                  days={Number(days) || 0}
                  budget={Number(budget) || 0}
                />
              </div>
            </figure>
          </div>

          <p className="vl-plan__fine">
            Itineraries, hotel shortlists and prices are generated estimates. Check
            availability and fares with the operator before you book.
          </p>
        </div>
      </section>
    </main>
  );
};

export default Hero;
