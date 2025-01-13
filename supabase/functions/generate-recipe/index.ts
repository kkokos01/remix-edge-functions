import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * 1) CORS HEADERS
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * 2) STRICT SCHEMA PROMPT
 */
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
`.trim();

serve(async (req) => {
  // 1) Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2) Enforce Bearer Token
  //    If you'd like to require a specific token (like your Supabase anon key),
  //    check it here. For now, we just check that *some* Authorization header is present.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized (missing Bearer token)" }), {
      headers: corsHeaders,
      status: 401
    });
  }

  // 3) If method is POST, handle the main logic
  if (req.method === "POST") {
    try {
      // A) Parse user prompt
      const { prompt } = await req.json();
      if (!prompt) {
        throw new Error("No prompt provided.");
      }

      // B) Prepare messages for Claude
      const messages = [
        {
          role: "system",
          content: CLAUDE_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `User request: "${prompt}"`
        }
      ];

      // C) Retrieve your Anthropic key from environment secrets
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        // If not found, throw error so user sees 400
        throw new Error("Missing ANTHROPIC_API_KEY in environment secrets.");
      }

      // D) Call Anthropic
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
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

      if (!aiResp.ok) {
        throw new Error(`AI call error: ${aiResp.status} ${aiResp.statusText}`);
      }

      const aiJson = await aiResp.json();
      // E) The final JSON text from Claude is presumably in content[0].text
      const rawText = aiJson?.content?.[0]?.text || "{}";

      // F) Return it with the correct CORS
      return new Response(rawText, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (err) {
      console.error("Error in generate-recipe:", err);
      return new Response(
        JSON.stringify({ error: String(err) }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }
  }

  // 4) If not POST or OPTIONS, 405
  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
