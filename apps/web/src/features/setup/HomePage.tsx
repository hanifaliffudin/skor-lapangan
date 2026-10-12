import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deriveJournal,
  type MatchFormat,
  type MatchJournal,
  type Sport,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { PwaInstallControl } from "../../components/PwaInstallControl";
import { PwaUpdateNotice } from "../../components/PwaUpdateNotice";
import { localizedPath, useLocale } from "../../lib/i18n";
import { listGuestMatches, saveDraft } from "../../lib/session";
import styles from "../../styles/App.module.css";

export function HomePage() {
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const [sport, setSport] = useState<Sport>("badminton");
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [savedMatches] = useState<MatchJournal[]>(() => listGuestMatches());
  const activeMatches = savedMatches.filter(
    (journal) => deriveJournal(journal).state.status === "active",
  );

  useEffect(() => {
    const canonicalUrl =
      locale === "id"
        ? "https://skor-lapangan.vercel.app/id/"
        : "https://skor-lapangan.vercel.app/";
    document.title = t("seoTitle");
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", t("seoDescription"));
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute("href", canonicalUrl);
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.setAttribute("content", t("seoTitle"));
    document
      .querySelector<HTMLMetaElement>('meta[property="og:description"]')
      ?.setAttribute("content", t("seoDescription"));
    document
      .querySelector<HTMLMetaElement>('meta[property="og:url"]')
      ?.setAttribute("content", canonicalUrl);
    document
      .querySelector<HTMLMetaElement>('meta[name="twitter:title"]')
      ?.setAttribute("content", t("seoTitle"));
    document
      .querySelector<HTMLMetaElement>('meta[name="twitter:description"]')
      ?.setAttribute("content", t("seoDescription"));
  }, [locale, t]);

  function continueToSetup() {
    saveDraft({ sport, format, mode: "casual" });
    navigate(localizedPath("/setup", locale));
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.homeMain}>
        <PwaUpdateNotice />
        <section className={styles.hero} aria-labelledby="hero-title">
          <p className={styles.eyebrow}>
            Badminton · Pickleball · Tennis · Padel
          </p>
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
                  onClick={() =>
                    navigate(
                      localizedPath(`/match/${journal.definition.id}`, locale),
                    )
                  }
                >
                  <span>
                    {t(journal.definition.sport)} ·{" "}
                    {t(journal.definition.format ?? "doubles")}
                  </span>
                  <strong>{t("resumeMatch")}</strong>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.quickStart} aria-label="Quick start">
          <fieldset className={styles.optionGroup}>
            <legend>{t("chooseSport")}</legend>
            <div className={styles.optionGrid}>
              <ChoiceCard
                checked={sport === "badminton"}
                label={t("badminton")}
                hint={t("badmintonHint")}
                name="sport"
                onChange={() => {
                  setSport("badminton");
                  if (format === "mixed_doubles") setFormat("doubles");
                }}
              />
              <ChoiceCard
                checked={sport === "pickleball"}
                label={t("pickleball")}
                hint={t("pickleballHint")}
                name="sport"
                onChange={() => {
                  setSport("pickleball");
                  if (format === "mixed_doubles") setFormat("doubles");
                }}
              />
              <ChoiceCard
                checked={sport === "tennis"}
                label={t("tennis")}
                hint={t("tennisHint")}
                name="sport"
                onChange={() => setSport("tennis")}
              />
              <ChoiceCard
                checked={sport === "padel"}
                label={t("padel")}
                hint={t("padelHint")}
                name="sport"
                onChange={() => setSport("padel")}
              />
            </div>
          </fieldset>

          <fieldset className={styles.optionGroup}>
            <legend>{t("chooseFormat")}</legend>
            <div className={styles.optionGrid}>
              <ChoiceCard
                checked={format === "singles"}
                label={t(sport === "padel" ? "padelSingles" : "singles")}
                hint={t(sport === "padel" ? "padelSinglesHint" : "singlesHint")}
                name="format"
                onChange={() => setFormat("singles")}
              />
              <ChoiceCard
                checked={format === "doubles"}
                label={t("doubles")}
                hint={t("doublesHint")}
                name="format"
                onChange={() => setFormat("doubles")}
              />
              {sport === "tennis" || sport === "padel" ? (
                <ChoiceCard
                  checked={format === "mixed_doubles"}
                  label={t("mixedDoubles")}
                  hint={t("mixedDoublesHint")}
                  name="format"
                  onChange={() => setFormat("mixed_doubles")}
                />
              ) : null}
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
          <PwaInstallControl />
        </section>
      </main>

      <footer className={styles.footer}>
        <span>{t("officialRules")}</span>
        <span>{t("officialHint")}</span>
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
