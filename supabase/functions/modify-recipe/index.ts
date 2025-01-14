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
 * For modifies, we tell Claude to preserve the same JSON schema but incorporate the user's 'modifyPrompt'.
 */
const CLAUDE_SYSTEM_PROMPT_MODIFY = `
You are an AI that must respond with one valid JSON object only—no extra text.
It must keep the original recipe JSON structure, but update fields according to the user's modifications.
No extra commentary or text beyond the single JSON object.
`.trim();

serve(async (req) => {
  // A) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // B) If POST, do the logic
  if (req.method === "POST") {
    try {
      const { priorRecipe, modifyPrompt } = await req.json();
      if (!priorRecipe) {
        throw new Error("No 'priorRecipe' field provided.");
      }
      if (!modifyPrompt) {
        throw new Error("No 'modifyPrompt' field provided.");
      }

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        throw new Error("Missing ANTHROPIC_API_KEY in environment secrets.");
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

User modifications: "${modifyPrompt}"
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

      const result = await response.json();
      const rawText = result?.content?.[0]?.text || "{}";

      return new Response(rawText, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (error) {
      console.error("Error modifying recipe:", error);
      const errMsg = {
        error: "Failed to modify recipe",
        details: String(error)
      };
      return new Response(JSON.stringify(errMsg), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }
  }

  // If not POST or OPTIONS
  return new Response("Method not allowed", {
    headers: corsHeaders,
    status: 405
  });
});
