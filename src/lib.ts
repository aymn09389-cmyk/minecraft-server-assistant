import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export async function apiFetch(functionName: string, body: unknown, init: RequestInit = {}) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    ...init,
    method: init.method ?? "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      ...(init.headers ?? {})
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export type Subscription = {
  plan: string;
  status: "active" | "expired" | "revoked";
  expires_at: string;
};

export async function getSubscription(): Promise<Subscription | null> {
  try {
    return (await apiFetch("ai-chat", { action: "status" })).subscription ?? null;
  } catch {
    return null;
  }
}
