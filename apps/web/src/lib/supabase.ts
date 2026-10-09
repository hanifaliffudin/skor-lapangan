import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const hcaptchaSiteKey =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY?.trim() || null;

export const hasSupabaseConfig = Boolean(supabaseUrl && publishableKey);

export const supabase = hasSupabaseConfig
  ? createClient<Database>(supabaseUrl!, publishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export type GoogleProviderStatus =
  | { available: true }
  | {
      available: false;
      reason: "not_configured" | "provider_disabled" | "unreachable";
    };

export async function getGoogleProviderStatus(): Promise<GoogleProviderStatus> {
  if (!supabaseUrl || !publishableKey) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
    });
    if (!response.ok) return { available: false, reason: "unreachable" };

    const settings = (await response.json()) as {
      external?: { google?: boolean };
    };
    return settings.external?.google
      ? { available: true }
      : { available: false, reason: "provider_disabled" };
  } catch {
    return { available: false, reason: "unreachable" };
  }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase is not configured." };

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  return { error: error?.message ?? null };
}
