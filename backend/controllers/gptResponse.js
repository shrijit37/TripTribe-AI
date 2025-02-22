import OpenAI from "openai";
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

const getPrompt = (days, cityName, budget) => {
    return `You are a professional travel planner with extensive experience in creating detailed itineraries for various destinations around the world. You specialize in designing personalized travel plans that maximize enjoyment while considering budget, proximity of attractions, and dining options.
Your task is to create a comprehensive travel itinerary based on the following details:  

Number of Days: ${days}
City Name: ${cityName}
Budget: rs ${budget}

Please generate a daily itinerary in JSON format that outlines places to visit each day, including breakfast, lunch, and dinner options. Make sure that the attractions are logically set, meaning they should be on the same route or in close proximity to each other. Each entry should include a brief description of the place, and ensure that the meal options are conveniently located near the day’s attractions. 
Keep in mind the following:  

The itinerary should include at least three activities per day.  
Provide a brief overview of the city, including its main attractions and cultural significance.  
Ensure that the dining options cater to a range of tastes and are within a reasonable distance from the day's activities.
give data in json  and write nothing else


Here is a sample structure for the JSON output:  
{
  "city": {
    "name": "________",
    "description": "________"
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
  ]
}`;
}

// to be passed no of days, cityName, budget 

const getResponse = asyncHandler(async (days, cityName, budget) => {
  const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [
        { 
          role: "system", 
          content: "You are a professional travel planner with extensive experience in creating detailed itineraries for various destinations around the world. You specialize in designing personalized travel plans that maximize enjoyment while considering budget, proximity of attractions, and dining options." 
        },
        {
          role: "user",
          content: getPrompt(days, cityName, budget),
        }
      ]
  });
  console.log(typeof(completion.choices[0].message.content));
  // Parse the response content as JSON
  return JSON.parse(completion.choices[0].message.content);
});


export default getResponse