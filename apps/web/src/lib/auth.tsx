import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  AuthContext,
  type AuthContextValue,
  type AuthProviderProps,
} from "./auth-context";

export { useAuth } from "./auth-context";

type GuestSignInResult = { session: Session | null; error: string | null };

let guestSignIn: Promise<GuestSignInResult> | null = null;

function signInAnonymouslyOnce(
  captchaToken?: string,
): Promise<GuestSignInResult> {
  if (!supabase) {
    return Promise.resolve({
      session: null,
      error: "Supabase is not configured.",
    });
  }

  if (!guestSignIn) {
    const attempt = (
      captchaToken
        ? supabase.auth.signInAnonymously({ options: { captchaToken } })
        : supabase.auth.signInAnonymously()
    )
      .then(({ data, error }) => ({
        session: data.session,
        error:
          error?.message ??
          (data.session ? null : "No guest session was returned."),
      }))
      .catch((error: unknown) => ({
        session: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not start a guest session.",
      }));

    guestSignIn = attempt;
    void attempt.then(() => {
      if (guestSignIn === attempt) guestSignIn = null;
    });
  }

  return guestSignIn;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(null);
  const claimAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;
    let authEventObserved = false;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === "INITIAL_SESSION" && !nextSession) return;
      authEventObserved = true;
      setSession(nextSession);
      setAuthError(null);
      setLoading(false);
    });

    const initializeSession = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (!active || authEventObserved) return;

        if (data.session) {
          setSession(data.session);
          setAuthError(null);
          setLoading(false);
          return;
        }

        const result = await signInAnonymouslyOnce();
        if (!active || authEventObserved) return;
        setSession(result.session);
        setAuthError(result.error ?? error?.message ?? null);
        setLoading(false);
      } catch (error: unknown) {
        if (!active || authEventObserved) return;
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not load the guest session.",
        );
        setLoading(false);
      }
    };

    void initializeSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session || session.user.is_anonymous) return;
    if (claimAttempted.current === session.user.id) return;
    claimAttempted.current = session.user.id;
    void supabase.rpc("claim_guest_matches");
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      isAnonymous: Boolean(session?.user.is_anonymous),
      authError,
      retryGuestSession: async (captchaToken) => {
        if (!supabase) {
          setAuthError("Supabase is not configured.");
          return;
        }
        setLoading(true);
        setAuthError(null);
        const result = await signInAnonymouslyOnce(captchaToken);
        setSession(result.session);
        setAuthError(result.error);
        setLoading(false);
      },
      signInWithGoogle: async () => {
        if (!supabase) return "Supabase is not configured.";
        const options = { redirectTo: window.location.origin };
        const result = session?.user.is_anonymous
          ? await supabase.auth.linkIdentity({ provider: "google", options })
          : await supabase.auth.signInWithOAuth({
              provider: "google",
              options,
            });
        return result.error?.message ?? null;
      },
      signOut: async () => {
        if (!supabase) return;
        setLoading(true);
        const { error } = await supabase.auth.signOut();
        if (error) {
          setAuthError(error.message);
          setLoading(false);
          return;
        }
        const result = await signInAnonymouslyOnce();
        setSession(result.session);
        setAuthError(result.error);
        setLoading(false);
      },
    }),
    [authError, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
