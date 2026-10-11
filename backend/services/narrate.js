/**
 * Narration: the only place an LLM is allowed to run.
 *
 * The solver (`solver/pipeline.js`) has already decided every fact — which
 * places, which day, what order, what clock time, what cost. This module asks
 * the model for prose *on top of* that plan: a city blurb, practical tips,
 * a one-line description per stop. The model is never asked to pick a place,
 * set a time, or quote a price, because it cannot be trusted to get any of
 * those right — and every one of them is already computed.
 *
 * Two rules make this safe:
 *   1. The model only ever *names back* places from a list it was handed. Its
 *      descriptions are attached to the solver's stops by placeId, so a
 *      hallucinated name attaches to nothing and is discarded.
 *   2. Every narration field is optional. If the model is slow, the key is
 *      missing, or the gateway rejects the request, the itinerary stands on
 *      the solver's facts alone and the descriptions come back empty rather
 *      than wrong.
 */
import OpenAI from "openai";

const MODEL = process.env.NARRATOR_MODEL || process.env.OPENAI_MODEL || "google/gemini-2.0-flash-lite-001";
const TIMEOUT_MS = Number(process.env.NARRATOR_TIMEOUT_MS) || 45_000;

const getClient = () => new OpenAI({
    baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_KEY,
});

export const isNarrationConfigured = () => Boolean(process.env.OPENAI_KEY);

/** Strip markdown fences and control characters before JSON.parse. */
const clean = (text) =>
    text
        .replace(/```(?:json)?/g, "")
        .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
        .trim();

const buildPrompt = (plan) => {
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
 * Attach prose to a solver plan. Returns a copy of `plan` with a `narration`
 * block: `{ overview, tips, descriptions }`. Never throws; on any failure it
 * returns an empty narration so the caller's plan is untouched.
 */
export const narrate = async (plan) => {
    const empty = { overview: null, tips: [], descriptions: {} };
    if (!isNarrationConfigured()) return { ...plan, narration: empty };

    // Every placeId the model may legitimately mention.
    const known = new Set(
        plan.itinerary.flatMap((day) => day.stops.map((s) => s.placeId))
    );

    try {
        const completion = await getClient().chat.completions.create(
            {
                model: MODEL,
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
            { timeout: TIMEOUT_MS }
        );

        const content = completion?.choices?.[0]?.message?.content;
        if (!content) return { ...plan, narration: empty };

        let parsed;
        try {
            parsed = JSON.parse(clean(content));
        } catch {
            return { ...plan, narration: empty };
        }

        // Attach by placeId only — a description whose key is not a real stop
        // in the plan is dropped here, so the model cannot smuggle in a place.
        const descriptions = {};
        for (const [placeId, text] of Object.entries(parsed.descriptions ?? {})) {
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
                    ? parsed.tips.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
                    : [],
                descriptions,
            },
        };
    } catch (error) {
        // Narration is decoration. Its failure is logged and swallowed so the
        // itinerary — the part the traveller actually needs — still ships.
        console.warn("[narrate] failed, returning plan without prose:", error?.message ?? error);
        return { ...plan, narration: empty };
    }
};

export default narrate;
