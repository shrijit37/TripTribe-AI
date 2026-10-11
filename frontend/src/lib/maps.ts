/**
 * The Google Maps JavaScript API, loaded once and late.
 *
 * The API script is deferred (`loading=async` is Google's documented flag;
 * without it the API logs a suboptimal-loading warning), which means its own
 * load event fires *before* `google.maps.places` is populated. So readiness
 * comes from the API's `callback` parameter, never from `onload`.
 *
 * Two consumers mount at unrelated times — the Hero's city field and the
 * Search stepper's — and either can mount after the script has already
 * arrived. A single promise plus a ready-callback registry covers both: late
 * subscribers run immediately, early ones wait, and the script tag is created
 * exactly once.
 */
// `@types/google.maps` declares `google.maps` as a namespace, not a global
// value — the Maps script assigns that namespace object onto `window` at
// runtime. `typeof google.maps` is the real type of what arrives there, and it
// is resolved out here because a `declare global` block cannot reference the
// namespace it is augmenting.
type MapsNamespace = typeof google.maps;

/**
 * The Places Autocomplete widget, named so consumers do not repeat the
 * `import("...").Type` path inside a `useRef` annotation.
 */
export type MapsAutocomplete = InstanceType<
  MapsNamespace["places"]["Autocomplete"]
>;

declare global {
  interface Window {
    google?: MapsNamespace;
    __triptribeMapsReady?: () => void;
    __triptribeMapsOnReady?: () => void;
  }
}

type ReadyListener = () => void;

let scriptPromise: Promise<void> | null = null;
let ready = false;
const listeners = new Set<ReadyListener>();

const announce = () => {
  ready = true;
  for (const listener of [...listeners]) listener();
  listeners.clear();
};

/** True once `window.google.maps.places` is usable. */
export const isMapsReady = (): boolean => ready && Boolean(window.google?.maps?.places);

/**
 * Register a readiness callback. Fires immediately when Maps is already up, so
 * a component mounting late is never left waiting on an event that has passed.
 */
export const onMapsReady = (listener: ReadyListener): (() => void) => {
  if (isMapsReady()) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Inject the script. Returns the same promise on every call, so a component
 * that unmounts mid-load does not leave the next one waiting on a script that
 * is already in the document.
 */
export function loadMapsApi(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) {
    // No key is a deployment state, not a crash: the app boots and the city
    // field simply has no suggestions. Rejecting would leave an unhandled
    // rejection in every consumer for a condition they already handle.
    ready = true;
    return Promise.resolve();
  }

  scriptPromise = new Promise<void>((_resolve) => {
    window.__triptribeMapsReady = announce;
    window.__triptribeMapsOnReady = () => {
      delete window.__triptribeMapsOnReady;
      announce();
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      libraries: "places",
      loading: "async",
      callback: "__triptribeMapsOnReady",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    // A blocked or failed load is indistinguishable from an absent key as far
    // as the UI is concerned: no autocomplete. Resolve either way so no caller
    // hangs on a promise that never settles.
    script.addEventListener("error", announce);
    document.head.appendChild(script);
  });

  return scriptPromise;
}