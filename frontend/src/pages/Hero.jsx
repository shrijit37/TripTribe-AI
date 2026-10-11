import { useState, useEffect, useRef } from 'react';
import GridDistortion from '../components/GridDistortion';
import ContourRoute from '../components/ContourRoute';
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────
   Icons — drawn, one consistent stroke and weight. No glyph standing in
   for an icon system anywhere on this page.
   ───────────────────────────────────────────────────────────────────────── */

const IconRoute = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 19c3.5 0 3.5-4 7-4s3.5-4 7-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="4" cy="19" r="2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="20" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconMeals = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 3v8a2.5 2.5 0 0 0 5 0V3M7.5 11v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M16 3c-1.5 1.5-2 3.5-2 6s1 4 2 4 2-1.5 2-4-.5-4.5-2-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M16 13v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconBudget = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="16.5" cy="14.5" r="1.75" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconArrow = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ───────────────────────────────────────────────────────────────────────── */

// The CSS media query cannot reach a JS-initiated smooth scroll, so the
// preference is read here too.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Ordered exactly as the slip asks for them, so the numbered run describes
// the form the visitor is actually looking at above it.
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

const INCLUDED = [
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
  const navigate = useNavigate();

  // The map is a live read of what the visitor has typed. Real state, not a loop.
  const [city, setCity] = useState('');
  const [days, setDays] = useState('');
  const [budget, setBudget] = useState('');

  const cityRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!cityRef.current) return;
    let cancelled = false;
    let attempts = 0;

    const init = () => {
      if (cancelled || autocompleteRef.current) return;
      if (window.google?.maps?.places) {
        try {
          const ac = new window.google.maps.places.Autocomplete(cityRef.current, {
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
        return;
      }
      // Bounded retry — never an unbounded timer.
      if (attempts++ < 20) window.setTimeout(init, 500);
    };

    init();
    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

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

  return (
    <>
      <Helmet>
        <title>TripTribe — A trip is a route, not a list</title>
        <meta
          name="description"
          content="Give TripTribe a city, a budget and a number of days. It returns a full itinerary sequenced so each stop leads to the next, with meals and hotel prices built around the figure you set."
        />
        <meta property="og:title" content="TripTribe — A trip is a route, not a list" />
        <meta
          property="og:description"
          content="AI-generated personalized travel itineraries."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="tt-page">
        {/* ── The photograph, as a tipped-in plate ───────────────────────
            A captioned figure in the printed supplement: on the rail,
            hard-edged, sized as a plate. The GridDistortion component and
            its props ship exactly as they always have. ─────────────── */}
        <section className="tt-hero">
          <div className="tt-rail tt-hero__rail">
            <figure className="tt-hero__figure">
              <div className="tt-hero__plate">
                <GridDistortion
                  imageSrc="https://picsum.photos/1920/1080?grayscale"
                  grid={12}
                  mouse={0.1}
                  strength={0.15}
                  relaxation={0.9}
                  className="custom-className='text-md'"
                />
              </div>
              <figcaption className="tt-hero__caption">
                <span>
                  Plate <span className="tt-hero__plate-ref">I</span> · destination survey
                </span>
                <span className="tt-hero__note">The ground a route is drawn across.</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── Thesis. The first thing below the photograph is the map. ── */}
        <section className="tt-thesis" id="route">
          <div className="tt-rail">
            <div className="tt-thesis__grid">
              <div className="tt-thesis__copy">
                <h1 className="tt-display">
                  A trip is a route,
                  <br />
                  not a list.
                </h1>
                <p className="tt-lede">
                  Most itinerary generators hand you a pile of famous places and leave you to
                  work out the order. TripTribe sequences the day instead — each stop placed so
                  the next one leads from it — and picks your meals where you will already be.
                </p>
                <p className="tt-note">
                  Three inputs. The route below redraws as you set them.
                </p>
              </div>

              <div className="tt-thesis__map">
                <ContourRoute
                  city={city.trim()}
                  days={Number(days) || 0}
                  budget={Number(budget) || 0}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── The action, in the form's own vocabulary ─────────────────── */}
        <section className="tt-slip" aria-labelledby="tt-slip-title">
          <div className="tt-rail">
            <div className="tt-slip__sheet">
              <div className="tt-slip__head">
                <h2 id="tt-slip-title" className="tt-slip__title">
                  Plan a trip
                </h2>
                <p className="tt-slip__ref">
                  <span>TT</span>
                  <span className="tt-slip__slash">/</span>
                  <span>ROUTE</span>
                </p>
              </div>

              <form
                className="tt-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!ready) return;
                  // Carry the three inputs forward: the visitor must never
                  // retype what they just told us.
                  navigate('/search', {
                    state: {
                      cityName: city.trim(),
                      days: dayNum,
                      budget: budgetNum,
                    },
                  });
                }}
                noValidate
              >
                <div className="tt-field">
                  <label className="tt-field__label" htmlFor="tt-city">
                    City
                  </label>
                  <input
                    id="tt-city"
                    ref={cityRef}
                    className="tt-field__input tt-field__input--city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Where are you going?"
                    autoComplete="off"
                    aria-describedby="tt-city-hint"
                  />
                  <p className="tt-field__hint" id="tt-city-hint">
                    Start typing; suggestions appear as you go.
                  </p>
                </div>

                <div className="tt-field">
                  <label className="tt-field__label" htmlFor="tt-days">
                    Days
                  </label>
                  <input
                    id="tt-days"
                    className="tt-field__input tt-field__input--fig"
                    type="number"
                    min="1"
                    max="60"
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder="4"
                    aria-invalid={days !== '' && !daysOk}
                    aria-describedby={days !== '' && !daysOk ? 'tt-days-error' : undefined}
                  />
                  {days !== '' && !daysOk && (
                    <p className="tt-field__error" id="tt-days-error" role="alert">
                      Between 1 and 60 days.
                    </p>
                  )}
                </div>

                <div className="tt-field">
                  <label className="tt-field__label" htmlFor="tt-budget">
                    Total budget
                  </label>
                  <div className="tt-field__affix">
                    <span className="tt-field__currency" aria-hidden="true">
                      ₹
                    </span>
                    <input
                      id="tt-budget"
                      className="tt-field__input tt-field__input--fig tt-field__input--budget"
                      type="number"
                      min="1000"
                      step="100"
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="48000"
                      aria-invalid={budget !== '' && !budgetOk}
                      aria-describedby={
                        budget !== '' && !budgetOk ? 'tt-budget-error' : 'tt-budget-hint'
                      }
                    />
                  </div>
                  {budget !== '' && !budgetOk ? (
                    <p className="tt-field__error" id="tt-budget-error" role="alert">
                      At least ₹1,000.
                    </p>
                  ) : (
                    <p className="tt-field__hint" id="tt-budget-hint">
                      For the whole trip, not per day.
                    </p>
                  )}
                </div>

                <div className="tt-form__action">
                  <button type="submit" className="tt-btn" disabled={!ready}>
                    <span>Generate the route</span>
                    <IconArrow size={18} />
                  </button>
                  {/* Announced in reading order, not stranded on a disabled
                      control that keyboard users can never reach. */}
                  <p className="tt-form__need" id="tt-slip-need" role="status">
                    {needText}
                  </p>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* ── What the plan contains. Not a benefit grid. ─────────────── */}
        <section className="tt-included" aria-labelledby="tt-included-title">
          <div className="tt-rail">
            <h2 id="tt-included-title" className="tt-section">
              What comes back
            </h2>

            <div className="tt-included__list">
              {INCLUDED.map(({ Icon, title, body }) => (
                <article className="tt-included__item" key={title}>
                  <span className="tt-included__icon">
                    <Icon />
                  </span>
                  <h3 className="tt-included__name">{title}</h3>
                  <p className="tt-included__body">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── The one path through, as a printed run ──────────────────── */}
        <section className="tt-flow" aria-labelledby="tt-flow-title">
          <div className="tt-rail">
            <h2 id="tt-flow-title" className="tt-section">
              How it works
            </h2>

            <ol className="tt-flow__run">
              {STEPS.map((step) => (
                <li className="tt-flow__step" key={step.n}>
                  <span className="tt-flow__n">{step.n}</span>
                  <h3 className="tt-flow__name">{step.title}</h3>
                  <p className="tt-flow__body">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Close, anchored and unadorned ───────────────────────────── */}
        <section className="tt-close">
          <div className="tt-rail">
            <div className="tt-close__inner">
              <p className="tt-close__line">
                Send us the city, the days and the money. It comes back as a route.
              </p>
              <button
                type="button"
                className="tt-btn"
                onClick={() => {
                  // Scroll to the slip first: focusing before the scroll
                  // lands keyboard focus on a field that is then moved out
                  // of view. `preventScroll` keeps the browser from undoing
                  // it a frame later.
                  const slip = document.querySelector('.tt-slip');
                  slip?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
                  document.getElementById('tt-city')?.focus({ preventScroll: true });
                }}
              >
                <span>Start a route</span>
                <IconArrow size={18} />
              </button>
              <p className="tt-close__fine">
                Itineraries, hotel shortlists and prices are generated estimates. Check
                availability and fares with the operator before you book.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Hero;