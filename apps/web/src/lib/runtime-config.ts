export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const hcaptchaSiteKey =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY?.trim() || null;
export const siteOrigin =
  import.meta.env.VITE_SITE_ORIGIN?.trim() ||
  "https://skor-lapangan.vercel.app";
export const analyticsEnabled =
  import.meta.env.VITE_ENABLE_ANALYTICS === "true";
export const hasSupabaseConfig = Boolean(supabaseUrl && publishableKey);

export const AUTH_PROVIDER_IDS = ["google", "github", "apple"] as const;
export type AuthProviderId = (typeof AUTH_PROVIDER_IDS)[number];

const configuredProviderSource =
  import.meta.env.VITE_AUTH_PROVIDERS === undefined
    ? ["google"]
    : import.meta.env.VITE_AUTH_PROVIDERS.split(",");

const configuredAuthProviders = configuredProviderSource
  .map((provider: string) => provider.trim().toLowerCase())
  .filter((provider: string): provider is AuthProviderId =>
    AUTH_PROVIDER_IDS.includes(provider as AuthProviderId),
  );

export const authProviders: readonly AuthProviderId[] = configuredAuthProviders
  .filter(
    (provider: AuthProviderId, index: number, providers: AuthProviderId[]) =>
      providers.indexOf(provider) === index,
  )
  .slice(0, 3);

export const defaultAuthProvider: AuthProviderId | null =
  authProviders[0] ?? null;
