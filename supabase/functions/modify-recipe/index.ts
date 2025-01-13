import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Add Access-Control-Allow-Methods
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // 1) Handle the preflight
  if (req.method === "OPTIONS") {
    // Return a 200 (OK) with the necessary CORS headers
    return new Response("ok", { headers: corsHeaders });
  }

  // 2) For POST, do your normal logic:
  try {
    // ... read the JSON body, call your AI, etc. ...
    // (Your existing prompt code remains the same)

    // Return the raw JSON or however you're returning it
    return new Response(rawText, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

// We'll reuse the same schema, but instruct the AI it must keep existing fields intact
const CLAUDE_SYSTEM_PROMPT_MODIFY = `
You are an AI that must respond with one valid JSON object only — no extra text or explanations.
It must match the schema:

{
  "title": "...",
  "description": "...",
  "author_id": "...",
  "parent_recipe_id": "...",

  "prep_time_minutes": ...,
  "cook_time_minutes": ...,
  "difficulty": ...,
  "servings": ...,

  "cuisine_type": "...",
  "meal_type": "...",
  "privacy_setting": "...",
  "status": "...",
  "tags": [...],

  "view_count": 0,
  "favorite_count": 0,

  "calories_per_serving": ...,
  "protein_grams": ...,
  "carbs_grams": ...,
  "fat_grams": ...,

  "ingredients": [...],
  "instructions": [...]
}

You will receive:
1) The entire prior recipe as JSON
2) The user's new instructions
Preserve the structure, only update fields as needed. No extra commentary.
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priorRecipe, modifyPrompt } = await req.json();
    if (!priorRecipe) {
      throw new Error("No priorRecipe provided. Must include the existing recipe JSON.");
    }

    const messages = [
      {
        role: "system",
        content: CLAUDE_SYSTEM_PROMPT_MODIFY
      },
      {
        role: "user",
        content: `
Existing recipe JSON:
${JSON.stringify(priorRecipe, null, 2)}

User's modification request:
"${modifyPrompt}"
      `.trim()
      }
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
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
      throw new Error(`Anthropic error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const rawText = result?.content?.[0]?.text || "{}";

    // Return the updated recipe JSON
    return new Response(rawText, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Error in modify-recipe:", err);
    return new Response(
      JSON.stringify({ error: "Failed to modify recipe", details: String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
