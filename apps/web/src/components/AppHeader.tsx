import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLocale } from "../lib/i18n";
import { hasSupabaseConfig, hcaptchaSiteKey } from "../lib/supabase";
import styles from "../styles/App.module.css";

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const {
    loading,
    user,
    isAnonymous,
    authError,
    retryGuestSession,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const [accountError, setAccountError] = useState("");
  const captchaRef = useRef<HCaptcha>(null);
  const needsCaptcha = authError?.toLowerCase().includes("captcha") ?? false;

  async function handleAccountAction() {
    setAccountError("");
    if (user && !isAnonymous) {
      await signOut();
      return;
    }
    const error = await signInWithGoogle();
    if (error) setAccountError(error);
  }

  async function handleCaptchaVerified(token: string) {
    setAccountError("");
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
      <Link className={styles.brand} to="/" aria-label={t("appName")}>
        <span className={styles.brandMark} aria-hidden="true">
          SL
        </span>
        <span>{t("appName")}</span>
      </Link>
      <div className={styles.headerControls}>
        {hasSupabaseConfig && (!user || isAnonymous) ? (
          <button
            className={styles.accountAction}
            type="button"
            disabled={loading}
            onClick={handleAccountAction}
          >
            {t("saveHistory")}
          </button>
        ) : null}
        {hasSupabaseConfig && user && !isAnonymous ? (
          <Link className={styles.accountStatus} to="/history">
            {t("historySaved")}
          </Link>
        ) : null}
        <div className={styles.languageSwitch} aria-label="Language">
          <button
            type="button"
            aria-pressed={locale === "id"}
            onClick={() => setLocale("id")}
          >
            ID
          </button>
          <button
            type="button"
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
        </div>
      </div>
      {authError || accountError ? (
        <div className={styles.authError} role="alert">
          <span>
            {needsCaptcha
              ? t("guestCaptchaPrompt")
              : authError
                ? `${t("guestSignInError")} ${authError}`
                : accountError}
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
                  onError={() => setAccountError(t("captchaLoadError"))}
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
          {accountError && needsCaptcha ? <span>{accountError}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
