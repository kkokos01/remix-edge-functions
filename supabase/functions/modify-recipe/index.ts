import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Step 1: CORS Setup
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Step 2: HARDCODE your Supabase anon key here (same as generate).
 */
const HARDCODED_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaHdqemN3bGVqaXVudHltd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NjMzMDAsImV4cCI6MjA1MjAzOTMwMH0.TDGkirSHadkUjImAr2dRKHcsiscZQqWoHJp6b3B31ko";

/**
 * Step 3: Anthropic Key (from env)
 */
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";

/**
 * Step 4: System Prompt for "Modify" Flow
 *
 * This uses the same JSON structure,
 * but references priorRecipe + modifyPrompt in the user message.
 */
const CLAUDE_SYSTEM_PROMPT_MODIFY = `
You are an AI that must respond with one valid JSON object only — 
no commentary, markdown, or explanations.

The JSON must follow this exact structure and validation rules (same as 'generate-recipe'):

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

You must read the "priorRecipe" JSON, then apply modifications from "modifyPrompt" to produce the final JSON. 
Return only valid JSON, with no extra text or explanation.
`.trim();

/**
 * Step 5: Serve the Function
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Enforce POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // (A) Bearer Token Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${HARDCODED_SUPABASE_ANON_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // (B) Parse user inputs: priorRecipe & modifyPrompt
    const { priorRecipe, modifyPrompt } = await req.json();
    if (!priorRecipe || !modifyPrompt) {
      return new Response(
        JSON.stringify({
          error: "Missing fields: priorRecipe and modifyPrompt",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // (C) Build messages for Anthropic
    const messages = [
      {
        role: "system",
        content: CLAUDE_SYSTEM_PROMPT_MODIFY,
      },
      {
        role: "user",
        content: `
Existing recipe JSON:
${JSON.stringify(priorRecipe, null, 2)}

User's modification request:
"${modifyPrompt}"
`.trim(),
      },
    ];

    // (D) Call Anthropic
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic API error: ${response.status} - ${response.statusText}`
      );
    }

    const result = await response.json();

    // (E) Return the raw JSON
    return new Response(result.content[0].text, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Error in modify-recipe:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to modify recipe",
        details: String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
