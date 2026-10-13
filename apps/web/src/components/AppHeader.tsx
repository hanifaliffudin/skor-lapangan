import { lazy, Suspense, useRef, useState } from "react";
import type HCaptchaInstance from "@hcaptcha/react-hcaptcha";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { localizedPath, useLocale } from "../lib/i18n";
import { hcaptchaSiteKey } from "../lib/runtime-config";
import { isRateLimitError } from "../lib/userError";
import { Button } from "@/components/ui/button";

const HCaptchaComponent = lazy(() =>
  import("@hcaptcha/react-hcaptcha").then(({ default: component }) => ({
    default: component,
  })),
);

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    action,
    authError,
    authErrorKind,
    authNotice,
    isAnonymous,
    loading,
    retryGuestSession,
    signInWithGoogle,
    signOut,
    user,
  } = useAuth();
  const [captchaError, setCaptchaError] = useState("");
  const captchaRef = useRef<HCaptchaInstance>(null);
  const needsCaptcha = authError?.toLowerCase().includes("captcha") ?? false;
  const guestSignInRateLimited = isRateLimitError(authError);

  function changeLocale(nextLocale: "id" | "en") {
    setLocale(nextLocale);
    navigate({
      pathname: localizedPath(location.pathname, nextLocale),
      search: location.search,
      hash: location.hash,
    });
  }

  async function handleCaptchaVerified(token: string) {
    setCaptchaError("");
    try {
      await retryGuestSession(token);
    } finally {
      captchaRef.current?.resetCaptcha();
    }
  }

  async function handleSignOut() {
    const didSignOut = await signOut();
    if (didSignOut) navigate(localizedPath("/", locale), { replace: true });
  }

  const isGoogleBusy = action === "google" || action === "claiming";
  const isGuestError = authErrorKind === "guest";
  const isClaimError = authErrorKind === "claim";
  const isGoogleError = authErrorKind === "google" || authErrorKind === "claim";
  const safeAuthError =
    authError?.toLowerCase().includes("identity_already_exists") ||
    authError?.toLowerCase().includes("identity is already linked") ||
    authError?.toLowerCase().includes("manual linking is disabled")
      ? t("googleLinkFallback")
      : authError;
  const errorMessage = isGuestError
    ? needsCaptcha
      ? t("guestCaptchaPrompt")
      : `${t("guestSignInError")} ${guestSignInRateLimited ? t("rateLimited") : (safeAuthError ?? "")}`
    : authErrorKind === "delete"
      ? `${t("accountDeleteError")} ${safeAuthError ?? ""}`
      : isClaimError
        ? `${t("claimError")} ${safeAuthError ?? ""}`
        : `${isGoogleError ? t("googleSignInError") : t("accountError")} ${safeAuthError ?? ""}`;
  const showHeaderAuthError =
    Boolean(authError || captchaError) &&
    !(authErrorKind === "delete" && location.pathname.endsWith("/account"));
  const isAccountRoute =
    location.pathname.endsWith("/account") ||
    location.pathname.endsWith("/history");
  const authNoticeMessage =
    authNotice === "guestMatchesSaved"
      ? t("guestMatchesSaved")
      : authNotice === "accountDeleted"
        ? t("accountDeleted")
        : null;

  return (
    <header
      className={`relative mx-auto flex min-h-[76px] w-full max-w-[1120px] items-center justify-between gap-5 border-b border-line px-[clamp(18px,4vw,40px)] py-4 pt-[calc(16px+env(safe-area-inset-top))] max-[560px]:min-h-[62px] max-[560px]:px-[14px] max-[560px]:py-[10px] max-[560px]:pt-[calc(10px+env(safe-area-inset-top))] ${compact ? "min-h-16" : ""}`}
    >
      <Link
        className="inline-flex min-h-11 min-w-11 items-center gap-2.5 font-extrabold tracking-[-0.02em] text-ink no-underline"
        to={localizedPath("/", locale)}
        aria-label={t("appName")}
      >
        <span
          className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-ink bg-cobalt text-sm font-extrabold tracking-[0.04em] text-white"
          aria-hidden="true"
        >
          SL
        </span>
        <span className="max-[560px]:hidden">{t("appName")}</span>
      </Link>
      <div className="flex items-center gap-[10px] max-[560px]:gap-[5px]">
        {user && !isAnonymous ? (
          <details className="relative">
            <summary className="flex min-h-11 max-w-[220px] cursor-pointer list-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-extrabold text-ink outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 max-[560px]:max-w-11 max-[560px]:justify-center max-[560px]:px-0">
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full bg-cobalt text-[11px] font-extrabold text-white"
                aria-hidden="true"
              >
                {(user.email?.[0] ?? "G").toUpperCase()}
              </span>
              <span className="max-w-[148px] truncate max-[560px]:hidden">
                {user.email ?? t("account")}
              </span>
              <span className="sr-only">{t("accountMenu")}</span>
            </summary>
            <div className="absolute top-[calc(100%+8px)] right-0 z-30 grid w-[min(280px,calc(100vw-28px))] gap-1 rounded-lg border border-line-strong bg-surface p-2 shadow-lg">
              <p className="m-0 px-3 py-2 text-xs leading-5 text-muted">
                {user.email ?? t("account")}
              </p>
              <Link
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                to={localizedPath("/history", locale)}
              >
                {t("matchHistory")}
              </Link>
              <Link
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                to={localizedPath("/account", locale)}
              >
                {t("accountSettings")}
              </Link>
              <Button
                variant="ghost"
                type="button"
                className="min-h-11 justify-start px-3 text-sm font-semibold"
                disabled={loading || isGoogleBusy}
                onClick={() => void handleSignOut()}
              >
                {action === "signing-out" ? t("signingOut") : t("signOut")}
              </Button>
            </div>
          </details>
        ) : isAccountRoute ? null : (
          <Button
            variant="secondary"
            type="button"
            className="min-h-11 px-3 text-[13px] font-extrabold max-[560px]:px-2 max-[560px]:text-[11px]"
            disabled={loading || isGoogleBusy}
            onClick={() => void signInWithGoogle()}
          >
            {isGoogleBusy ? t("working") : t("signInWithGoogle")}
          </Button>
        )}
        <div
          className="flex rounded-lg border border-line-strong bg-surface p-[3px]"
          aria-label={t("language")}
          role="group"
        >
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-pressed={locale === "id"}
            className="min-h-11 min-w-11 px-2.5 text-[13px] font-extrabold aria-pressed:bg-ink aria-pressed:text-white"
            onClick={() => changeLocale("id")}
          >
            ID
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-pressed={locale === "en"}
            className="min-h-11 min-w-11 px-2.5 text-[13px] font-extrabold aria-pressed:bg-ink aria-pressed:text-white"
            onClick={() => changeLocale("en")}
          >
            EN
          </Button>
        </div>
      </div>
      {action === "claiming" || authNoticeMessage ? (
        <div
          className="absolute top-full right-[clamp(18px,4vw,40px)] z-20 max-w-[min(440px,calc(100vw-36px))] rounded-md border border-line-strong bg-surface p-[10px_12px] text-[13px] text-ink shadow-sm"
          role="status"
          aria-live="polite"
        >
          {action === "claiming" ? t("savingGuestMatches") : authNoticeMessage}
        </div>
      ) : null}
      {showHeaderAuthError ? (
        <div
          className="absolute top-full right-[clamp(18px,4vw,40px)] z-20 grid max-w-[min(440px,calc(100vw-36px))] gap-2 rounded-md border border-[#b83c38] bg-surface p-[10px_12px] text-[13px] text-[#8a211f] [overflow-wrap:anywhere]"
          role="alert"
        >
          {authError ? <span>{errorMessage}</span> : null}
          {needsCaptcha ? (
            hcaptchaSiteKey ? (
              <div className="w-fit max-w-full">
                <Suspense fallback={null}>
                  <HCaptchaComponent
                    ref={captchaRef}
                    sitekey={hcaptchaSiteKey}
                    size="compact"
                    languageOverride={locale}
                    onVerify={(token) => void handleCaptchaVerified(token)}
                    onError={() => setCaptchaError(t("captchaLoadError"))}
                  />
                </Suspense>
              </div>
            ) : (
              <span>{t("guestCaptchaMissing")}</span>
            )
          ) : isGuestError && authError ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 justify-self-start px-3 text-[13px] font-extrabold disabled:cursor-wait disabled:opacity-[0.65] max-[560px]:max-w-[138px] max-[560px]:px-2 max-[560px]:text-[11px]"
              type="button"
              disabled={loading}
              onClick={() => void retryGuestSession()}
            >
              {loading ? t("working") : t("retryGuestSync")}
            </Button>
          ) : isGoogleError && authError && !isClaimError ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 justify-self-start px-3 text-[13px] font-extrabold"
              type="button"
              disabled={loading || isGoogleBusy}
              onClick={() => void signInWithGoogle()}
            >
              {isGoogleBusy ? t("working") : t("signInWithGoogle")}
            </Button>
          ) : null}
          {captchaError ? <span>{captchaError}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
