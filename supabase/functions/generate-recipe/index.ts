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
 * (We can keep your strict JSON schema here, or adapt as needed.)
 */
const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must respond with one valid JSON object only — no commentary or extraneous text.
It must follow this schema:

{
  "title": "string",
  "description": "string",
  "ingredients": [...],
  "instructions": [...]
}

No extra commentary—only valid JSON. 
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

      // C) Build messages
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

      // D) Call Anthropic with Claude 3.5 Sonnet
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022", // or claude-3-5-sonnet-latest
          messages,
          max_tokens: 1024,
          temperature: 0.7
        })
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
