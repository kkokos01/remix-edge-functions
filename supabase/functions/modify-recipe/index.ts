import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------
// Claude Prompt (System)
// ---------------------
//
// This is your new, strict schema prompt. We'll place it in the "system" role message
// so Claude knows exactly how to format the JSON output.
//
// NOTE: Keep the triple backticks or quotes EXACT so Anthropic reads it cleanly.

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract the user's raw prompt from JSON body
    const { prompt } = await req.json();

    // Build the message array for Claude
    // - The first message is "system" role with the strict JSON schema prompt
    // - The second message is "user" role with the user-provided recipe request
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

    // Call Anthropics' API with your model + message structure
    // Keep the rest of your code the same, just pass these messages
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",     // your chosen model
        messages,
        max_tokens: 1024,                     // or adjust as you wish
        temperature: 0.7                      // adjust sampling temperature as desired
      })
    });

    const result = await response.json();

    // According to your existing code, the text is found at: result.content[0].text
    // We'll assume that's correct for your Anthropic integration
    // We'll wrap it in { recipe: <the text> } as you were doing.

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
