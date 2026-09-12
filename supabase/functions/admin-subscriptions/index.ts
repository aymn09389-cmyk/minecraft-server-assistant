import { json, corsHeaders, supabaseAdmin, sha256 } from "../_shared/common.ts";

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `MSA-${out.slice(0,4)}-${out.slice(4,8)}`;
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const db = supabaseAdmin();
  const { data: userData } = await db.auth.getUser(token);
  const user = userData.user;
  if (!user) return null;
  const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return admin ? user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireAdmin(req);
    if (!user) return json({ error: "Admin authorization required." }, 401);

    const body = await req.json();
    const db = supabaseAdmin();

    if (body.action === "list") {
      await db.rpc("refresh_expired_subscriptions");
      const { data, error } = await db.from("subscriptions")
        .select("id,code,plan,duration_days,status,created_at,activated_at,expires_at")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return json({ subscriptions: data ?? [] });
    }

    if (body.action === "create") {
      const duration = Number(body.duration_days);
      const plan = String(body.plan ?? "").trim();
      if (!plan || !Number.isInteger(duration) || duration < 1 || duration > 3650) return json({ error: "Invalid plan or duration." },400);

      for (let i=0;i<5;i++) {
        const code = randomCode();
        const hash = await sha256(code);
        const { error } = await db.from("subscriptions").insert({
          code, code_hash: hash, plan, duration_days: duration, status: "unused"
        });
        if (!error) return json({ ok:true, code });
        if (!String(error.message).toLowerCase().includes("duplicate")) throw error;
      }
      return json({ error: "Could not generate a unique code." },500);
    }

    if (body.action === "revoke") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Subscription id required." },400);
      const { error } = await db.from("subscriptions").update({ status:"revoked" }).eq("id",id);
      if (error) throw error;
      return json({ ok:true });
    }

    return json({ error:"Unknown action." },400);
  } catch(error) {
    console.error(error);
    return json({ error:"Admin request failed." },500);
  }
});
