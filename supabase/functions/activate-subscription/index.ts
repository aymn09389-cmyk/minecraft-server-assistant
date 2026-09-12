import { json, corsHeaders, sessionCookie, sha256, supabaseAdmin } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { code } = await req.json();
    const normalized = String(code ?? "").trim().toUpperCase();
    if (!/^MSA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
      return json({ error: "Invalid subscription code format." }, 400);
    }

    const db = supabaseAdmin();
    await db.rpc("refresh_expired_subscriptions");

    const codeHash = await sha256(normalized);
    const { data: sub, error: findError } = await db.from("subscriptions")
      .select("id,code,plan,duration_days,status,expires_at")
      .eq("code_hash", codeHash).maybeSingle();

    if (findError) throw findError;
    if (!sub) return json({ error: "This subscription code is not valid." }, 404);
    if (sub.status === "revoked") return json({ error: "This subscription code has been revoked." }, 403);
    if (sub.status === "active") return json({ error: "This code has already been activated." }, 409);
    if (sub.status === "expired") return json({ error: "This subscription code has expired." }, 410);

    const now = new Date();
    const expires = new Date(now.getTime() + sub.duration_days * 86400000);
    const { error: updateError } = await db.from("subscriptions").update({
      status: "active", activated_at: now.toISOString(), expires_at: expires.toISOString()
    }).eq("id", sub.id).eq("status", "unused");
    if (updateError) throw updateError;

    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const tokenHash = await sha256(token);
    const { error: sessionError } = await db.from("subscription_sessions").insert({
      token_hash: tokenHash, subscription_id: sub.id, expires_at: expires.toISOString()
    });
    if (sessionError) throw sessionError;

    return json({
      ok: true,
      plan: sub.plan,
      expires_at: expires.toISOString()
    }, 200, { "Set-Cookie": sessionCookie(token, Math.floor((expires.getTime()-now.getTime())/1000)) });
  } catch (error) {
    console.error(error);
    return json({ error: "Activation failed. Please try again." }, 500);
  }
});
