import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { localizedPath, useLocale } from "../lib/i18n";
import { hcaptchaSiteKey } from "../lib/supabase";
import { isRateLimitError } from "../lib/userError";
import styles from "../styles/App.module.css";

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, authError, retryGuestSession } = useAuth();
  const [captchaError, setCaptchaError] = useState("");
  const captchaRef = useRef<HCaptcha>(null);
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
      className={`${styles.header} ${compact ? styles.headerCompact : ""}`}
    >
      <Link
        className={styles.brand}
        to={localizedPath("/", locale)}
        aria-label={t("appName")}
      >
        <span className={styles.brandMark} aria-hidden="true">
          SL
        </span>
        <span>{t("appName")}</span>
      </Link>
      <div className={styles.headerControls}>
        <div className={styles.languageSwitch} aria-label="Language">
          <button
            type="button"
            aria-pressed={locale === "id"}
            onClick={() => changeLocale("id")}
          >
            ID
          </button>
          <button
            type="button"
            aria-pressed={locale === "en"}
            onClick={() => changeLocale("en")}
          >
            EN
          </button>
        </div>
      </div>
      {authError || captchaError ? (
        <div className={styles.authError} role="alert">
          <span>
            {authError
              ? needsCaptcha
                ? t("guestCaptchaPrompt")
                : `${t("guestSignInError")} ${guestSignInRateLimited ? t("rateLimited") : authError}`
              : captchaError}
          </span>
          {needsCaptcha ? (
            hcaptchaSiteKey ? (
              <div className={styles.authCaptcha}>
                <HCaptcha
                  ref={captchaRef}
                  sitekey={hcaptchaSiteKey}
                  size="compact"
                  languageOverride={locale}
                  onVerify={(token) => void handleCaptchaVerified(token)}
                  onError={() => setCaptchaError(t("captchaLoadError"))}
                />
              </div>
            ) : (
              <span>{t("guestCaptchaMissing")}</span>
            )
          ) : authError ? (
            <button
              className={styles.accountAction}
              type="button"
              disabled={loading}
              onClick={() => void retryGuestSession()}
            >
              {loading ? t("working") : t("retryGuestSync")}
            </button>
          ) : null}
          {captchaError ? <span>{captchaError}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
