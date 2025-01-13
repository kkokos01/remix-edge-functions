import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLAUDE_SYSTEM_PROMPT = `
You are an AI that modifies recipes. You must respond with one valid JSON object only — no commentary.
You will receive the original recipe JSON and modification instructions.
Preserve all fields while implementing the requested changes.

The JSON must maintain this structure:
{
  "title": "string, required, max 200 chars",
  "description": "string, required, max 2000 chars",
  "author_id": "same as input",
  "parent_recipe_id": "same as input",
  
  "prep_time_minutes": "integer > 0",
  "cook_time_minutes": "integer ≥ 0",
  "difficulty": "integer 1-5",
  "servings": "integer > 0",
  
  "cuisine_type": "string, max 50 chars",
  "meal_type": "string, max 50 chars",
  "privacy_setting": "private",
  "status": "draft",
  "tags": ["string array"],
  
  "view_count": "same as input",
  "favorite_count": "same as input",
  
  "calories_per_serving": "number ≥ 0",
  "protein_grams": "number ≥ 0",
  "carbs_grams": "number ≥ 0",
  "fat_grams": "number ≥ 0",
  
  "ingredients": [
    {
      "ingredient_name": "string",
      "amount": "number > 0",
      "unit": "string",
      "notes": "string or null",
      "is_optional": "boolean",
      "display_order": "integer > 0"
    }
  ],
  
  "instructions": [
    {
      "step_number": "integer > 0",
      "instruction_text": "string",
      "time_required": "integer ≥ 0",
      "critical_step": "boolean",
      "equipment_needed": "string or null"
    }
  ]
}
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const { priorRecipe, modifyPrompt } = await req.json();
      if (!priorRecipe) {
        throw new Error("No prior recipe provided");
      }
      if (!modifyPrompt) {
        throw new Error("No modification prompt provided");
      }

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment");
      }

      const messages = [
        { role: "system", content: CLAUDE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `
Original recipe:
${JSON.stringify(priorRecipe, null, 2)}

Modification request: "${modifyPrompt}"
          `.trim()
        }
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
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const result = await response.json();
      const modifiedRecipeJson = result?.content?.[0]?.text || "{}";

      return new Response(modifiedRecipeJson, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (error) {
      console.error("Error modifying recipe:", error);
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

  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
