const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const instructions = `You are the warm, concise guest concierge for Stay at UniLeisure in Zimbabwe.
Only answer using these facts:
- CLANDSTEIN Houseboat is on Lake Kariba. It has 2 cabins and sleeps up to 6 guests. A cook and tender boat are included; it is self-catering. Minimum stay is 3 nights. Dry rate is US$350 per night off-peak and US$550 per night peak. It suits family holidays, fishing getaways, weekend escapes and corporate retreats.
- Coates Cottage is in Connemara, Nyanga. It has 4 bedrooms, 3 bathrooms and sleeps up to 11 guests sharing. It is self-catering and has a fully equipped kitchen, open-plan lounge and dining area, outdoor braai, wood-fired hot tub, garden, and is close to Connemara Dam and scenic trails. World's View is 1 km away.
- Booking enquiries are not online payments. Guests should confirm availability and payment arrangements directly with the team on WhatsApp at +263 77 213 6751.
Be friendly and useful. Do not invent rates for Coates Cottage, exact directions, availability, payment instructions, or house rules. If asked for information not listed or to confirm availability, say the team can help on WhatsApp and provide the number. Keep answers under 100 words.`;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured.");
    return Response.json({ error: "Concierge is not configured." }, { status: 503, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 8) {
      return Response.json({ error: "Please send a valid chat message." }, { status: 400, headers: corsHeaders });
    }
    const safeMessages = messages.map((message: { role?: unknown; content?: unknown }) => {
      if ((message.role !== "user" && message.role !== "assistant")
        || typeof message.content !== "string" || message.content.length < 1 || message.content.length > 500) {
        throw new Error("Invalid chat message.");
      }
      return { role: message.role, content: message.content };
    });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions,
        input: safeMessages,
        max_output_tokens: 220,
      }),
    });
    if (!response.ok) {
      console.error("Concierge provider returned status", response.status);
      return Response.json({ error: "Concierge is temporarily unavailable." }, { status: 502, headers: corsHeaders });
    }
    const result = await response.json();
    const answer = result.output_text;
    if (typeof answer !== "string" || !answer.trim()) {
      console.error("Concierge provider returned no text.");
      return Response.json({ error: "Concierge returned an empty answer." }, { status: 502, headers: corsHeaders });
    }
    return Response.json({ answer: answer.trim() }, { headers: corsHeaders });
  } catch (error) {
    console.error("Concierge request failed:", error);
    return Response.json({ error: "Unable to answer that just now." }, { status: 400, headers: corsHeaders });
  }
});
