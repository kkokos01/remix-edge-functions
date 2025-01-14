import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * CORS HEADERS
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * This is your updated prompt for Claude 3.5 Sonnet usage.
 * We keep your entire JSON schema instructions here, exactly.
 */
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must produce create a recipe and respond with one valid JSON object only — no commentary.
The JSON must follow this structure. Return null for any fields you're unsure about:

{
  "title": "string, required, max 200 chars",
  "description": "string, required, max 2000 chars",
  "author_id": null,
  "parent_recipe_id": null,

  "prep_time_minutes": "integer > 0, required",
  "cook_time_minutes": "integer ≥ 0, required",
  "difficulty": "integer 1–5, required",
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

Return only valid JSON matching this schema exactly. 
No extra text or explanations.  
`.trim();

/**
 * MAIN SERVE
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const { prompt } = await req.json();
      if (!prompt) {
        throw new Error("No prompt provided");
      }

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment");
      }

      const messages = [
        { role: "system", content: CLAUDE_SYSTEM_PROMPT },
        { role: "user", content: `Generate a recipe based on this request: "${prompt}"` }
      ];

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
          max_tokens: 16384,
          temperature: 0.5
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const result = await response.json();
      const recipeText = result?.content?.[0]?.text || "{}";

      // Try to parse the JSON
      let recipeData;
      try {
        recipeData = JSON.parse(recipeText);
      } catch (error) {
        // Return partial response with error indication
        return new Response(JSON.stringify({
          complete: false,
          error: "Failed to parse recipe JSON",
          raw: recipeText
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 200  // Still return 200 since we're handling the error gracefully
        });
      }

      // Check for required fields
      const requiredFields = ["title", "description", "ingredients", "instructions"];
      const missingFields = requiredFields.filter(field => !recipeData[field]);

      return new Response(JSON.stringify({
        complete: missingFields.length === 0,
        data: recipeData,
        missingFields: missingFields.length > 0 ? missingFields : undefined
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (error) {
      console.error("Error generating recipe:", error);
      return new Response(
        JSON.stringify({ 
          complete: false,
          error: error.message 
        }),
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

  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
