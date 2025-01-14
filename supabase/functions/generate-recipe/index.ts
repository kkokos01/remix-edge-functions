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
You are an AI tasked with creating a recipe that must respond with one valid JSON object only — no commentary, markdown, or explanations.

The JSON must follow this exact structure and validation rules:

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
  // 1) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2) If POST, do the generation
  if (req.method === "POST") {
    try {
      // A) Parse the body
      const { prompt } = await req.json();
      if (!prompt) {
        throw new Error("No 'prompt' field provided in JSON.");
      }

      // B) Grab ANTHROPIC_API_KEY from environment
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment secrets.");
      }

      // C) Build request JSON
      // Notice we do NOT put { role: "system" } inside messages.
      // Instead we add a top-level system: CLAUDE_SYSTEM_PROMPT
      const bodyPayload = {
        model: "claude-3-5-sonnet-20241022", // or "claude-3-5-sonnet-latest"
        system: CLAUDE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `User request: "${prompt}"`
          }
        ],
        max_tokens: 1024,
        temperature: 0.7
      };

      // D) Call Anthropic with Claude 3.5 Sonnet
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const textErr = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${textErr}`);
      }

      // E) parse the text
      const result = await response.json();
      const rawText = result?.content?.[0]?.text || "{}";

      return new Response(rawText, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (error) {
      console.error("Error generating recipe:", error);
      const errMsg = {
        error: "Failed to generate recipe",
        details: String(error)
      };
      return new Response(JSON.stringify(errMsg), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }
  }

  // 3) If not POST or OPTIONS, return 405
  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
