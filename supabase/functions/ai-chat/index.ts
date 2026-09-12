import { json, corsHeaders, getCookie, sha256, supabaseAdmin } from "../_shared/common.ts";

const SYSTEM = `You are Minecraft Server Assistant (MSA), a practical expert for Minecraft server owners.
You specialize in Java Edition, Bedrock, Paper, Spigot, Purpur, Vanilla, Fabric, Forge, NeoForge, Geyser, Floodgate, LuckPerms, Vault, PlaceholderAPI, TAB, EconomyShopGUI and common server tooling.
Answer in the user's language when possible. The user may be a beginner and may type informally or with mistakes.
For technical problems: identify likely cause, explain how to verify it, then give step-by-step fixes, commands and config examples when useful.
Do not invent plugin options, commands, versions, or compatibility facts. If an answer depends on the exact Minecraft/server/plugin version, say so.
When logs are provided, focus on the meaningful error and do not repeat the whole log.
Keep answers practical and concise, but give enough detail to actually fix the issue.`;

async function activeSubscription(db: ReturnType<typeof supabaseAdmin>, req: Request) {
  const token = getCookie(req, "msa_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const { data } = await db.from("subscription_sessions")
    .select("expires_at, subscriptions(id,plan,status,expires_at)")
    .eq("token_hash", tokenHash).maybeSingle();
  if (!data) return null;
  const sub = Array.isArray(data.subscriptions) ? data.subscriptions[0] : data.subscriptions;
  if (!sub || sub.status !== "active" || new Date(sub.expires_at) <= new Date()) return null;
  return sub;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = supabaseAdmin();
    await db.rpc("refresh_expired_subscriptions");
    const sub = await activeSubscription(db, req);

    const body = await req.json().catch(() => ({}));
    if (body.action === "status") {
      return json({ subscription: sub ? { plan: sub.plan, status: sub.status, expires_at: sub.expires_at } : null });
    }
    if (!sub) return json({ error: "Active subscription required." }, 401);

    const message = String(body.message ?? "").trim();
    if (!message) return json({ error: "Message is required." }, 400);
    if (message.length > 12000) return json({ error: "Message is too long." }, 413);

    const context = body.context ?? {};
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

    const contents = [
      ...history.filter((m:any)=>m && (m.role==="user" || m.role==="assistant") && typeof m.content==="string")
        .map((m:any)=>({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0,12000) }] })),
      { role: "user", parts: [{ text:
        `Server context:
Minecraft: ${String(context.minecraft ?? "unknown")}
Software: ${String(context.software ?? "unknown")}
Java: ${String(context.java ?? "unknown")}
Plugins/Mods: ${String(context.plugins ?? "none supplied")}

User question:
${message}` }] }
    ];

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "AI service is not configured yet." }, 503);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.35, maxOutputTokens: 1800 }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Gemini error", result);
      return json({ error: "The AI service returned an error. Try again shortly." }, response.status >= 500 ? 502 : 429);
    }
    const text = result?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text ?? "").join("")?.trim();
    if (!text) return json({ error: "The AI returned an empty response." }, 502);

    return json({ text });
  } catch (error) {
    console.error(error);
    return json({ error: "AI request failed." }, 500);
  }
});
