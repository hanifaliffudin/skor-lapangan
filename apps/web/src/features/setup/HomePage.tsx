import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deriveJournal,
  type MatchJournal,
  type MatchMode,
  type Sport,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useLocale } from "../../lib/i18n";
import { listGuestMatches, saveDraft } from "../../lib/session";
import { hasSupabaseConfig } from "../../lib/supabase";
import styles from "../../styles/App.module.css";

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [sport, setSport] = useState<Sport>("badminton");
  const [mode, setMode] = useState<MatchMode>("casual");
  const [savedMatches] = useState<MatchJournal[]>(() => listGuestMatches());
  const activeMatches = savedMatches.filter(
    (journal) => deriveJournal(journal).state.status === "active",
  );

  function continueToSetup() {
    saveDraft({ sport, mode });
    navigate("/setup");
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.homeMain}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <p className={styles.eyebrow}>Badminton · Pickleball</p>
          <h1 id="hero-title">{t("tagline")}</h1>
          <p>{t("intro")}</p>
        </section>

        {activeMatches.length > 0 ? (
          <section
            className={styles.resumeSection}
            aria-labelledby="resume-title"
          >
            <div>
              <h2 id="resume-title">{t("resumeTitle")}</h2>
              <p>{t("resumeBody")}</p>
            </div>
            <div className={styles.resumeList}>
              {activeMatches.map((journal) => (
                <button
                  className={styles.resumeMatch}
                  type="button"
                  key={journal.definition.id}
                  onClick={() => navigate(`/match/${journal.definition.id}`)}
                >
                  <span>{t(journal.definition.sport)}</span>
                  <strong>{t("resumeMatch")}</strong>
                </button>
              ))}
            </div>
          </section>
        ) : null}

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
          <p className={styles.guestNote}>{t("guestNote")}</p>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>{t("officialRules")}</span>
        <span>{t("officialHint")}</span>
        {hasSupabaseConfig ? (
          <Link className={styles.communityFooterLink} to="/rules">
            {t("communityLibraryTitle")}
          </Link>
        ) : null}
      </footer>
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
