import OpenAI from "openai";
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";
import getPrompt from "../config/prompt.js";

dotenv.config();

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_KEY,
});



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