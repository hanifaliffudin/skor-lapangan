import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MatchMode, Sport } from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n";
import { saveDraft } from "../../lib/session";
import { getGoogleProviderStatus, signInWithGoogle } from "../../lib/supabase";
import styles from "../../styles/App.module.css";

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { user } = useAuth();
  const [sport, setSport] = useState<Sport>("badminton");
  const [mode, setMode] = useState<MatchMode>("casual");
  const [loginState, setLoginState] = useState<
    | "idle"
    | "checking"
    | "not_configured"
    | "provider_disabled"
    | "unreachable"
    | "error"
  >("idle");
  const loginDialog = useRef<HTMLDialogElement>(null);

  function continueToSetup() {
    saveDraft({ sport, mode });
    navigate("/setup");
  }

  async function beginGoogleLogin() {
    setLoginState("checking");
    const provider = await getGoogleProviderStatus();
    if (!provider.available) {
      setLoginState(provider.reason);
      loginDialog.current?.showModal();
      return;
    }

    const result = await signInWithGoogle();
    if (result.error) {
      setLoginState("error");
      loginDialog.current?.showModal();
    }
  }

  const loginMessage =
    loginState === "provider_disabled"
      ? t("loginProviderDisabled")
      : loginState === "not_configured"
        ? t("loginNotConfigured")
        : loginState === "unreachable"
          ? t("loginUnreachable")
          : t("loginError");

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.homeMain}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <p className={styles.eyebrow}>Badminton · Pickleball</p>
          <h1 id="hero-title">{t("tagline")}</h1>
          <p>{t("intro")}</p>
        </section>

        <section className={styles.quickStart} aria-label="Quick start">
          <fieldset className={styles.optionGroup}>
            <legend>
              <span>1</span>
              {t("chooseSport")}
            </legend>
            <div className={styles.optionGrid}>
              <ChoiceCard
                checked={sport === "badminton"}
                label={t("badminton")}
                hint={t("badmintonHint")}
                name="sport"
                onChange={() => setSport("badminton")}
              />
              <ChoiceCard
                checked={sport === "pickleball"}
                label={t("pickleball")}
                hint={t("pickleballHint")}
                name="sport"
                onChange={() => setSport("pickleball")}
              />
            </div>
          </fieldset>

          <fieldset className={styles.optionGroup}>
            <legend>
              <span>2</span>
              {t("chooseMode")}
            </legend>
            <div className={styles.optionGrid}>
              <ChoiceCard
                checked={mode === "casual"}
                label={t("casual")}
                hint={t("casualHint")}
                name="mode"
                onChange={() => setMode("casual")}
              />
              <ChoiceCard
                checked={mode === "referee"}
                label={t("referee")}
                hint={t("refereeHint")}
                name="mode"
                onChange={() => setMode("referee")}
              />
            </div>
          </fieldset>

          <button
            className={styles.primaryButton}
            type="button"
            onClick={continueToSetup}
          >
            {t("continue")} <span aria-hidden="true">→</span>
          </button>

          {user ? (
            <p className={styles.signedInNote}>{t("signedInNote")}</p>
          ) : (
            <>
              <div className={styles.divider}>
                <span>atau / or</span>
              </div>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={loginState === "checking"}
                onClick={() => void beginGoogleLogin()}
              >
                <span className={styles.googleMark} aria-hidden="true">
                  G
                </span>
                {loginState === "checking" ? t("checkingGoogle") : t("google")}
              </button>
              <p className={styles.guestNote}>{t("guestNote")}</p>
            </>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <span>{t("officialRules")}</span>
        <span>{t("officialHint")}</span>
      </footer>

      <dialog className={styles.dialog} ref={loginDialog}>
        <div className={styles.dialogBody}>
          <h2>{t("loginUnavailableTitle")}</h2>
          <p>{loginMessage}</p>
          <form method="dialog">
            <button className={styles.primaryButton} type="submit">
              {t("close")}
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}

interface ChoiceCardProps {
  checked: boolean;
  hint: string;
  label: string;
  name: string;
  onChange: () => void;
}

function ChoiceCard({ checked, hint, label, name, onChange }: ChoiceCardProps) {
  return (
    <label className={styles.choiceCard} data-selected={checked}>
      <input type="radio" checked={checked} name={name} onChange={onChange} />
      <span className={styles.choiceCopy}>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <span className={styles.radioVisual} aria-hidden="true" />
    </label>
  );
}
