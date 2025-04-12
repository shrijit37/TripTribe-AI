import { useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { getPlaces, PHOTO_REF_URL } from "../services/GlobalApi";
import GridDistortion from '../components/GridDistortion';
import ActivityCard from '../components/ActivityCard';


const Result = () => {

  const [imageUrl, setImageUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  let location = useLocation();
  const state = location.state;
  // if (!state) {
  //   return <div className="text-xl">No data availible please try again later.</div>;
  // }
  // console.log(state);


  // useEffect(() => {

  //   const GetPlacePhoto = async () => {
  //     try {
  //       const data = {
  //         // textQuery: state.city.IconicPlace, 
  //         textQuery: state.city.name
  //         // Use the state name for the query
  //       };
  //       const result = await getPlaces(data);
  //       const photos = result.data.places[0]?.photos;

  //       if (photos && photos.length > 4) {
  //         const PhotoUrl = PHOTO_REF_URL.replace("{NAME}", photos[4].name);
  //         console.log(imageUrl)
  //         setImageUrl(PhotoUrl);
  //       } else {
  //         console.error("Photos array is empty or index out of bounds");
  //         setImageUrl(null); // Fallback in case of error
  //       }
  //     } catch (error) {
  //       console.error("Error fetching place photo:", error);
  //       setImageUrl(null); // Fallback in case of error
  //     }
  //   }
  //   state && GetPlacePhoto();
  // }, [state])
  
  useEffect(()=>{
    const getPhoto = async () => {
      try{
        const data = await fetch(`https://www.googleapis.com/customsearch/v1?q=${state.city.IconicPlace}&searchType=image&cx=c63fff3e039f04940&key=${import.meta.env.VITE_GOOGLE_CUSTOM_SEARCH_API_KEY}`).then((res) => res.json())
        
        console.log(data.items[0].link);
        setImageUrl(data.items[0].link);
      } catch(e) {
        console.log(e)
      }
    }

    getPhoto();
  },[state]);


  return (
    <>
      {/* <div className='text-5xl text-center'>{state.city.name}</div> */}
      {/* <div className='text-5xl text-center'>{imageUrl}</div> */}


      <div className='flex items-end justify-end mx-10'>
        {saved && (<div className="badge badge-outline badge-success">Saved</div>)}
      </div>
      <div className=''>
        {/* <img
          crossOrigin="anonymous"
          src={fallBackImage} 
          alt="Image Not Found"
          className="w-[100vw] h-[60vh] object-cover block"
        />   */}

        <div style={{ width: '100%', height: '600px', position: 'relative' }}>
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
            {state.city.name}
          </div>

        </div>
        {/* <div className='text-3xl text-center m-2'>{state.city["Region/State"]}, {state.city.Country}</div> */}

        <div className='text-2xl text-center mx-28 m-4'>{state.city.description}</div>
        <div className='flex flex-wrap justify-evenly gap-4'>


        </div>
        <div className='flex-1 w-[100%] flex-row'>
          <button className="btn btn-success float-right" onClick={() => setSaved(true)}> + Save itenary</button>
          {
            state.itinerary.map((day, index) => (
              <div key={index} className='text-xl text-center mx-28 m-4'>
                <div className='text-4xl text-center m-4'>Day {`${index + 1}`}</div>
                <div className='text-3xl text-center m-4'>Activities</div>
                <div className='flex flex-wrap justify-evenly gap-4'>
                  {day.activities.map((activity, actIndex) => (
                    <div key={actIndex} className=''>
                      <ActivityCard activity={activity.place} description={activity.description} />
                    </div>
                  ))}
                </div>

                <div className='text-3xl text-center m-4'>Foods</div>
                <div className='flex flex-wrap justify-evenly gap-4'>
                  {Object.entries(day.meals).map(([mealType, meal], mealIndex) => (
                    <div key={mealIndex} className=''>
                      <ActivityCard activity={meal.place} description={meal.description} />
                      {/* <p><strong>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}:</strong> {meal.place}</p>
                     <p><strong>Description:</strong> {meal.placemeal.place}</p> */}
                    </div>
                  ))}
                </div>

                <div className="inline-flex items-center justify-center w-full relative mt-9">
                  <hr className="w-64 h-1 my-8 bg-gray-200 border-0 rounded-sm dark:bg-gray-700" />
                  <div className="absolute px-4 -translate-x-1/2 bg-white left-1/2 dark:bg-gray-900">
                    <svg
                      className="w-4 h-4 text-gray-700 dark:text-gray-300"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 18 14"
                    >
                      <path d="M6 0H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3H2a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3h-1a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Z" />
                    </svg>
                  </div>
                </div>

              </div>
            ))
          }
        </div>

      </div>

    </>
  )
}

export default Result