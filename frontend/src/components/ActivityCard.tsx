import type { Hotel } from "@/lib/types";

/**
 * Two cards behind one name: the hotel shortlist (`data`) and the single
 * activity row (`activity`/`description`). Which layout renders is decided by
 * which prop the caller supplied.
 */
type ActivityCardProps =
  | { activity: string; description: string; data?: never }
  | { data: Hotel; activity?: never; description?: never };

const ActivityCard = (props: ActivityCardProps) => {
    // Handle both activity/description props and hotel data prop
    if (props.data) {
        // Hotel card layout
        return (
            <div className="card bg-primary text-primary-content w-96 m-4">
                <div className="card-body">
                    <h2 className="card-title text-emerald-400">{props.data.hotelName}</h2>
                    <p className="text-sm">{props.data.location}</p>
                    <div className="flex justify-between w-full mt-2">
                        <span>Rating: {props.data.rating}⭐</span>
                        <span>Price: ₹{props.data.prices}</span>
                    </div>
                </div>
            </div>
        )
    }

    // Activity card layout
    return (
        <div className="card bg-primary text-primary-content w-full mb-4">
            <div className="card-body">
                <h2 className="card-title text-emerald-400">{props.activity}</h2>
                <p>{props.description}</p>
            </div>
        </div>
    )
}

export default ActivityCard
