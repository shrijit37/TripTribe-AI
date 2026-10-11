"use client";

import ActivityCard from "@/components/ActivityCard";
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
 */
const HotelSection = ({ plan }: { plan: PlanPayload | null }) => {
    if (!plan || !plan.hotels) {
        return <div>No hotel data available</div>;
    }

    return (
        <div className="min-h-screen p-8">
            <div className='text-2xl font-semibold text-green-400 text-center mb-8'>
                {`Hotels in ${plan.city.name} based on your budget`}
                <div className="flex justify-center">
                 <div className="badge badge-dash badge-warning flex">Prices shown are estimates and may vary. Please refer to official booking websites for the most accurate and up-to-date pricing details.</div>

                </div>
            </div>
            <div className="flex justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plan.hotels.map((hotel, idx) => (
                        <ActivityCard data={hotel} key={idx}/>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default HotelSection
