import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

////////////////////////////////////////////////////
// 1. Basic CORS Setup
////////////////////////////////////////////////////
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": 
    "authorization, x-client-info, apikey, content-type",
};

////////////////////////////////////////////////////
// 2. System Prompt for "Modify" Flow
////////////////////////////////////////////////////
const CLAUDE_SYSTEM_PROMPT_MODIFY = `
You are an AI that must respond with one valid JSON object only — no commentary, markdown, or explanations.
The JSON must follow the same structure as the original recipe schema, with the same validation rules.

Now your job is to modify an existing recipe. 
You'll receive two things from the user:
1) The existing recipe in JSON form (same schema).
2) Additional instructions on how to change it.

You must return a single JSON object following that same schema, but with modifications reflecting the user's instructions. 
Return only valid JSON. No extra text.
`;

////////////////////////////////////////////////////
// 3. Serve the Function
////////////////////////////////////////////////////
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // (A) Optional: Auth check
    // If you want to require a Bearer token:
    // const authHeader = req.headers.get("Authorization");
    // if (!authHeader) {
    //   return new Response(
    //     JSON.stringify({ error: "Missing authorization header" }),
    //     { status: 401, headers: corsHeaders }
    //   );
    // }

    // (B) Parse user inputs
    // expecting { priorRecipe: {...}, modifyPrompt: "some string" }
    const { priorRecipe, modifyPrompt } = await req.json();

    if (!priorRecipe) {
      throw new Error("No priorRecipe provided for modification");
    }

    // (C) Build messages for Claude
    const messages = [
      {
        role: "system",
        content: CLAUDE_SYSTEM_PROMPT_MODIFY.trim()
      },
      {
        role: "user",
        content: `
Existing recipe JSON:
${JSON.stringify(priorRecipe, null, 2)}

User's modification request:
"${modifyPrompt}"
        `.trim()
      }
    ];

    // (D) Call Anthropic’s API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229", // or whichever Claude model
        messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();

    // (E) Return updated recipe as "modifiedRecipe"
    // If your "generate" code returns { recipe: ... }, here we do:
    return new Response(
      JSON.stringify({ modifiedRecipe: result.content[0].text }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error("Error in modify-recipe:", error);
    return new Response(
      JSON.stringify({ error: "Failed to modify recipe", details: String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
