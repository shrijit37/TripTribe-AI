import Stepper, { Step } from '../components/Components/Stepper/Stepper';
import { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';

const Search = () => {
    const [cityName, setCityName] = useState('');
    const [days, setDays] = useState(0);
    const [budget, setBudget] = useState(0);
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1); // Track the current step
    const userInfo = useSelector((state) => state.auth);
    const email = userInfo.userInfo ? userInfo.userInfo.email : '';

    const inputRef = useRef(null);
    const autocompleteRef = useRef(null);
    const [citySelected, setCitySelected] = useState(false);

    const navigate = useNavigate();

    // Function to initialize Google Places Autocomplete
    const initializeAutocomplete = () => {
        if (window.google && window.google.maps && window.google.maps.places && inputRef.current) {
            try {
                const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['(cities)'],
                    fields: ['name', 'place_id'],
                });

                // Add listener for when a place is selected
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place && place.name) {
                        setCityName(place.name);
                        setCitySelected(true);
                    }
                });

                // Store in ref for cleanup
                autocompleteRef.current = autocomplete;
            } catch (error) {
                console.error('Error initializing Places Autocomplete:', error);
            }
        } else {
            // Retry after a short delay if Google Maps API is not loaded
            setTimeout(initializeAutocomplete, 500);
        }
    };

    // Initialize Autocomplete when the "City Name" step is active
    useEffect(() => {
        if (currentStep === 2) {
            // Only initialize for the "City Name" step (Step 2, assuming 1-based indexing)
            initializeAutocomplete();
        }

        // Clean up listeners when the step changes or component unmounts
        return () => {
            if (autocompleteRef.current && window.google) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
    }, [currentStep]); // Re-run when currentStep changes

    const fetchData = async () => {
        try {
            const response = await axios.post(import.meta.env.VITE_ITENARY_API_URL, {
                days: days,
                cityName: cityName,
                budget: budget,
                email: email,
            });
            if (response) {
                navigate('/result', { state: response.data });
            }
        } catch (error) {
            console.error('Error fetching itinerary:', error);
            if (error.response) {
                console.error('Error response:', error.response);
            } else if (error.request) {
                console.error('Error request:', error.request);
            } else {
                console.error('Error message:', error.message);
            }
            toast.error('Failed to generate itinerary. Please try again.');
            setLoading(false);
        }
    };

    const searchHandler = async () => {
        console.log(cityName, days, budget);
        if (cityName && days && budget && citySelected) {
            setLoading(true);
            fetchData();
        } else {
            if (!citySelected) {
                toast('Make sure you select a city from the suggestions.');
            } else {
                toast('Please enter all the data.');
            }
            setReload((prev) => prev + 1);
        }
    };

    return (
        <div className="lg:w-[100vh] h-[90vh] flex flex-row">
            <ToastContainer
                position="bottom-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
            <img
                src="https://picsum.photos/1920/1080?grayscale&random=2"
                className="hidden lg:block"
                alt="Background"
            />

            {loading ? (
                <div className="flex flex-col items-center justify-center mx-[50vh]">
                    <span className="loading loading-bars loading-lg"></span>
                    <div className="text-md">Loading...</div>
                </div>
            ) : (
                <div className="flex" key={reload}>
                    <Stepper
                        initialStep={1}
                        onStepChange={(step) => {
                            setCurrentStep(step); // Update current step
                            console.log('Current step:', step);
                        }}
                        onFinalStepCompleted={() => {
                            searchHandler();
                        }}
                        backButtonText="Previous"
                        nextButtonText="Next"
                    >
                        <Step>
                            <div className="mb-8">
                                <div className="mb-8">
                                    <h2 className="text-xl font-semibold text-[#40ffaa] mb-4">How It Works</h2>
                                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                                        <li>
                                            Enter the <span className="font-medium text-white">city name</span> you want
                                            to visit.
                                        </li>
                                        <li>
                                            Set your <span className="font-medium text-white">total budget</span> for the
                                            trip.
                                        </li>
                                        <li>
                                            Choose the <span className="font-medium text-white">number of days</span> for
                                            your itinerary.
                                        </li>
                                        <li>
                                            Click{' '}
                                            <span className="font-medium text-[#40ffaa]">{"Generate Plan"}</span> to get
                                            your personalized travel itinerary!
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </Step>
                        <Step>
                            <h2>City Name</h2>
                            <input
                                type="text"
                                placeholder="Type city name"
                                ref={inputRef}
                                value={cityName}
                                className="input input-bordered w-full max-w-xs mt-5"
                                onChange={(e) => setCityName(e.target.value)}
                            />
                        </Step>
                        <Step>
                            <h2>Total Budget</h2>
                            <input
                                type="number"
                                placeholder="in INR"
                                className="input input-bordered w-full max-w-xs mt-5"
                                onChange={(e) => setBudget(Number(e.target.value))}
                            />
                        </Step>
                        <Step>
                            <h2>Number of days</h2>
                            <input
                                type="number"
                                placeholder="Enter numberBuild number of days"
                                className="input input-bordered w-full max-w-xs mt-5"
                                onChange={(e) => setDays(Number(e.target.value))}
                            />
                        </Step>
                        <Step>
                            <h2 className="text-xl font-semibold text-[#4083ff] mb-4">Confirm Details:</h2>
                            <h4 className="text-md font-semibold text-[#ffffff] mb-4">
                                City Name: <span className="font-medium text-[#40ffaa]">{cityName}</span>
                            </h4>
                            <h4 className="text-md font-semibold text-[#ffffff] mb-4">
                                Budget: <span className="font-medium text-[#40ffaa]">{budget}</span>
                            </h4>
                            <h4 className="text-md font-semibold text-[#ffffff] mb-4">
                                Number of days: <span className="font-medium text-[#40ffaa]">{days}</span>
                            </h4>
                        </Step>
                    </Stepper>
                </div>
            )}
        </div>
    );
};

export default Search;