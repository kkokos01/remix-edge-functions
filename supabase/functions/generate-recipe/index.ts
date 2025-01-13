import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Enable CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLAUDE_SYSTEM_PROMPT = `
You are an AI that must respond with one valid JSON object only—no commentary...
`.trim();

serve(async (req) => {
  // Handle preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const { prompt } = await req.json();
      if (!prompt) {
        throw new Error("No prompt provided");
      }

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment");
      }

      // Build messages for Claude
      const messages = [
        { role: "system", content: CLAUDE_SYSTEM_PROMPT },
        { role: "user", content: `Generate a recipe in valid JSON based on this request: "${prompt}"` }
      ];

      // Call Anthropic
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
      let recipeText = result?.content?.[0]?.text || "{}";

      // Just in case, trim whitespace
      recipeText = recipeText.trim();

      // If the text is not valid JSON, you might parse/fix it. For now, we assume it's valid.
      // Return the raw JSON with correct headers
      return new Response(recipeText, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    } catch (error) {
      console.error("Error generating recipe:", error);
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

  // If not POST
  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
