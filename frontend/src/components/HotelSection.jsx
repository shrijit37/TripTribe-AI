import { useLocation } from "react-router";
import ActivityCard from "./ActivityCard";
const HotelSection = () => {
    const location = useLocation();
    const state = location.state || null;

    if (!state || !state.hotels) {
        return <div>No hotel data available</div>;
    }

    return (
        <div className="min-h-screen p-8">
            <div className='text-2xl font-semibold text-green-400 text-center mb-8'>
                {`Hotels in ${state.city.name} based on your budget`}
                <div className="flex justify-center">
                 <div className="badge badge-dash badge-warning flex">Prices shown are estimates and may vary. Please refer to official booking websites for the most accurate and up-to-date pricing details.</div>

                </div>
            </div>
            <div className="flex justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.hotels.map((hotel, idx) => (
                        <ActivityCard data={hotel} key={idx}/>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default HotelSection