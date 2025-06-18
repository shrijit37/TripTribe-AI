import GridDistortion from '../components/GridDistortion';
import GradientText from '../components/TextAnimations/GradientText/GradientText'

// Change the import statement to react-router-dom
import { useNavigate } from 'react-router-dom';

const Hero = () => {
        let navigate = useNavigate();

       return (

        <div>

            <section>
                <div className="w-[100%] h-[600px] rounded-xl relative ">
                    <GridDistortion
                        imageSrc="https://picsum.photos/1920/1080?grayscale"
                        grid={12}
                        mouse={0.1}
                        strength={0.15}
                        relaxation={0.9}
                        className="custom-className='text-md'"
                    />
                </div>
            </section>

            <section className='flex content-center flex-col p-5'>
                <GradientText
                    colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
                    animationSpeed={6}
                    showBorder={false}
                    className="custom-class"
                >
                    Your Dream Trip, Perfectly Planned
                </GradientText>
                <div className='text-xl self-center my-2'>Discover the world with ease! Create personalized travel itineraries in minutes – tailored to your style, budget, and schedule. Start your adventure today!</div>
                <button className="btn btn-outline w-[150px] rounded-full self-center m-5" onClick={() => navigate("/search")}>Try it! ↗</button>
            </section>

            <section className='flex content-center flex-col p-5'>

                <div className='flex flex-row justify-between '>
                    <div className='flex justify-center flex-col items-center'>
                        <GradientText
                            colors={["#40ffaa", "#4079ff", "#ffc740", "#7940ff", "#ffffff", "#333333"]}
                            animationSpeed={6}
                            showBorder={false}
                            className="custom-class"
                        >
                            Why Choose TripTribe?
                        </GradientText>

                        <div className="w-[50%] mt-4">
                            <ul >
                                <li className='text-xl mb-7'>✨ Personalized Itineraries: Tell us your destination, travel dates, and interests, and we’ll craft a unique itinerary just for you.</li>
                                <li className='text-xl mb-7'>🌍 Endless Destinations: From bustling cities to hidden gems, explore the world your way.</li>
                                <li className='text-xl mb-7'>⏱️ Time-Saving: No more hours spent researching – we do the work for you.</li>
                                <li className='text-xl mb-7'>💡 Expert Recommendations: Discover top-rated attractions, restaurants, and activities curated by AI.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="w-[50%]"><img src="https://picsum.photos/1920/1080?grayscale" alt="" /></div>
                </div>
            </section>

            <section className='flex content-center flex-col p-5'>

                <div className='flex flex-row justify-around p-5'>
                    <div className="w-[50%]"><img src="https://picsum.photos/1920/1080?grayscale&random=2" alt="" /></div>

                    <div className='flex justify-center flex-col items-center'>
                        <GradientText
                            colors={["#40ffaa", "#4079ff", "#ff6f40", "#ff40b5", "#ffffff", "#1a1a1a"]}
                            animationSpeed={6}
                            showBorder={false}
                            className="custom-class"
                        >
                            How It Works
                        </GradientText>
                        <div className="w-[50%] m-9 mb-11">
                            <ul>
                                <li className='text-xl mb-7'>📍 Enter Your Details: Share your destination, travel dates, and preferences.</li>
                                <li className='text-xl mb-7'>⚡ Generate Your Itinerary: Our smart algorithm creates a customized plan in seconds.</li>
                                <li className='text-xl mb-7'>✏️ Customize & Save: Tweak your itinerary to perfection and save it for easy access.</li>
                                <li className='text-xl mb-7'>🎒 Pack Your Bags: You’re ready to explore with confidence!</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <section className='flex content-center flex-col p-5'>
                <div className='flex justify-center flex-col items-center'>
                    <GradientText
                        colors={["#40ffaa", "#4079ff", "#ff40ff", "#40ffff", "#000000", "#cccccc"]}
                        animationSpeed={6}
                        showBorder={false}
                        className="custom-class"
                    >
                        What Our Travellers Are Saying
                    </GradientText>

                    <div className="flex justify-around w-[100%] mt-11">
                        <div className="card bg-base-100 w-96 shadow-2xl outline">
                            <div className="card-body">
                                <h2 className="card-title">Rahul S.</h2>
                                <p>This itinerary planner saved me so much time! Everything was perfectly tailored to my trip.</p>
                            </div>
                        </div>

                        <div className="card bg-base-100 w-96 shadow-2xl outline">
                            <div className="card-body">
                                <h2 className="card-title">Sarah T.</h2>
                                <p>I used TripTribe for my trip to Japan, and it was a game-changer! The itinerary was so detailed and saved me so much time</p>
                            </div>
                        </div>
                        <div className="card bg-base-100 w-96 shadow-2xl outline">
                            <div className="card-body">
                                <h2 className="card-title">Mark L.</h2>
                                <p>Finally, a travel planner that actually understands what I want. Highly recommend!</p>

                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>

    )
}

export default Hero