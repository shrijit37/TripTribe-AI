import { model, Schema } from "mongoose";

/**
 * Google's Places quota is the binding constraint on this whole product.
 * `rating`, `priceLevel` and `regularOpeningHours` are Enterprise-tier on
 * every Places endpoint, and the allowance is 1,000 calls a month. A crawler
 * hitting `/best-places-to-visit-in-jaipur` a hundred times must not spend a
 * hundred Enterprise calls.
 *
 * So the SEO pages read from this cache: one enrichment per place, reused for
 * every subsequent render, with a long TTL because a place's rating and its
 * opening hours change on a scale of months, not minutes.
 */
const placeCacheSchema = new Schema(
    {
        placeId: {
            type: String,
            required: true,
            unique: true, // one entry per Google place id, ever
        },
        name: { type: String, required: true },
        payload: { type: Object, required: true },
        // Only written once the entry has been enriched. An entry that exists
        // with `enriched: false` is a discovery-only record, which is what the
        // degraded path needs and must not be mistaken for real metadata.
        enriched: { type: Boolean, default: false },
    },
    // `timestamps` plus a TTL: an entry self-destructs 90 days after its last
    // write, so the cache cannot grow unbounded and a place that has changed
    // materially eventually gets re-fetched.
    { timestamps: true, expires: "90d" },
);

const PlaceCacheModel = model("placeCache", placeCacheSchema);
export default PlaceCacheModel;