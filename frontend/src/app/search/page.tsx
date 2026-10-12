import { permanentRedirect } from "next/navigation";

// The React-era route, renamed in the mixtape rebuild: /search now lives at /plan.
export default function SearchRedirect() {
  permanentRedirect("/plan");
}
