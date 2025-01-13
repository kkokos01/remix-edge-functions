import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * We'll define a system prompt that instructs the AI to return
 * a strict JSON with these fields:
 *
 * {
 *   "title": "...",
 *   "description": "...",
 *   "author_id": null or a UUID,
 *   "parent_recipe_id": null or a UUID,
 *
 *   "prep_time_minutes": number,
 *   "cook_time_minutes": number,
 *   "difficulty": 1..5,
 *   "servings": number,
 *
 *   "cuisine_type": "...",
 *   "meal_type": "...",
 *   "privacy_setting": "private" or "public",
 *   "status": "draft" or "published",
 *   "tags": [ "...", ... ],
 *
 *   "view_count": 0,
 *   "favorite_count": 0,
 *
 *   "calories_per_serving": number,
 *   "protein_grams": number,
 *   "carbs_grams": number,
 *   "fat_grams": number,
 *
 *   "ingredients": [
 *     {
 *       "ingredient_name": "...",
 *       "amount": number,
 *       "unit": "...",
 *       "notes": "...",
 *       "is_optional": boolean,
 *       "display_order": number
 *     }
 *   ],
 *
 *   "instructions": [
 *     {
 *       "step_number": number,
 *       "instruction_text": "...",
 *       "time_required": number,
 *       "critical_step": boolean,
 *       "equipment_needed": "... or null"
 *     }
 *   ]
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Here is the system prompt for Claude (or your chosen AI):
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must respond with one valid JSON object only — no extra commentary, markdown, or explanations. 
The JSON should provide a cooking recipe that includes each of the following fields:


{
  "title": "string, max 200 chars",
  "description": "string, max 2000 chars",
  "author_id": "string (uuid) or null",
  "parent_recipe_id": "string (uuid) or null",

  "prep_time_minutes": "integer > 0",
  "cook_time_minutes": "integer >= 0",
  "difficulty": "integer 1-5",
  "servings": "integer > 0",

  "cuisine_type": "string, max 50 chars",
  "meal_type": "string, max 50 chars",
  "privacy_setting": "string enum: private|public",
  "status": "string enum: draft|published",
  "tags": ["string, max 50 chars each, up to 20 tags"],

  "view_count": 0,
  "favorite_count": 0,

  "calories_per_serving": "number >= 0",
  "protein_grams": "number >= 0",
  "carbs_grams": "number >= 0",
  "fat_grams": "number >= 0",

  "ingredients": [
    {
      "ingredient_name": "string, max 200 chars",
      "amount": "number > 0",
      "unit": "string, max 20 chars",
      "notes": "string or null, max 500 chars",
      "is_optional": "boolean",
      "display_order": "integer > 0"
    }
  ],

  "instructions": [
    {
      "step_number": "integer > 0",
      "instruction_text": "string, max 1000 chars",
      "time_required": "integer >= 0",
      "critical_step": "boolean",
      "equipment_needed": "string or null, max 200 chars"
    }
  ]
}

- "title" is the recipe name.
- "description" is a concise summary or background for the recipe.
- "author_id" may be null if unknown.
- "parent_recipe_id" may be null if this is an original recipe (not a variation).
- "prep_time_minutes" and "cook_time_minutes" are integers.
- "difficulty" can be an integer 1 to 5 indicating how hard the recipe is (1 = easiest, 5 = hardest).
- "servings" is an integer number of servings.
- "cuisine_type" and "meal_type" are strings like 'Italian', 'Breakfast', etc.
- "privacy_setting" can be 'private' or 'public'.
- "status" can be 'draft' or 'published'.
- "tags" is an array of strings (e.g. ["vegetarian", "spicy"]).
- "calories_per_serving" and "protein_grams" are integers or can be 0 if unknown.
- Each "ingredients" object must have "ingredient_name", "amount", "unit", "notes", and "is_optional".
- Each "instructions" object must have "step_number", "instruction_text", "time_required", "critical_step", and "equipment_needed".

Return only valid JSON. No extra text or explanations. 
`;

// Serve the function
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    // We build messages for your AI call:
    const messages = [
      { role: "system", content: CLAUDE_SYSTEM_PROMPT },
      { role: "user", content: `User wants a new recipe. Prompt: "${prompt}"` },
    ];

    // Call Anthropics, OpenAI, or wherever you handle your AI:
    // Example for Anthropics:
    const result = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-2", // or "claude-3" or your chosen model
        messages,
        max_tokens: 1200,
        temperature: 0.7
      })
    });

    if (!result.ok) {
      throw new Error(`Anthropic error: ${result.status} ${result.statusText}`);
    }

    const jsonResult = await result.json();

    // anthropic's text might be in something like jsonResult.content[0].text
    // For demonstration, we'll assume something like:
    const rawText = jsonResult?.content?.[0]?.text || "{}";

    // Return that raw JSON back to the client
    return new Response(rawText, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-recipe:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate recipe", details: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
