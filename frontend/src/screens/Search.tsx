"use client";

import Stepper, { Step } from '@/components/Components/Stepper/Stepper';
import { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import { PlanRequestError, postItinerary } from '@/lib/api';
import { onMapsReady } from '@/lib/maps';
import { storeResult, takeSeed } from '@/lib/nav';
import type { MapsAutocomplete } from '@/lib/maps';
import { useAppSelector } from '@/store';

const Search = () => {
    // Seeded from the landing page's slip, so the visitor never retypes what
    // they just told us. Still fully editable here.
    const [cityName, setCityName] = useState('');
    // Held as strings so a half-typed number is still editable, and bound to
    // the inputs as values — previously they were uncontrolled, so the seeded
    // figures were invisible while state silently carried them to the API.
    const [days, setDays] = useState('');
    const [budget, setBudget] = useState('');
    const [reload, setReload] = useState(0);
    const [startStep, setStartStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1); // Track the current step
    const userInfo = useAppSelector((state) => state.auth);
    const email = userInfo.userInfo ? userInfo.userInfo.email : '';

    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<MapsAutocomplete | null>(null);
    const [, setCitySelected] = useState(false);

    const router = useRouter();

    // `react-router`'s `location.state` has no App Router equivalent, so the
    // slip is parked in `sessionStorage` by the landing page under
    // `triptribe:hero-seed` and claimed once here. An absent or malformed
    // value seeds empty strings — the same as a first-time visitor.
    useEffect(() => {
        const seed = takeSeed();
        setCityName(seed?.cityName ?? '');
        setDays(seed?.days ?? '');
        setBudget(seed?.budget ?? '');
    }, []);

    // Same bounds the API enforces (backend/config/schema.js REQUEST_LIMITS).
    // Checked here so the user is told which field is wrong before a round
    // trip; checked there because a form is not a security boundary.
    const daysNum = Number(days);
    const budgetNum = Number(budget);
    const cityOk = cityName.trim().length > 1;
    const daysOk = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 60;
    const budgetOk = Number.isFinite(budgetNum) && budgetNum >= 1000;
    const ready = cityOk && daysOk && budgetOk;

    // Function to initialize Google Places Autocomplete
    const initializeAutocomplete = () => {
        if (!window.google?.maps?.places || !inputRef.current) return;
        if (autocompleteRef.current) return;
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
    };

    // Initialize Autocomplete when the "City Name" step is active.
    // Maps readiness is signalled by `@/lib/maps` (loading=async defers
    // execution), so this no longer polls on a timer.
    useEffect(() => {
        if (currentStep !== 2) return;

        const unsubscribe = onMapsReady(initializeAutocomplete);
        initializeAutocomplete();

        return () => {
            unsubscribe();
            if (autocompleteRef.current && window.google?.maps?.event) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
    }, [currentStep]); // Re-run when currentStep changes

    const fetchData = async () => {
        try {
            const response = await postItinerary({
                days: daysNum,
                cityName: cityName.trim(),
                budget: budgetNum,
                email: email,
            });
            if (response) {
                storeResult(response);
                router.push('/result');
            }
        } catch (error) {
            console.error('Error fetching itinerary:', error);
            // A 400 names the offending fields; anything else is not the
            // user's input and should not be described as though it were.
            if (error instanceof PlanRequestError && error.status === 400) {
                const details = error.details ?? [];
                const summary = details.length
                    ? details.map((d) => d.message).join(' ')
                    : 'Please check the details you entered.';
                toast.error(summary);
            } else {
                toast.error('Failed to generate itinerary. Please try again.');
            }
            setLoading(false);
        }
    };

    const searchHandler = async () => {
        if (ready) {
            setLoading(true);
            fetchData();
            return;
        }
        // The failing step is named, and the stepper is reset so the offending
        // field is back on screen instead of hidden behind a confirm page.
        const message = !cityOk
            ? 'Name the city you are planning for.'
            : !daysOk
              ? 'Enter how many days — between 1 and 60.'
              : 'Enter a total budget of at least ₹1,000.';
        toast.error(message);
        // `key={reload}` remounts the Stepper, so initialStep is how the
        // failing field is brought back into view — the parent's step-tracking
        // state does not control which step the Stepper displays.
        setStartStep(!cityOk ? 2 : !daysOk ? 4 : 3);
        setReload((prev) => prev + 1);
    };

    return (
        <div className="w-full min-h-[90vh] flex flex-col lg:flex-row">
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
                <div className="flex flex-col items-center justify-center w-full py-20">
                    <span className="loading loading-bars loading-lg"></span>
                    <div className="text-md">Loading...</div>
                </div>
            ) : (
                <div className="flex" key={reload}>
                    <Stepper
                        initialStep={startStep}
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
                            <h2>
                                <label htmlFor="tt-search-budget">Total Budget</label>
                            </h2>
                            <input
                                id="tt-search-budget"
                                type="number"
                                min="1000"
                                step="100"
                                inputMode="numeric"
                                placeholder="48000"
                                value={budget}
                                className="input input-bordered w-full max-w-xs mt-5"
                                aria-invalid={budget !== '' && !budgetOk}
                                onChange={(e) => setBudget(e.target.value)}
                            />
                            {budget !== '' && !budgetOk && (
                                <p className="text-sm text-error mt-2" role="alert">
                                    At least ₹1,000.
                                </p>
                            )}
                        </Step>
                        <Step>
                            <h2>
                                <label htmlFor="tt-search-days">Number of days</label>
                            </h2>
                            <input
                                id="tt-search-days"
                                type="number"
                                min="1"
                                max="60"
                                inputMode="numeric"
                                placeholder="4"
                                value={days}
                                className="input input-bordered w-full max-w-xs mt-5"
                                aria-invalid={days !== '' && !daysOk}
                                onChange={(e) => setDays(e.target.value)}
                            />
                            {days !== '' && !daysOk && (
                                <p className="text-sm text-error mt-2" role="alert">
                                    Between 1 and 60 days.
                                </p>
                            )}
                        </Step>
                        <Step>
                            <h2 className="text-xl font-semibold text-[#4083ff] mb-4">Confirm Details:</h2>
                            <h4 className="text-md font-semibold text-[#ffffff] mb-4">
                                City Name: <span className="font-medium text-[#40ffaa]">{cityName}</span>
                            </h4>
                            <h4 className="text-md font-semibold text-[#ffffff] mb-4">
                                Budget: <span className="font-medium text-[#40ffaa]">₹{Number(budget).toLocaleString('en-IN')}</span>
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