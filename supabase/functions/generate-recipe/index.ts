import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Define CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Define the schema requirements for Claude's response
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must respond with one valid JSON object only — no commentary or explanations.
The JSON must follow this exact structure and validation rules:

{
  "title": "string, required, max 200 chars",
  "description": "string, required, max 2000 chars",
  "author_id": null,
  "parent_recipe_id": null,
  
  "prep_time_minutes": "integer > 0, required",
  "cook_time_minutes": "integer ≥ 0, required",
  "difficulty": "integer 1-5, required",
  "servings": "integer > 0, required",
  
  "cuisine_type": "string, required, max 50 chars",
  "meal_type": "string, required, max 50 chars",
  "privacy_setting": "private",
  "status": "draft",
  "tags": ["string array, max 50 chars per tag"],
  
  "view_count": 0,
  "favorite_count": 0,
  
  "calories_per_serving": "number ≥ 0",
  "protein_grams": "number ≥ 0",
  "carbs_grams": "number ≥ 0",
  "fat_grams": "number ≥ 0",
  
  "ingredients": [
    {
      "ingredient_name": "string, required",
      "amount": "number > 0",
      "unit": "string, required",
      "notes": "string or null",
      "is_optional": false,
      "display_order": "integer > 0"
    }
  ],
  
  "instructions": [
    {
      "step_number": "integer > 0",
      "instruction_text": "string, required",
      "time_required": "integer ≥ 0",
      "critical_step": "boolean",
      "equipment_needed": "string or null"
    }
  ]
}
`.trim();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle POST requests for recipe generation
  if (req.method === "POST") {
    try {
      // Parse the request body
      const { prompt } = await req.json();
      if (!prompt) {
        throw new Error("No prompt provided");
      }

      // Get the Anthropic API key from environment variables
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment");
      }

      // Prepare the messages for Claude
      const messages = [
        { role: "system", content: CLAUDE_SYSTEM_PROMPT },
        { role: "user", content: `Generate a recipe based on this request: "${prompt}"` }
      ];

      // Call the Anthropic API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          messages,
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const result = await response.json();
      const recipeJson = result?.content?.[0]?.text || "{}";

      // Return the generated recipe
      return new Response(recipeJson, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (error) {
      console.error("Error generating recipe:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 400
        }
      );
    }
  }

  // Handle unsupported methods
  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
