import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  AuthContext,
  type AuthAction,
  type AuthContextValue,
  type AuthErrorKind,
  type AuthProviderProps,
} from "./auth-context";
import {
  getStoredMatchInfo,
  listStoredMatches,
  removeAllStoredMatches,
  saveMatch,
} from "./session";

export { useAuth } from "./auth-context";

type GuestSignInResult = { session: Session | null; error: string | null };

let guestSignIn: Promise<GuestSignInResult> | null = null;
const guestTransferTokenKey = "skor-lapangan:guest-transfer-token";
export const authReturnPathKey = "skor-lapangan:auth-return-path";

function hasGuestGoogleFallbackCallback(): boolean {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return [query, hash].some(
    (params) =>
      params.get("error_code") === "identity_already_exists" ||
      params.get("error_code") === "manual_linking_disabled",
  );
}

function clearAuthCallbackUrl(): void {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function rememberAuthReturnPath(): void {
  const path = `${window.location.pathname}${window.location.search}`;
  if (path === "/" || path === "/id/" || path === "/id") {
    window.sessionStorage.removeItem(authReturnPathKey);
    return;
  }
  window.sessionStorage.setItem(authReturnPathKey, path);
}

function oauthOptions(): { redirectTo: string } {
  // Keep the OAuth callback on the configured origin. The app restores the
  // page that started login from sessionStorage after Supabase returns.
  return { redirectTo: window.location.origin };
}

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
  const [action, setAction] = useState<AuthAction>("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorKind, setAuthErrorKind] = useState<AuthErrorKind>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const claimAttempted = useRef<string | null>(null);
  const googleFlowActive = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;
    let authEventObserved = false;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === "INITIAL_SESSION" && hasGuestGoogleFallbackCallback()) {
        authEventObserved = true;
        googleFlowActive.current = true;
        if (nextSession?.user.is_anonymous && nextSession.access_token) {
          window.sessionStorage.setItem(
            guestTransferTokenKey,
            nextSession.access_token,
          );
        }
        setSession(nextSession);
        setAuthError(null);
        setAuthErrorKind(null);
        setAuthNotice(null);
        setLoading(true);
        setAction("google");
        clearAuthCallbackUrl();

        queueMicrotask(() => {
          void (async () => {
            await client.auth.signOut({ scope: "local" });
            claimAttempted.current = null;
            setSession(null);
            const { error } = await client.auth.signInWithOAuth({
              provider: "google",
              options: oauthOptions(),
            });
            if (error) {
              setAuthError(error.message);
              setAuthErrorKind("google");
            }
            setAction("idle");
            setLoading(false);
          })();
        });
        return;
      }

      if (_event === "INITIAL_SESSION" && !nextSession) return;
      authEventObserved = true;
      if (
        _event !== "INITIAL_SESSION" &&
        nextSession &&
        !nextSession.user.is_anonymous
      ) {
        googleFlowActive.current = false;
      }
      setSession(nextSession);
      setAuthError(null);
      setAuthErrorKind(null);
      setAuthNotice(null);
      setLoading(false);
    });

    const initializeSession = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (!active || authEventObserved) return;

        if (data.session) {
          setSession(data.session);
          setAuthError(null);
          setAuthErrorKind(null);
          setAuthNotice(null);
          setLoading(false);
          return;
        }

        const result = await signInAnonymouslyOnce();
        if (!active || authEventObserved) return;
        setSession(result.session);
        setAuthError(result.error ?? error?.message ?? null);
        setAuthErrorKind(result.error || error ? "guest" : null);
        setLoading(false);
      } catch (error: unknown) {
        if (!active || authEventObserved) return;
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not load the guest session.",
        );
        setAuthErrorKind("guest");
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
    if (!supabase || action !== "google") return;

    const resetInterruptedGoogleFlow = () => {
      if (!googleFlowActive.current || hasGuestGoogleFallbackCallback()) return;
      googleFlowActive.current = false;
      setAction("idle");
      setLoading(false);
    };

    window.addEventListener("pageshow", resetInterruptedGoogleFlow);
    window.addEventListener("popstate", resetInterruptedGoogleFlow);

    return () => {
      window.removeEventListener("pageshow", resetInterruptedGoogleFlow);
      window.removeEventListener("popstate", resetInterruptedGoogleFlow);
    };
  }, [action]);

  useEffect(() => {
    if (!supabase || !session || session.user.is_anonymous) return;
    if (claimAttempted.current === session.user.id) return;
    claimAttempted.current = session.user.id;

    let active = true;
    setAction("claiming");
    void (async () => {
      for (const match of listStoredMatches()) {
        const storedMatchInfo = getStoredMatchInfo(match.definition.id);
        saveMatch(match, {
          ownerId:
            storedMatchInfo?.persistent && storedMatchInfo.ownerId
              ? storedMatchInfo.ownerId
              : session.user.id,
          persistent: true,
        });
      }

      const guestAccessToken = window.sessionStorage.getItem(
        guestTransferTokenKey,
      );
      let transferredCount = 0;

      if (guestAccessToken) {
        const { data, error } = await supabase.functions.invoke<{
          transferred: number;
        }>("transfer-guest-matches", {
          body: { guestAccessToken },
        });
        if (error) {
          if (active) {
            setAuthError(error.message);
            setAuthErrorKind("claim");
          }
        } else {
          window.sessionStorage.removeItem(guestTransferTokenKey);
          transferredCount = data?.transferred ?? 0;
        }
      }

      const { data, error } = await supabase.rpc("claim_guest_matches");
      if (!active) return;
      if (error) {
        setAuthError(error.message);
        setAuthErrorKind("claim");
      } else if (transferredCount + (data ?? 0) > 0) {
        setAuthNotice("guestMatchesSaved");
      }
      setAction("idle");
    })();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!authNotice) return;
    const timeoutId = window.setTimeout(() => setAuthNotice(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [authNotice]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      action,
      session,
      user: session?.user ?? null,
      isAnonymous: Boolean(session?.user.is_anonymous),
      authError,
      authErrorKind,
      authNotice,
      retryGuestSession: async (captchaToken) => {
        if (!supabase) {
          setAuthErrorKind("guest");
          setAuthError("Supabase is not configured.");
          return;
        }
        setLoading(true);
        setAction("idle");
        setAuthError(null);
        setAuthErrorKind(null);
        setAuthNotice(null);
        const result = await signInAnonymouslyOnce(captchaToken);
        setSession(result.session);
        setAuthError(result.error);
        setAuthErrorKind(result.error ? "guest" : null);
        setLoading(false);
      },
      signInWithGoogle: async () => {
        if (!supabase) {
          setAuthErrorKind("google");
          setAuthError("Supabase is not configured.");
          return "Supabase is not configured.";
        }
        googleFlowActive.current = true;
        setAction("google");
        setAuthError(null);
        setAuthErrorKind(null);
        setAuthNotice(null);
        rememberAuthReturnPath();
        const options = oauthOptions();
        const wasAnonymous = Boolean(session?.user.is_anonymous);
        if (wasAnonymous && session?.access_token) {
          // A guest cannot be linked when the chosen Google identity already
          // belongs to an account. Start one OAuth flow and transfer the guest
          // matches after the account session is restored.
          window.sessionStorage.setItem(
            guestTransferTokenKey,
            session.access_token,
          );
        }

        const result = await supabase.auth.signInWithOAuth({
          provider: "google",
          options,
        });

        const message = result.error?.message ?? null;
        if (message) {
          googleFlowActive.current = false;
          setAction("idle");
          setAuthError(message);
          setAuthErrorKind("google");
        }
        return message;
      },
      signOut: async () => {
        if (!supabase) return false;
        setLoading(true);
        setAction("signing-out");
        setAuthError(null);
        setAuthErrorKind(null);
        setAuthNotice(null);
        const { error } = await supabase.auth.signOut();
        if (error) {
          setAuthError(error.message);
          setAuthErrorKind("google");
          setAction("idle");
          setLoading(false);
          return false;
        }
        claimAttempted.current = null;
        const result = await signInAnonymouslyOnce();
        setSession(result.session);
        setAuthError(result.error);
        setAuthErrorKind(result.error ? "guest" : null);
        setAction("idle");
        setLoading(false);
        return true;
      },
      deleteAccount: async () => {
        if (!supabase) {
          setAuthErrorKind("delete");
          setAuthError("Supabase is not configured.");
          return "Supabase is not configured.";
        }
        if (!session?.user || session.user.is_anonymous) {
          const message = "A Google-linked account is required.";
          setAuthErrorKind("delete");
          setAuthError(message);
          return message;
        }

        setLoading(true);
        setAction("deleting");
        setAuthError(null);
        setAuthErrorKind(null);
        setAuthNotice(null);

        const { data, error } = await supabase.functions.invoke<{
          deleted: boolean;
        }>("delete-account", { body: {} });
        if (error || !data?.deleted) {
          const message = error?.message ?? "Could not delete the account.";
          setAuthError(message);
          setAuthErrorKind("delete");
          setAction("idle");
          setLoading(false);
          return message;
        }

        removeAllStoredMatches();
        await supabase.auth.signOut({ scope: "local" });
        claimAttempted.current = null;
        const result = await signInAnonymouslyOnce();
        setSession(result.session);
        setAuthError(result.error);
        setAuthErrorKind(result.error ? "guest" : null);
        setAuthNotice(result.error ? null : "accountDeleted");
        setAction("idle");
        setLoading(false);
        return result.error;
      },
    }),
    [action, authError, authErrorKind, authNotice, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
