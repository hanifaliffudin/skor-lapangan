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
  const { loading, authError, retryGuestSession } = useAuth();
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
      {authError || captchaError ? (
        <div
          className="absolute top-full right-[clamp(18px,4vw,40px)] z-20 grid max-w-[min(440px,calc(100vw-36px))] gap-2 rounded-md border border-[#b83c38] bg-surface p-[10px_12px] text-[13px] text-[#8a211f] [overflow-wrap:anywhere]"
          role="alert"
        >
          {authError ? (
            <span>
              {needsCaptcha
                ? t("guestCaptchaPrompt")
                : `${t("guestSignInError")} ${guestSignInRateLimited ? t("rateLimited") : authError}`}
            </span>
          ) : null}
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
          ) : authError ? (
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
          ) : null}
          {captchaError ? <span>{captchaError}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
