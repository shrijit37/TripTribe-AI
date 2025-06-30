import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SpeedInsights } from "@vercel/speed-insights/react"

const script = document.createElement("script");
script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
script.async = true;
document.head.appendChild(script);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SpeedInsights />
    <App />
  </StrictMode>,
)
