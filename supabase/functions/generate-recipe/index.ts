import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Step 1: CORS Setup
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Step 2: HARDCODE your Supabase anon key here
 * Replace <PASTE_YOUR_FULL_ANON_KEY> with your actual key
 */
const HARDCODED_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaHdqemN3bGVqaXVudHltd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NjMzMDAsImV4cCI6MjA1MjAzOTMwMH0.TDGkirSHadkUjImAr2dRKHcsiscZQqWoHJp6b3B31ko";

/**
 * Step 3: Anthropic Key (unchanged)
 */
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";

/**
 * Step 4: System Prompt for Claude
 */
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must respond with one valid JSON object only — no commentary, markdown, or explanations.
... (the same JSON schema text you provided) ...
Return only valid JSON matching this schema exactly. No extra text or explanations.
`;

/**
 * Step 5: Serve the Function
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // (A) Enforce Bearer Token Check with your HARDCODED key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${HARDCODED_SUPABASE_ANON_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // (B) Parse user input
    const { prompt } = await req.json();

    // (C) Build messages for Claude
    const messages = [
      {
        role: "system",
        content: CLAUDE_SYSTEM_PROMPT.trim(),
      },
      {
        role: "user",
        content: `User request: "${prompt}"`,
      },
    ];

    // (D) Call the Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey, // do not change, it reads from supabase env
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
      throw new Error(`Anthropic API error: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();

    // (E) Return the recipe
    return new Response(
      JSON.stringify({ recipe: result.content[0].text }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in generate-recipe:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate recipe" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});