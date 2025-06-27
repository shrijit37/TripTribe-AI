
export default function getPrompt(days, cityName, budget) {
    return `[Ensure you response is in english no matter what!]You are a professional travel planner with extensive experience in creating detailed itineraries for various destinations around the world. You specialize in designing personalized travel plans that maximize enjoyment while considering budget, proximity of attractions, and dining options.
Your task is to create a comprehensive travel itinerary based on the following details:  

Number of Days: ${days}
City Name: ${cityName}
Budget: rs ${budget}

Please generate a daily itinerary in JSON format that outlines places to visit each day, including breakfast, lunch, and dinner options. Make sure that the attractions are logically set, meaning they should be on the same route or in close proximity to each other. Each entry should include a brief description of the place, and ensure that the meal options are conveniently located near the day's attractions. 
Keep in mind the following:  

The itinerary should include at least three activities per day.  
Provide a brief overview of the city, including its main attractions and cultural significance.  
Ensure that the dining options cater to a range of tastes and are within a reasonable distance from the day's activities.
give data in json and write nothing else
Only mention hotels that are in the speceified budget give atleast 5 hotels for each destinations.

Here is a sample structure for the JSON output:  
{
  "city": {
    "name": "________",
    "Region/State" : "______",
    "Country" : "______",
    "description": "________",
    "IconicPlace" : "_______",
    "BestTimeToVisit": "________",
    "Currency": "________",
    "Language": "________",
    "PopularDishes": ["________", "________", "________"],
    "SafetyTips": "________",
    "EmergencyNumbers": {
      "Police": "________",
      "Medical": "________",
      "Fire": "________"
    },
  },
  "Reach" : {
    "nearestAirport":[Airport Name, Distance from city],
    "nearestRailwayStation":[Railway Station Name, Distance from city],
    "nearestBusStation":[Bus Station Name, Distance from city],
    "localTransportation": "________",
  }, 
  Tips: {
  [array of tips for the city, e.g., "Stay hydrated", "Carry local currency for small purchases", "Respect local customs and traditions"]
  }, 
  Budget : {
    "total": "________",
    "breakdown": {
      "accommodation": "________",
      "meals": "________",
      "activities": "________",
      "transportation": "________"
    },
    insufficientBudget: True/False,
    alternativeOptions: "________",
    averageTotalCost: "________",
    averageAccommodationCost: "________",
    insufficientBudgetMessage: "________"

  },
  "itinerary": [
    {
      "day": 1,
      "activities": [
        {
          "place": "________",
          "description": "________"
        },
        {
          "place": "________",
          "description": "________"
        },
        {
          "place": "________",
          "description": "________"
        }
      ],
      "meals": {
        "breakfast": {
          "place": "________",
          "description": "________"
        },
        "lunch": {
          "place": "________",
          "description": "________"
        },
        "dinner": {
          "place": "________",
          "description": "________"
        }
      }
    },
    {
      "day": 2,
      "activities": [
        {
          "place": "________",
          "description": "________"
        },
        {
          "place": "________",
          "description": "________"
        },
        {
          "place": "________",
          "description": "________"
        }
      ],
      "meals": {
        "breakfast": {
          "place": "________",
          "description": "________"
        },
        "lunch": {
          "place": "________",
          "description": "________"
        },
        "dinner": {
          "place": "________",
          "description": "________"
        }
      }
    }
  ],
  hotels:[
    "hotelName": {
    hotelName:
      location:
      prices: 
      rating:
    },
    "hotelName": {
      hotelName:
      location:
      prices: 
      rating:
    }
      "hotelName": {
      hotelName:
      location:
      prices: 
      rating:
    }
      "hotelName": {
      hotelName:
      location:
      prices: 
      rating:
    },
    "hotelName": {
    hotelName:
      location:
      prices: 
      rating:
    }
  ]
}`;
}