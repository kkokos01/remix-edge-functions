import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 *  CORS HEADERS - identical approach as generate
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * The system prompt: must preserve the same schema from priorRecipe,
 * only altering fields based on user instructions (modifyPrompt).
 */
const CLAUDE_SYSTEM_PROMPT_MODIFY = `
You are an AI that must respond with one valid JSON object only — no extra text or explanations.
It must match the same strict schema as the original recipe:

{
  // Basic Information
  "title": "...",
  "description": "...",
  "author_id": "...",
  "parent_recipe_id": "...",

  // Timing and Difficulty
  "prep_time_minutes": "...",
  "cook_time_minutes": "...",
  "difficulty": "...",
  "servings": "...",

  // Classification
  "cuisine_type": "...",
  "meal_type": "...",
  "privacy_setting": "...",
  "status": "...",
  "tags": [...],

  // Stats (initialized to 0)
  "view_count": 0,
  "favorite_count": 0,

  // Nutritional Information
  "calories_per_serving": "...",
  "protein_grams": "...",
  "carbs_grams": "...",
  "fat_grams": "...",

  // Recipe Components
  "ingredients": [...],
  "instructions": [...]
}

You will receive:
1) The entire prior recipe JSON
2) The user's new instructions
Preserve the same fields, but update them per user's request. No extra commentary.
`.trim();

serve(async (req) => {
  // (A) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // (B) POST logic
  if (req.method === "POST") {
    try {
      const { priorRecipe, modifyPrompt } = await req.json();
      if (!priorRecipe) {
        throw new Error("No priorRecipe provided. Must be full JSON from generate or last modify.");
      }

      // 1) Build messages
      const messages = [
        { role: "system", content: CLAUDE_SYSTEM_PROMPT_MODIFY },
        {
          role: "user",
          content: `
Existing recipe JSON:
${JSON.stringify(priorRecipe, null, 2)}

User's modifications:
"${modifyPrompt}"
        `.trim()
        }
      ];

      // 2) Call Anthropics
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
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

      if (!aiResp.ok) {
        throw new Error(`AI call error: ${aiResp.status} ${aiResp.statusText}`);
      }

      const aiJson = await aiResp.json();
      // 3) The new updated JSON
      const rawText = aiJson?.content?.[0]?.text || "{}";

      return new Response(rawText, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (err) {
      console.error("Error in modify-recipe:", err);
      return new Response(
        JSON.stringify({ error: String(err) }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }
  }

  // (C) 405 if not POST/OPTIONS
  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
