import "server-only";
import OpenAI from "openai";
import { missing, optional } from "@/server/env";
import type { SolveResult } from "@/server/domain/solver/pipeline";

/**
 * Narration: the only place an LLM is allowed to run.
 * Ported from `backend/services/narrate.js` — rules unchanged:
 * 1. The model only names back places from a list it was handed; descriptions
 *    attach by placeId, so a hallucinated name attaches to nothing.
 * 2. Every narration field is optional. Slow key, missing key, rejected
 *    request — the itinerary stands on the solver's facts alone.
 */

export interface Narration {
  overview: string | null;
  tips: string[];
  descriptions: Record<string, string>;
}

export interface NarratedPlan extends SolveResult {
  narration: Narration;
}

const emptyNarration = (): Narration => ({
  overview: null,
  tips: [],
  descriptions: {},
});

export const isNarrationConfigured = (): boolean => !missing("OPENAI_KEY");

const getClient = (): OpenAI =>
  new OpenAI({
    baseURL: optional("OPENAI_BASE_URL") ?? "https://openrouter.ai/api/v1",
    apiKey: optional("OPENAI_KEY") ?? "",
  });

const model = (): string =>
  optional("NARRATOR_MODEL") ??
  optional("OPENAI_MODEL") ??
  "google/gemini-2.0-flash-lite-001";

const clean = (text: string): string =>
  text
    .replace(/```(?:json)?/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
    .trim();

const buildPrompt = (plan: SolveResult): string => {
  const days = plan.itinerary.map((day) => ({
    day: day.index,
    stops: day.stops.map((s) => ({
      placeId: s.placeId,
      name: s.place.name,
      type: s.place.primaryType ?? null,
    })),
  }));
  return `Here is a travel plan for ${plan.city.name}, already booked into real places and real opening hours. Your only job is to describe them warmly and accurately. Do not invent places, prices, times or distances.

Return JSON exactly:
{
  "overview": "two or three sentences on visiting ${plan.city.name}",
  "tips": ["three to five practical, city-specific tips"],
  "descriptions": { "<placeId>": "one sentence on why this stop is worth it" }
}

Cover every placeId you are given. Days:
${JSON.stringify(days)}`;
};

/**
 * Attach prose to a solver plan. Never throws; on any failure it returns an
 * empty narration so the caller's plan is untouched.
 */
export const narrate = async (plan: SolveResult): Promise<NarratedPlan> => {
  if (!isNarrationConfigured()) return { ...plan, narration: emptyNarration() };

  const known = new Set(
    plan.itinerary.flatMap((day) => day.stops.map((s) => s.placeId)),
  );

  try {
    const completion = await getClient().chat.completions.create(
      {
        model: model(),
        messages: [
          {
            role: "system",
            content:
              "You are a travel writer. You describe places that an algorithm has already " +
              "chosen and scheduled. You never add, reorder or reprice anything.",
          },
          { role: "user", content: buildPrompt(plan) },
        ],
        response_format: { type: "json_object" },
      },
      { timeout: 45_000 },
    );

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return { ...plan, narration: emptyNarration() };

    let parsed: {
      overview?: unknown;
      tips?: unknown;
      descriptions?: unknown;
    };
    try {
      parsed = JSON.parse(clean(content));
    } catch {
      return { ...plan, narration: emptyNarration() };
    }

    const descriptions: Record<string, string> = {};
    const rawDescriptions =
      parsed.descriptions && typeof parsed.descriptions === "object"
        ? (parsed.descriptions as Record<string, unknown>)
        : {};
    for (const [placeId, text] of Object.entries(rawDescriptions)) {
      if (known.has(placeId) && typeof text === "string" && text.trim()) {
        descriptions[placeId] = text.trim();
      }
    }

    return {
      ...plan,
      narration: {
        overview:
          typeof parsed.overview === "string" && parsed.overview.trim()
            ? parsed.overview.trim()
            : null,
        tips: Array.isArray(parsed.tips)
          ? parsed.tips
              .filter(
                (t): t is string =>
                  typeof t === "string" && t.trim().length > 0,
              )
              .map((t) => t.trim())
          : [],
        descriptions,
      },
    };
  } catch (error) {
    console.warn(
      "[narrate] failed, returning plan without prose:",
      error instanceof Error ? error.message : error,
    );
    return { ...plan, narration: emptyNarration() };
  }
};

export default narrate;
