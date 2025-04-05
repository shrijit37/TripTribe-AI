import { useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { getPlaces, PHOTO_REF_URL } from "../services/GlobalApi";

const Result = () => {

  const [imageUrl, setImageUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  let location = useLocation();
  const state = location.state;
  if (!state) {
    return <div className="text-xl">No data availible please try again later.</div>;
  }
  // console.log(state);


  useEffect(() => {
    state && GetPlacePhoto();
  }, [state])

  const GetPlacePhoto = async () => {
    try {
      const data = {
        textQuery: state.city.name, // Ensure this property exists and is correct
      };
      const result = await getPlaces(data);
      const photos = result.data.places[0]?.photos;

      if (photos && photos.length > 4) {
        const PhotoUrl = PHOTO_REF_URL.replace("{NAME}", photos[4].name);
        setImageUrl(PhotoUrl);
      } else {
        console.error("Photos array is empty or index out of bounds");
        setImageUrl(null); // Fallback in case of error
      }
    } catch (error) {
      console.error("Error fetching place photo:", error);
      setImageUrl(null); // Fallback in case of error
    }
  }

  const iten = state.itinerary[0].activities[0].place;
  console.log(iten);
  return (
    <>
      <div className='text-5xl text-center'>{state.city.name}</div>
      <div className='text-3xl text-center m-2'>{state.city["Region/State"]}, {state.city.Country}</div>
      <div className='text-xl text-center mx-28 m-4'>{state.city.description}, {state.city.Country}</div>
      <div className='flex items-end justify-end mx-10'>
        {saved && (<div className="badge badge-outline badge-success">Saved</div>)}
      </div>
      <div className='flex flex-wrap items-start justify-center gap-4 m-4'>
        <img src={imageUrl || "fallback-image-url.jpg"} alt="Image Not Found" className='w-[50vw] h-[100vh]' />
        <div className='flex-1 w-[100%] flex-row'>
          <button className="btn btn-success float-right" onClick={() => setSaved(true)}> + Save itenary</button>
          {
            state.itinerary.map((day, index) => (
              <div key={index} className='text-xl text-center mx-28 m-4'>
                <div className='text-3xl text-center mx-28 m-4'>Day {`${index + 1}`}</div>
                {day.activities.map((activity, actIndex) => (
                  <div key={actIndex} className='text-xl text-center mx-28 m-4'>
                    <p>{activity.place}</p>
                    <p>{activity.time}</p>
                    <p>{activity.description}</p>
                  </div>
                ))}

                {Object.entries(day.meals).map(([mealType, meal], mealIndex) => (
                  <div key={mealIndex} className='text-xl text-center mx-28 m-4'>
                    <p><strong>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}:</strong> {meal.place}</p>
                    <p><strong>Description:</strong> {meal.description}</p>
                  </div>
                ))}
              </div>
            ))
          }
        </div>

      </div>

    </>
  )
}

export default Result