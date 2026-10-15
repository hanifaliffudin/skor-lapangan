import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deriveJournal,
  padelScoreLabel,
  tennisScoreLabel,
  type MatchFormat,
  type MatchJournal,
  type MatchState,
  type Sport,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { PwaInstallControl } from "../../components/PwaInstallControl";
import { PwaUpdateNotice } from "../../components/PwaUpdateNotice";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { listGuestMatches, removeMatch, saveDraft } from "../../lib/session";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Trash2 } from "lucide-react";
import styles from "../../styles/App.module.css";

function pointLabel(state: MatchState, team: TeamId, locale: "en" | "id") {
  if (state.tennis) return tennisScoreLabel(state, team, locale);
  if (state.padel) return padelScoreLabel(state, team, locale);
  return String(state.points[team]);
}

export function HomePage() {
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { isAnonymous, user } = useAuth();
  const isAccount = Boolean(user && !isAnonymous);
  const [sport, setSport] = useState<Sport>("badminton");
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [hasUserEngaged, setHasUserEngaged] = useState(false);
  const [savedMatches, setSavedMatches] = useState<MatchJournal[]>(() =>
    listGuestMatches(),
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const activeMatches = savedMatches.filter(
    (journal) => deriveJournal(journal).state.status === "active",
  );

  useEffect(() => {
    if (!showDeleteToast) return;

    const timeoutId = window.setTimeout(() => setShowDeleteToast(false), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [showDeleteToast]);

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

  function confirmDeleteMatch(matchId: string) {
    removeMatch(matchId);
    setSavedMatches((matches) =>
      matches.filter((match) => match.definition.id !== matchId),
    );
    setPendingDeleteId(null);
    setShowDeleteToast(true);
  }

  return (
    <div className="min-h-screen min-h-dvh bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppHeader />
      <main className="mx-auto w-full max-w-[760px] px-[clamp(18px,5vw,40px)] pt-[clamp(44px,8vw,84px)] pb-14 max-[560px]:pt-[38px]">
        <PwaUpdateNotice />
        <section className={styles.hero} aria-labelledby="hero-title">
          <p className={styles.eyebrow}>{t("sportEyebrow")}</p>
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
              <p>{t(isAccount ? "resumeBodyAccount" : "resumeBody")}</p>
            </div>
            <div className={styles.resumeList}>
              {activeMatches.map((journal) => {
                const state = deriveJournal(journal).state;
                const serverName =
                  journal.definition.teams[state.servingTeam].players[
                    state.currentServer
                  ]?.name || t(state.servingTeam === "A" ? "teamA" : "teamB");

                return (
                  <article
                    className={styles.resumeMatch}
                    key={journal.definition.id}
                    aria-label={`${t(journal.definition.sport)} ${t(journal.definition.format ?? "doubles")}`}
                  >
                    <span className={styles.resumeMatchTitle}>
                      {t(journal.definition.sport)} ·{" "}
                      {t(journal.definition.format ?? "doubles")}
                    </span>
                    <div
                      className={styles.resumeMatchScore}
                      role="group"
                      aria-label={t("score")}
                    >
                      <span>{t("teamA")}</span>
                      <strong>
                        {pointLabel(state, "A", locale)}
                        <span aria-hidden="true">:</span>
                        {pointLabel(state, "B", locale)}
                      </strong>
                      <span>{t("teamB")}</span>
                    </div>
                    <span className={styles.resumeMatchServer}>
                      <span
                        className={styles.resumeServerIndicator}
                        aria-hidden="true"
                      />
                      <span className={styles.resumeMatchServerName}>
                        {t("server")}: {serverName}
                      </span>
                    </span>
                    <div className={styles.resumeMatchActions}>
                      <Button
                        variant="default"
                        className={styles.resumeButton}
                        type="button"
                        onClick={() =>
                          navigate(
                            localizedPath(
                              `/match/${journal.definition.id}`,
                              locale,
                            ),
                          )
                        }
                      >
                        {t("resumeMatch")}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className={styles.deleteMatchButton}
                        type="button"
                        aria-label={`${t("deleteMatch")} ${t(journal.definition.sport)}`}
                        title={`${t("deleteMatch")} ${t(journal.definition.sport)}`}
                        onClick={() => {
                          setShowDeleteToast(false);
                          setPendingDeleteId(journal.definition.id);
                        }}
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </Button>
                    </div>
                    {pendingDeleteId === journal.definition.id ? (
                      <div
                        className={styles.deleteMatchConfirm}
                        role="group"
                        aria-label={t("deleteMatchPromptGroup")}
                      >
                        <p>{t("deleteMatchConfirm")}</p>
                        <div className={styles.deleteMatchConfirmActions}>
                          <Button
                            variant="default"
                            className={styles.deleteMatchConfirmButton}
                            type="button"
                            onClick={() =>
                              confirmDeleteMatch(journal.definition.id)
                            }
                          >
                            {t("confirmDeleteMatch")}
                          </Button>
                          <Button
                            variant="outline"
                            className={styles.deleteMatchCancelButton}
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                          >
                            {t("cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        {showDeleteToast ? (
          <div className={styles.deleteToast} role="status" aria-atomic="true">
            <Check aria-hidden="true" size={18} />
            <span>{t("matchDeleted")}</span>
          </div>
        ) : null}

        <section className={styles.quickStart} aria-label={t("quickStart")}>
          <fieldset className={styles.optionGroup}>
            <legend>
              <span className={styles.optionStep} aria-hidden="true">
                1
              </span>
              <span>{t("chooseSport")}</span>
            </legend>
            <RadioGroup
              className={styles.optionGrid}
              name="sport"
              value={sport}
              onValueChange={(value) => {
                const nextSport = value as Sport;
                setHasUserEngaged(true);
                setSport(nextSport);
                if (format === "mixed_doubles") setFormat("doubles");
              }}
            >
              <ChoiceCard
                checked={sport === "badminton"}
                value="badminton"
                label={t("badminton")}
                hint={t("badmintonHint")}
              />
              <ChoiceCard
                checked={sport === "pickleball"}
                value="pickleball"
                label={t("pickleball")}
                hint={t("pickleballHint")}
              />
              <ChoiceCard
                checked={sport === "tennis"}
                value="tennis"
                label={t("tennis")}
                hint={t("tennisHint")}
              />
              <ChoiceCard
                checked={sport === "padel"}
                value="padel"
                label={t("padel")}
                hint={t("padelHint")}
              />
              <ChoiceCard
                checked={sport === "table_tennis"}
                value="table_tennis"
                label={t("table_tennis")}
                hint={t("tableTennisHint")}
              />
              <ChoiceCard
                checked={sport === "squash"}
                value="squash"
                label={t("squash")}
                hint={t("squashHint")}
              />
            </RadioGroup>
          </fieldset>

          <fieldset className={styles.optionGroup}>
            <legend>
              <span className={styles.optionStep} aria-hidden="true">
                2
              </span>
              <span>{t("chooseFormat")}</span>
            </legend>
            <RadioGroup
              className={styles.optionGrid}
              name="format"
              value={format}
              onValueChange={(value) => {
                setHasUserEngaged(true);
                setFormat(value as MatchFormat);
              }}
            >
              <ChoiceCard
                checked={format === "singles"}
                value="singles"
                label={t(sport === "padel" ? "padelSingles" : "singles")}
                hint={t(sport === "padel" ? "padelSinglesHint" : "singlesHint")}
              />
              <ChoiceCard
                checked={format === "doubles"}
                value="doubles"
                label={t("doubles")}
                hint={t("doublesHint")}
              />
              {sport === "tennis" || sport === "padel" ? (
                <ChoiceCard
                  checked={format === "mixed_doubles"}
                  value="mixed_doubles"
                  label={t("mixedDoubles")}
                  hint={t("mixedDoublesHint")}
                />
              ) : null}
            </RadioGroup>
          </fieldset>

          <div className={styles.primaryAction}>
            <Button
              variant="default"
              className={styles.primaryButton}
              type="button"
              onClick={continueToSetup}
            >
              {t("continue")} <span aria-hidden="true">→</span>
            </Button>
          </div>
          <p className={styles.guestNote}>
            {t(isAccount ? "accountNote" : "guestNote")}
          </p>
          <PwaInstallControl hasUserEngaged={hasUserEngaged} />
        </section>
      </main>

      <footer className={styles.footer}>
        <span>{t("officialRules")}</span>
        <span>{t("officialHint")}</span>
        <Link
          className={styles.communityFooterLink}
          to={localizedPath("/rules", locale)}
        >
          {t("communityRules")}
        </Link>
      </footer>
    </div>
  );
}

interface ChoiceCardProps {
  checked: boolean;
  hint: string;
  label: string;
  value: string;
}

function ChoiceCard({ checked, hint, label, value }: ChoiceCardProps) {
  return (
    <RadioGroupItem
      className={styles.choiceCard}
      value={value}
      aria-label={`${label} ${hint}`}
      data-selected={checked}
    >
      <span className={`${styles.choiceCopy} flex min-w-0 flex-col gap-1`}>
        <strong>{label}</strong>
        <small title={hint}>{hint}</small>
      </span>
    </RadioGroupItem>
  );
}
