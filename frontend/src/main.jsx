import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const script = document.createElement("script");
// `loading=async` is Google's documented bootstrap flag; without it the API
// logs a suboptimal-loading warning. It defers execution, so readiness is
// taken from the API's own `callback` — the script element's load event
// fires before google.maps.places is populated.
const mapsApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
window.__triptribeMapsReady = () => {};
const params = new URLSearchParams({ key: mapsApiKey, libraries: "places", loading: "async" });
if (mapsApiKey) params.set("callback", "__triptribeMapsOnReady");
script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
// Announce readiness through whatever hook is installed at call time —
// consumers replace it during mount, long after this file ran.
window.__triptribeMapsOnReady = () => {
  delete window.__triptribeMapsOnReady;
  window.__triptribeMapsReady?.();
};
script.addEventListener("error", () => window.__triptribeMapsReady?.());
document.head.appendChild(script);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
