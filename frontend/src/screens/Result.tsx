"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GridDistortion from '@/components/GridDistortion';
import ActivityCard from '@/components/ActivityCard';
import HotelSection from '@/components/HotelSection';
import { FALLBACK_IMAGE, fetchCityImage } from '@/lib/api';
import { takeResult, takeTripPlan } from '@/lib/nav';
import type { PlanPayload } from '@/lib/types';

const Result = () => {

  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeActivityTab, setActiveActivityTab] = useState(0);
  const [activeMealTab, setActiveMealTab] = useState(0);
  const [roadTripCost, setRoadTripCost] = useState(0);

  // Road trip calculator state
  const [startPoint, setStartPoint] = useState("");
  const [carAverage, setCarAverage] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");

  const handleCalculateRoadTrip = () => {
    const avg = parseFloat(carAverage);
    const price = parseFloat(fuelPrice);
    if (!isNaN(avg) && avg > 0 && !isNaN(price) && price > 0) {
      // Mocked travel distance to destination
      const distance = 380;
      const fuelCost = (distance / avg) * price;
      const tolls = 480;
      setRoadTripCost(Math.round(fuelCost + tolls));
    }
  };


  const saved = false;


  // `react-router`'s `location.state` has no App Router equivalent. The plan is
  // parked in `sessionStorage` by whoever handed it over — a plan just
  // generated on /search, or a saved trip reopened from the account drawer —
  // and each key is claimed once, so a hard reload still finds the plan. A
  // direct visit finds neither and gets the empty state below.
  useEffect(() => {
    setPlan(takeResult() ?? takeTripPlan());
  }, []);


  useEffect(() => {
    if (!plan) return;
    const query = plan.city.IconicPlace || plan.city.name;
    // The city-image → proxy-image round trip lives in `@/lib/api`, which
    // already returns the same placeholder this page has always used when
    // Custom Search has nothing usable.
    let cancelled = false;
    fetchCityImage(query).then((url) => {
      if (!cancelled) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [plan]);


   useEffect(() => {
    const img = new Image();
    img.src = imageUrl ?? FALLBACK_IMAGE;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log("loaded");
    };
    img.onerror = () => {
      setImageUrl(FALLBACK_IMAGE);
      console.log("error");
    };
  }, [imageUrl]);


  // Direct visit, or a reload after the one-shot key was spent: there is no
  // plan to render. The original read `state.city.name` off an empty object and
  // threw; saying so and offering the obvious next step beats a white screen.
  if (!plan) {
    return (
      <div className="tt-close">
        <div className="tt-close__inner">
          <p className="tt-close__line">No plan on this page.</p>
          <p className="tt-close__fine">
            It is handed over when a trip is generated, and lasts for this tab only.
          </p>
          <div className="mt-6">
            <Link className="tt-btn" href="/search">
              Plan a trip
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { city, itinerary, Reach, Tips } = plan;

  return (
    <div>
      {/* <div className='text-5xl text-center'>{city.name}</div> */}
      {/* <div className='text-5xl text-center'>{imageUrl}</div> */}

      <div className='flex items-end justify-end mx-10 '>
        {saved && (<div className="badge badge-outline badge-success">Saved</div>)}
      </div>
      <div className='w-full'>

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
            imageSrc={imageUrl ?? FALLBACK_IMAGE}
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
            {city.name.toUpperCase()}
          </div>

        </div>
        {/* <div className='text-3xl text-center m-2'>{city["Region/State"]}, {city.Country}</div> */}
        <div className='flex flex-row mt-6'>
          <div className="flex flex-wrap justify-evenly w-[60%] border-2 border-gray-600 rounded-lg p-6 m-4">
            <div className="text-6xl mb-4 text-green-300">About</div>
            <div className='text-2xl text-center'>{city.description}</div>
          </div>
          <div className='flex flex-wrap flex-col w-[40%] border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="lg:text-6xl text-4xl mb-4 text-green-300 self-center">Information</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-2xl"><span className="text-green-400">Country :</span> {city.Country}</div>
              <div className="text-2xl"><span className="text-green-400">Region/State :</span> {city["Region/State"]}</div>
              <div className="text-2xl"><span className="text-green-400">Currency :</span> {city.Currency}</div>
              <div className="text-2xl"><span className="text-green-400">Language :</span> {city.Language}</div>
              <div className="text-2xl"><span className="text-green-400">Best time to visit :</span> {city.BestTimeToVisit}</div>
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
              {itinerary.map((_, index) => (
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
              {itinerary.map((day, index) => (
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
              {itinerary.map((_, index) => (
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
              {itinerary.map((day, index) => (
                <div
                  key={`meal-content-${index}`}
                  className={`${activeMealTab === index ? 'block' : 'hidden'}`}
                >
                  <div className="space-y-4">
                    {/* `meals` is a fixed three-key record, so the entries are
                        never missing — only the slots can be null. */}
                    {Object.entries(day.meals).map(([mealType, meal], mealIndex) => (
                      <div key={mealIndex}>
                        <h4 className="text-lg font-medium text-green-400 mb-2 capitalize">
                          {mealType}
                        </h4>
                        {/* A meal the solver could not seat inside opening
                            hours arrives null — say so rather than throw. */}
                        {meal ? (
                          <ActivityCard activity={meal.place} description={meal.description} />
                        ) : (
                          <p className="text-sm text-gray-400">
                            Nothing nearby fits this meal in your day&rsquo;s hours.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="divider"></div>
        {/* Transport gates: the solver does not gather arrival-transport data
            yet, so `Reach` arrives null. An honest gap beats a crash — and
            beats inventing an airport. */}
        {Reach && (
        <>
        <div className="text-6xl font-bold text-green-400 text-center mb-10">HOW TO REACH</div>
        <div className='flex flex-row flex-wrap justify-evenly'>
          <div className='flex flex-wrap flex-col w-fit border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-2xl mb-4 text-green-300 self-center">Airport ✈️</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-md"><span className="text-green-400">Nearest Airport :</span> {Reach.nearestAirport[0]}</div>
              <div className="text-md"><span className="text-green-400">Distance from the city :</span> {Reach.nearestAirport[1]}</div>
            </div>
          </div>

          <div className='flex flex-wrap flex-col w-fit border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-2xl mb-4 text-green-300 self-center">Railway Station 🚝</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-md"><span className="text-green-400">Nearest Railway Station :</span> {Reach.nearestRailwayStation[0]}</div>
              <div className="text-md"><span className="text-green-400">Distance from the city :</span> {Reach.nearestRailwayStation[1]}</div>
            </div>
          </div>

          <div className='flex flex-wrap flex-col w-fit border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-2xl mb-4 text-green-300 self-center">Bus Station 🚌</div>
            <div className="flex flex-col gap-3 self-center">
              <div className="text-md"><span className="text-green-400">Nearest Bus Station :</span> {Reach.nearestBusStation[0]}</div>
              <div className="text-md"><span className="text-green-400">Distance from the city :</span> {Reach.nearestBusStation[1]}</div>
            </div>
          </div>
          <div className='flex flex-wrap flex-col w-[40%] border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-6xl mb-4 text-green-300 self-center">Planning a Road Trip 🚗</div>
            {roadTripCost ? (
              <div className="flex flex-col gap-5 self-center mt-5">
                <div className='text-center'><span className='text-2xl'>Estimated Cost (Toll + fuel):</span> <span className='text-green-400 text-2xl'>Rs. {roadTripCost}</span></div>
                <button className='bg-gray-300 text-black hover:bg-gray-400 rounded-3xl text-2xl p-2' onClick={() => {
                  setRoadTripCost(0);
                  setStartPoint("");
                  setCarAverage("");
                  setFuelPrice("");
                }}>Calculate Again 🔁</button>
              </div>
            ) : (
              <>
                <div className='text-md text-center'>Estimate the cost of your road trip to {city.name}!</div>
                <div className="flex flex-col gap-5 self-center mt-5 w-full">
                  <input type="text" placeholder="Enter starting point" value={startPoint} onChange={(e) => setStartPoint(e.target.value)} className="input input-bordered w-full" />
                  <input type="number" placeholder="Enter Car's Average (km/l)" value={carAverage} onChange={(e) => setCarAverage(e.target.value)} className="input input-bordered w-full" />
                  <input type="number" placeholder="Enter Fuel Price (Rs./l)" value={fuelPrice} onChange={(e) => setFuelPrice(e.target.value)} className="input input-bordered w-full" />
                  <button className='bg-green-500 text-black hover:bg-green-400 rounded-3xl text-2xl p-2' onClick={handleCalculateRoadTrip}>Calculate</button>
                </div>
              </>
            )}
          </div>

          <div className='flex flex-wrap flex-col w-[40%] border-2 border-green-300 rounded-lg p-6 m-4'>
            <div className="text-6xl mb-5 text-green-300 self-center">Tips 💡</div>
            {Tips.map((tip, index) => (
              <ul key={index} className="text-md text-center mb-4 list-disc list-inside">
                <li className='text-gray-400 text-xl'> {tip}</li>
              </ul>
            ))}
          </div>
        </div>
        </>
        )}
        <div className="divider"></div>
        <div className='text-6xl font-bold text-green-400 text-center mb-10'>Hotels and Accommodations 🏨</div>

        <HotelSection plan={plan} />
      </div>
    </div>
  );
};

export default Result