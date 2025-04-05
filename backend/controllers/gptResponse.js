import OpenAI from "openai";
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_KEY,
});

const getPrompt = (days, cityName, budget) => {
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


Here is a sample structure for the JSON output:  
{
  "city": {
    "name": "________",
    "Region/State" : "______",
    "Country" : "______",
    "description": "________",
    "Icomic place" : "_______"
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
  ]
}`;
}

// Function to clean the response text from markdown or any other formatting
const cleanJsonResponse = (text) => {
  // Remove markdown code block syntax if present
  let cleaned = text.replace(/```(json)?|```/g, '');
  cleaned = cleaned.replace(/[^\x00-\x7F]+/g, "");
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
};

// to be passed no of days, cityName, budget 
const getResponse = asyncHandler(async (days, cityName, budget) => {
  try {
    const completion = await openai.chat.completions.create({
        model: "google/gemini-2.0-flash-lite-001", 
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
    
    if (!completion.choices[0].message.content) {
      console.log("Empty response from OpenAI, retrying...");
      return await getResponse(days, cityName, budget);
    }
    
    // Clean the response before parsing
    const content = completion.choices[0].message.content;
    const cleanedContent = cleanJsonResponse(content);
    
    try {
      // Attempt to parse the cleaned content
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      console.log("Problematic content:", cleanedContent);
      // If parsing fails, retry the API call
      return await getResponse(days, cityName, budget);
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
});

export default getResponse;