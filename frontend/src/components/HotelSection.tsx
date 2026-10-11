"use client";

import { sum } from "@/lib/money";
import type { PlanPayload } from "@/lib/types";

/**
 * The hotel shortlist for the plan Result is already holding.
 *
 * It used to read the plan off the router's location state, which every
 * component in the tree could read without consuming it. The App Router
 * substitute is a one-shot `sessionStorage` claim, and two components
 * claiming it independently meant whichever mounted second got nothing —
 * Result showed the itinerary and this showed "No hotel data available" for
 * the very same plan. So the plan is passed down from the one component that
 * claims it.
 *
 * The rows are ruled rather than tiled. A shortlist that costs money is a list
 * to be compared down a column, not a row of posters, and every figure in it
 * is a worked estimate — which is why the caveat sits above the list instead
 * of under a badge.
 */
const HotelSection = ({
    plan,
    unit,
}: {
    plan: PlanPayload;
    /** The currency the payload itself names, already reduced to a unit. */
    unit: string;
}) => {
    const hotels = Array.isArray(plan.hotels) ? plan.hotels : [];
    const where = plan.city?.name ?? "the city";

    if (!hotels.length) {
        return (
            <p className="tt-stay__none">
                No stay was worked out for {where} inside the figure you
                entered. That is a gap in the sheet, not a recommendation —
                nothing here is booked.
            </p>
        );
    }

    return (
        <div className="tt-stay">
            <p className="tt-stay__caveat">
                Every figure below is worked out from the total you entered, not
                quoted from a booking site. Treat them as a shortlist to check,
                never as rates to rely on.
            </p>
            <ol className="tt-stay__list">
                {hotels.map((hotel) => (
                    <li className="tt-stay__item" key={hotel.placeId ?? hotel.hotelName}>
                        <div className="tt-stay__main">
                            <h4 className="tt-stay__name">{hotel.hotelName}</h4>
                            {hotel.location ? (
                                <p className="tt-stay__where">{hotel.location}</p>
                            ) : null}
                        </div>
                        <a
                            className="tt-stay__link"
                            href={`https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.hotelName} ${plan.city?.name ?? ""}`.trim())}`}
                            target="_blank"
                            rel="nofollow noopener"
                        >
                            Check live price · opens Google Hotels
                        </a>
                        <span className="tt-stay__figures">
                            {hotel.rating ? (
                                <span className="tt-stay__figure">
                                    <span className="tt-stay__figureKey">RATING</span>
                                    {hotel.rating}
                                </span>
                            ) : null}
                            {hotel.prices ? (
                                <span className="tt-stay__figure">
                                    <span className="tt-stay__figureKey">
                                        A NIGHT
                                    </span>
                                    {sum(unit, hotel.prices)}
                                </span>
                            ) : null}
                        </span>
                    </li>
                ))}
            </ol>
            <p className="tw-disclosure">Live prices open on Google Hotels in a new tab. Figures above are estimates worked from your total; TripTribe may earn a fee on outward stay links.</p>
        </div>
    );
};

export default HotelSection;