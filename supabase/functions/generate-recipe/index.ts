import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

////////////////////////////////////////////////////
// 1. Basic CORS Setup
////////////////////////////////////////////////////
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": 
    "authorization, x-client-info, apikey, content-type",
};

////////////////////////////////////////////////////
// 2. System Prompt for Claude
////////////////////////////////////////////////////
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must respond with one valid JSON object only — no commentary, markdown, or explanations. 
The JSON must follow this exact structure and validation rules:

{
  // Basic Information
  "title": "string, required, max 200 chars",
  "description": "string, required, max 2000 chars",
  "author_id": "uuid or null",
  "parent_recipe_id": "uuid or null",
  
  // Timing and Difficulty
  "prep_time_minutes": "integer > 0, required",
  "cook_time_minutes": "integer ≥ 0, required",
  "difficulty": "integer 1-5, required (1 = easiest, 5 = hardest)",
  "servings": "integer > 0, required",
  
  // Classification
  "cuisine_type": "string, required, max 50 chars",
  "meal_type": "string, required, max 50 chars",
  "privacy_setting": "string enum: private|public, required",
  "status": "string enum: draft|published, required",
  "tags": ["string, max 50 chars per tag, max 20 tags"],
  
  // Stats (initialized to 0)
  "view_count": 0,
  "favorite_count": 0,
  
  // Nutritional Information (all required)
  "calories_per_serving": "number ≥ 0",
  "protein_grams": "number ≥ 0, precision: 0.1",
  "carbs_grams": "number ≥ 0, precision: 0.1",
  "fat_grams": "number ≥ 0, precision: 0.1",
  
  // Recipe Components
  "ingredients": [
    {
      "ingredient_name": "string, required, max 200 chars",
      "amount": "number > 0, required",
      "unit": "string, required, max 20 chars",
      "notes": "string or null, max 500 chars",
      "is_optional": "boolean, required",
      "display_order": "integer > 0, required"
    }
  ],
  
  "instructions": [
    {
      "step_number": "integer > 0, required",
      "instruction_text": "string, required, max 1000 chars",
      "time_required": "integer ≥ 0, required",
      "critical_step": "boolean, required",
      "equipment_needed": "string or null, max 200 chars"
    }
  ]
}

Return only valid JSON matching this schema exactly. No extra text or explanations.
`;

////////////////////////////////////////////////////
// 3. Serve the Function
////////////////////////////////////////////////////
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // (A) Parse user input from request body
    const { prompt } = await req.json();

    // (B) Build message array for Claude
    const messages = [
      {
        role: "system",
        content: CLAUDE_SYSTEM_PROMPT.trim()
      },
      {
        role: "user",
        content: `User request: "${prompt}"`
      }
    ];

    // (C) Call Anthropics' API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229", // or your chosen Claude model
        messages,
        max_tokens: 1024,                  // adjust as desired
        temperature: 0.7                   // adjust sampling as desired
      })
    });

    const result = await response.json();

    // (D) Return JSON with the newly generated recipe
    return new Response(
      JSON.stringify({ recipe: result.content[0].text }),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        }
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate recipe" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
