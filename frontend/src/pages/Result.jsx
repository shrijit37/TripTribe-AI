import { useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import GridDistortion from '../components/GridDistortion';
import ActivityCard from '../components/ActivityCard';
import HotelSection from '../components/HotelSection';

const Result = () => {

  const [imageUrl, setImageUrl] = useState(null);
  const saved = false;
  const [activeActivityTab, setActiveActivityTab] = useState(0);
  const [activeMealTab, setActiveMealTab] = useState(0);
  const [roadTripCost, setRoadTripCost] = useState(0);

  const location = useLocation();
  const state = location.state || {};
 

 

  console.log(state);
  useEffect(() => {
    const getPhoto = async () => {
      try {
        const data = await fetch(`https://www.googleapis.com/customsearch/v1?q=${state.city.IconicPlace}&searchType=image&cx=c63fff3e039f04940&key=${import.meta.env.VITE_GOOGLE_CUSTOM_SEARCH_API_KEY}`).then((res) => res.json())
        console.log(data.items[0].link);

        setImageUrl(`https://api.codetabs.com/v1/proxy/?quest=${data.items[3].link}`);
      } catch (e) {
        console.log(e)
      }
    }

    getPhoto();
  }, [state]);

  return (
    <div>
      {/* <div className='text-5xl text-center'>{state.city.name}</div> */}
      {/* <div className='text-5xl text-center'>{imageUrl}</div> */}

      <div className='flex items-end justify-end mx-10 '>
        {saved && (<div className="badge badge-outline badge-success">Saved</div>)}
      </div>
      <div className='lg:w-[100%] w-[100vh]'>

        <div style={{ width: '100%', height: '600px', position: 'relative' }}>
          {/* <GridDistortion
            crossOrigin="anonymous"
            imageSrc={"https://picsum.photos/1920/1080?grayscale"}
            grid={10}
            mouse={0.1}
            strength={0.25}
            relaxation={0.9}
            className="custom-class m-3"
          /> */}
          <GridDistortion
            crossOrigin="anonymous"
            imageSrc={imageUrl}
            grid={10}
            mouse={0.1}
            strength={0.25}
            relaxation={0.9}
            className="custom-class"
          />
          <div
            className='text-[10rem] absolute inset-0 flex items-center justify-center text-white'
            style={{ pointerEvents: 'none' }}
          >
            {state.city.name.toUpperCase()}
          </div>

        </div>
        {/* <div className='text-3xl text-center m-2'>{state.city["Region/State"]}, {state.city.Country}</div> */}
        <div className='flex flex-row mt-6'>
          <div className="flex flex-wrap justify-evenly w-[60%] border-2 border-gray-600 rounded-lg p-6 m-4">
            <div className="text-6xl mb-4 text-green-300">About</div>
            <div className='text-2xl text-center'>{state.city.description}</div>
          </div>
          <div className='flex flex-wrap flex-col w-[40%] border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-6xl mb-4 text-green-300 self-center">Information</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-2xl"><span className="text-green-400">Country :</span> {state.city.Country}</div>
              <div className="text-2xl"><span className="text-green-400">Region/State :</span> {state.city["Region/State"]}</div>
              <div className="text-2xl"><span className="text-green-400">Currency :</span> {state.city.Currency}</div>
              <div className="text-2xl"><span className="text-green-400">Language :</span> {state.city.Language}</div>
              <div className="text-2xl"><span className="text-green-400">Best time to visit :</span> {state.city.BestTimeToVisit}</div>
            </div>
          </div>

        </div>
        <div className="divider"></div>

        {/* Activities Section */}

        <div className="text-6xl font-bold text-green-400 text-center mb-10">DAYWISE ITINERARY</div>
        <div className='flex flex-row gap-8 px-8 mb-12'>
          <div className='w-1/2'>
            <h3 className="text-3xl font-semibold text-green-300 mb-6">Activities</h3>
            <div className="tabs tabs-boxed bg-base-200 mb-4">
              {state.itinerary.map((_, index) => (
                <button
                  key={`act-${index}`}
                  className={`tab tab-lg ${activeActivityTab === index ? 'tab-active bg-green-400 text-white' : ''}`}
                  onClick={() => setActiveActivityTab(index)}
                >
                  Day {index + 1}
                </button>
              ))}
            </div>
            <div className="tab-contents bg-base-100 rounded-lg p-6">
              {state.itinerary.map((day, index) => (
                <div 
                  key={`act-content-${index}`} 
                  className={`${activeActivityTab === index ? 'block' : 'hidden'}`}
                >
                  <div className="space-y-4">
                    {day.activities.map((activity, actIndex) => (
                      <ActivityCard 
                        key={actIndex} 
                        activity={activity.place} 
                        description={activity.description}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meals Section */}
          <div className='w-1/2'>
            <h3 className="text-3xl font-semibold text-green-300 mb-6">Meals</h3>
            <div className="tabs tabs-boxed bg-base-200 mb-4">
              {state.itinerary.map((_, index) => (
                <button
                  key={`meal-${index}`}
                  className={`tab tab-lg ${activeMealTab === index ? 'tab-active bg-green-400 text-white' : ''}`}
                  onClick={() => setActiveMealTab(index)}
                >
                  Day {index + 1}
                </button>
              ))}
            </div>
            <div className="tab-contents bg-base-100 rounded-lg p-6">
              {state.itinerary.map((day, index) => (
                <div 
                  key={`meal-content-${index}`} 
                  className={`${activeMealTab === index ? 'block' : 'hidden'}`}
                >
                  <div className="space-y-4">
                    {Object.entries(day.meals).map(([mealType, meal], mealIndex) => (
                      <div key={mealIndex}>
                        <h4 className="text-lg font-medium text-green-400 mb-2 capitalize">
                          {mealType}
                        </h4>
                        <ActivityCard 
                          activity={meal.place} 
                          description={meal.description}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="divider"></div>
        <div className="text-6xl font-bold text-green-400 text-center mb-10">HOW TO REACH</div>
        <div className='flex flex-row flex-wrap justify-evenly'>
          <div className='flex flex-wrap flex-col w-fit border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-2xl mb-4 text-green-300 self-center">Airport ✈️</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-md"><span className="text-green-400">Nearest Airport :</span> {state.Reach.nearestAirport[0]}</div>
              <div className="text-md"><span className="text-green-400">Distance from the city :</span> {state.Reach.nearestAirport[1]}</div>
            </div>
          </div>

          <div className='flex flex-wrap flex-col w-fit border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-2xl mb-4 text-green-300 self-center">Railway Station 🚝</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-md"><span className="text-green-400">Nearest Airport :</span> {state.Reach.nearestRailwayStation[0]}</div>
              <div className="text-md"><span className="text-green-400">Distance from the city :</span> {state.Reach.nearestRailwayStation[1]}</div>
            </div>
          </div>

          <div className='flex flex-wrap flex-col w-fit border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-2xl mb-4 text-green-300 self-center">Bus Station 🚌</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-md"><span className="text-green-400">Nearest Airport :</span> {state.Reach.nearestBusStation[0]}</div>
              <div className="text-md"><span className="text-green-400">Distance from the city :</span> {state.Reach.nearestBusStation[1]}</div>
            </div>
          </div>
          <div className='flex flex-wrap flex-col w-[40%] border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-6xl mb-4 text-green-300 self-center">Planning a Road Trip 🚗</div>
            {roadTripCost?(
              <div className="flex flex-col gap-5 self-center mt-5">
              <div className='text-center'><span className='text-2xl'>Estimated Cost (Toll + fuel):</span> <span className='text-green-400 text-2xl'>Rs. {roadTripCost}</span></div>
              <button className='bg-gray-300 text-black hover:bg-gray-400 rounded-3xl text-2xl'>Calculate Again 🔁</button>
              </div>
            ):(
              <>
            <div className='text-md text-center'>Estimate the cost of your road trip with our tool!</div>
            <div className="flex flex-col gap-5 self-center mt-5">
              <input type="text" placeholder="Enter your starting point" className="input input-bordered w-full" />
              <input type="text" placeholder="Enter your Car's Average" className="input input-bordered w-full" />
              <input type="text" placeholder="Enter your Fuel Price" className="input input-bordered w-full" />
              <button className='bg-green-500 text-black hover:bg-green-400 rounded-3xl text-2xl'>Calculate</button>
            </div>
              </>
          )}
          </div>

          <div className='flex flex-wrap flex-col w-[40%] border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-6xl mb-5 text-green-300 self-center">Tips 💡</div>
              {state.Tips.map((tip, index) => (
                  <ul key={index} className="text-md text-center mb-4 list-disc list-inside"> 
                    <li className='text-gray-400 text-xl'> {tip}</li>
                  </ul>
                ))}
          </div>
        </div>
        <div className="divider"></div>
        <div className='text-6xl font-bold text-green-400 text-center mb-10'>Hotels and Accommodations 🏨</div>
       
        <HotelSection />
        {}
      </div>
    </div>
  )
}

export default Result