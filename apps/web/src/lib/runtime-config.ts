export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const hcaptchaSiteKey =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY?.trim() || null;
export const hasSupabaseConfig = Boolean(supabaseUrl && publishableKey);
