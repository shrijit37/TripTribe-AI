const ActivityCard = ({ activity, description, data }) => {
    // Handle both activity/description props and hotel data prop
    if (data) {
        // Hotel card layout
        return (
            <div className="card bg-primary text-primary-content w-96 m-4">
                <div className="card-body">
                    <h2 className="card-title text-emerald-400">{data.hotelName}</h2>
                    <p className="text-sm">{data.location}</p>
                    <div className="flex justify-between w-full mt-2">
                        <span>Rating: {data.rating}⭐</span>
                        <span>Price: ₹{data.prices}</span>
                    </div>
                </div>
            </div>
        )
    }

    // Activity card layout
    return (
        <div className="card bg-primary text-primary-content w-full mb-4">
            <div className="card-body">
                <h2 className="card-title text-emerald-400">{activity}</h2>
                <p>{description}</p>
            </div>
        </div>
    )
}

export default ActivityCard