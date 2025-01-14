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
 * Step 2: HARDCODE your Supabase anon key here (No placeholders).
 */
const HARDCODED_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaHdqemN3bGVqaXVudHltd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NjMzMDAsImV4cCI6MjA1MjAzOTMwMH0.TDGkirSHadkUjImAr2dRKHcsiscZQqWoHJp6b3B31ko";

/**
 * Step 3: Anthropic Key (reads from Supabase environment variable)
 */
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";

/**
 * Step 4: System Prompt for "Generate" Flow
 *
 * NOTE: This includes your full JSON schema. 
 * Modify if you want to adjust the shape/rules. 
 */
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that creates recipes in a very specific format, you must respond with one valid JSON object only — 
no commentary, markdown, or explanations.

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

    // (B) Parse user input (only "prompt")
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing field: prompt" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // (C) Prepare messages for Claude
    const messages = [
      {
        role: "system",
        content: CLAUDE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `User request (new recipe): "${prompt}"`,
      },
    ];

    // (D) Call Anthropic using Claude 3.5 Sonnet
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "Content-Type": "application/json",
        // updated version if needed:
        "anthropic-version": "2023-10-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        messages,
        max_tokens: 8192, // or 1024 if you prefer
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      // optionally capture the entire error body
      const errorBody = await response.text();
      console.error("Anthropic error body:", errorBody);
      throw new Error(`Anthropic API error: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();

    // (E) Return the raw JSON from Claude
    return new Response(result.content[0].text, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in generate-recipe:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate recipe",
        details: String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
