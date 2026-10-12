"use client";

import { sum } from "@/lib/money";
import type { PlanPayload } from "@/lib/types";

const HotelSection = ({
    plan,
    unit,
}: {
    plan: PlanPayload;
    unit: string;
}) => {
    const hotels = Array.isArray(plan.hotels) ? plan.hotels : [];
    const where = plan.city?.name ?? "the city";

    if (!hotels.length) {
        return (
            <p className="mx-rs-stay__caveat">
                No stay was worked out for {where} inside the figure you
                entered. That is a gap in the sheet, not a recommendation —
                nothing here is booked.
            </p>
        );
    }

    return (
        <div>
            <p className="mx-rs-stay__caveat">
                Every figure below is worked out from the total you entered, not
                quoted from a booking site. Treat them as a shortlist to check,
                never as rates to rely on.
            </p>
            <ol className="mx-rs-stay__list">
                {hotels.map((hotel) => (
                    <li className="mx-rs-stay__item" key={hotel.placeId ?? hotel.hotelName}>
                        <div className="mx-rs-stay__main">
                            <h4 className="mx-rs-stay__name">{hotel.hotelName}</h4>
                            {hotel.location ? (
                                <p className="mx-rs-stay__where">{hotel.location}</p>
                            ) : null}
                        </div>
                        <span className="mx-rs-stay__figures">
                            {hotel.rating ? (
                                <span>
                                    <span className="mx-rs-stay__figurekey">
                                        RATING
                                    </span>
                                    {hotel.rating}
                                </span>
                            ) : null}
                            {hotel.prices ? (
                                <span>
                                    <span className="mx-rs-stay__figurekey">
                                        A NIGHT
                                    </span>
                                    {sum(unit, hotel.prices)}
                                </span>
                            ) : null}
                        </span>
                        <a
                            className="mx-rs-link"
                            href={`https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.hotelName} ${plan.city?.name ?? ""}`.trim())}`}
                            target="_blank"
                            rel="nofollow noopener"
                        >
                            Check live price · opens Google Hotels{" "}
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path
                                    d="M2 6h7M6.5 3 9.5 6 6.5 9"
                                    strokeWidth="1.5"
                                    strokeLinecap="square"
                                />
                            </svg>
                        </a>
                    </li>
                ))}
            </ol>
            <p className="mx-rs-disclosure">Live prices open on Google Hotels in a new tab. Figures above are estimates worked from your total; TripTribe may earn a fee on outward stay links.</p>
        </div>
    );
};

export default HotelSection;
