// Edge Function for Recipe Generation v1.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle preflight requests for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
    // Call Claude API with structured prompt
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        messages: [{
          role: "user",
          content: `Create a detailed recipe based on this request: ${prompt}. 
                    Format the response with:
                    - A brief description
                    - List of ingredients with quantities
                    - Step by step cooking instructions
                    - Approximate cooking time
                    - Any helpful tips`
        }],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    const result = await response.json();
    
    return new Response(
      JSON.stringify({ recipe: result.content[0].text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate recipe" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
