import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  OFFICIAL_RULESETS,
  type ScoringRules,
  type Sport,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n";
import { saveDraft } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { isRateLimitError } from "../../lib/userError";
import type { Json } from "../../lib/database.types";
import styles from "../../styles/App.module.css";

interface CommunityRule {
  id: string;
  sport: string;
  title: string;
  description: string;
  current_version: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

function validSport(sport: string): sport is Sport {
  return sport === "badminton" || sport === "pickleball";
}

function isScoringRules(value: unknown): value is ScoringRules {
  if (!value || typeof value !== "object") return false;
  const rules = value as Partial<ScoringRules>;
  return (
    Number.isInteger(rules.pointsToWin) &&
    Number.isInteger(rules.winBy) &&
    (rules.maxPoints === null || Number.isInteger(rules.maxPoints)) &&
    (rules.bestOf === 1 || rules.bestOf === 3 || rules.bestOf === 5) &&
    (rules.scoringMode === "rally" || rules.scoringMode === "side_out") &&
    (rules.serversPerTurn === 1 || rules.serversPerTurn === 2) &&
    (rules.openingServerNumber === 1 || rules.openingServerNumber === 2)
  );
}

export function CommunityRulesDirectoryPage() {
  const { t } = useLocale();
  const { user, isAnonymous } = useAuth();
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        setLoading(false);
        setError(t("backendNotConfigured"));
        return;
      }
      const { data: visibleRules, error: publicError } = await supabase.rpc(
        "list_community_rules",
      );
      if (!active) return;
      if (publicError) {
        setError(publicError.message);
        setLoading(false);
        return;
      }
      setRules((visibleRules ?? []) as CommunityRule[]);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [user, isAnonymous, t]);

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <div className={styles.rulesPageHeading}>
          <div>
            <p className={styles.eyebrow}>{t("communityRules")}</p>
            <h1>{t("communityLibraryTitle")}</h1>
            <p>{t("communityLibraryIntro")}</p>
          </div>
          {user && !isAnonymous ? (
            <Link className={styles.primaryButton} to="/rules/new">
              {t("createCommunityRule")}
            </Link>
          ) : null}
        </div>
        <CommunityDisclaimer />
        {loading ? <p role="status">{t("loading")}</p> : null}
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && rules.length === 0 ? (
          <section className={styles.rulesEmpty}>
            <h2>{t("noCommunityRulesYet")}</h2>
            <p>{t("noCommunityRulesBody")}</p>
          </section>
        ) : null}
        <div className={styles.communityRuleList}>
          {rules.map((rule) => (
            <article className={styles.communityRuleCard} key={rule.id}>
              <div className={styles.communityRuleCardTop}>
                <span className={styles.unofficialBadge}>
                  {t("unofficial")}
                </span>
                <span>
                  {t(validSport(rule.sport) ? rule.sport : "badminton")}
                </span>
                {!rule.is_published ? <span>{t("unpublished")}</span> : null}
              </div>
              <h2>
                <Link to={"/rules/" + rule.id}>{rule.title}</Link>
              </h2>
              <p>{rule.description || t("noRuleDescription")}</p>
              <span className={styles.ruleVersion}>
                {t("version")} {rule.current_version}
              </span>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export function CommunityRuleDetailPage() {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { loading: authLoading, user, isAnonymous } = useAuth();
  const [rule, setRule] = useState<CommunityRule | null>(null);
  const [configuration, setConfiguration] = useState<ScoringRules | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reportReason, setReportReason] = useState("misleading");
  const [reportDetails, setReportDetails] = useState("");
  const [reportContact, setReportContact] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!ruleId || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data: ruleRows, error } = await supabase.rpc(
        "read_community_rule",
        { p_rule_id: ruleId },
      );
      if (!active) return;
      const data = ruleRows?.[0];
      if (error || !data || !validSport(data.sport)) {
        setLoading(false);
        return;
      }
      setRule(data as CommunityRule);
      setIsOwner(data.is_owner && Boolean(user && !isAnonymous));
      const { data: versions } = await supabase.rpc(
        "read_community_rule_version",
        { p_rule_id: ruleId, p_version: data.current_version },
      );
      if (!active) return;
      const version = versions?.[0];
      if (version && isScoringRules(version.configuration)) {
        setConfiguration(version.configuration);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ruleId, user, isAnonymous]);

  async function copyRuleLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage(t("linkCopied"));
    } catch {
      setMessage(t("copyFailed"));
    }
  }

  async function shareRuleLink() {
    if (!navigator.share) {
      await copyRuleLink();
      return;
    }
    try {
      await navigator.share({
        title: rule?.title ?? t("communityRules"),
        url: window.location.href,
      });
      setMessage(t("shareReady"));
    } catch {
      setMessage("");
    }
  }

  function useRule() {
    if (!rule || !validSport(rule.sport)) return;
    saveDraft({ sport: rule.sport, mode: "casual", communityRuleId: rule.id });
    navigate("/setup");
  }

  async function unpublish() {
    if (!ruleId || !supabase) return;
    const { data, error } = await supabase.rpc("unpublish_community_rule", {
      p_rule_id: ruleId,
    });
    if (error || !data) {
      setMessage(error?.message ?? t("saveFailed"));
      return;
    }
    setRule((current) =>
      current ? { ...current, is_published: false } : current,
    );
    setMessage(t("ruleUnpublished"));
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ruleId || !supabase) return;
    setReporting(true);
    const { error } = await supabase.rpc("report_community_rule_v2", {
      p_rule_id: ruleId,
      p_reason: reportReason,
      p_details: reportDetails.trim(),
      p_reporter_contact: reportContact.trim() || null,
    });
    setReporting(false);
    setMessage(
      error
        ? isRateLimitError(error.message)
          ? t("rateLimited")
          : error.message
        : t("reportSubmitted"),
    );
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <Link className={styles.textButton} to="/rules">
          ← {t("backToRules")}
        </Link>
        {loading ? <p role="status">{t("loading")}</p> : null}
        {!loading && !rule ? (
          <section className={styles.rulesEmpty}>
            <h1>{t("ruleUnavailable")}</h1>
            <p>{t("ruleUnavailableBody")}</p>
          </section>
        ) : null}
        {rule ? (
          <>
            <div className={styles.rulesPageHeading}>
              <div>
                <p className={styles.eyebrow}>
                  {t("communityRules")} ·{" "}
                  {t(validSport(rule.sport) ? rule.sport : "badminton")}
                </p>
                <h1>{rule.title}</h1>
                <p>{rule.description || t("noRuleDescription")}</p>
                <span className={styles.ruleVersion}>
                  {t("version")} {rule.current_version}
                </span>
                {!rule.is_published ? (
                  <span className={styles.unpublishedBadge}>
                    {t("unpublished")}
                  </span>
                ) : null}
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!configuration || !rule.is_published}
                onClick={useRule}
              >
                {t("useTheseRules")}
              </button>
            </div>
            <CommunityDisclaimer />
            {configuration ? <RulesSummary rules={configuration} /> : null}
            <section className={styles.ruleSharePanel}>
              <div>
                <h2>{t("shareCommunityRule")}</h2>
                <p>{t("shareCommunityRuleBody")}</p>
                <div className={styles.shareActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void shareRuleLink()}
                  >
                    {t("shareLink")}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void copyRuleLink()}
                  >
                    {t("copyLink")}
                  </button>
                </div>
              </div>
              <div className={styles.ruleQr} aria-label={t("qrCode")}>
                <QRCodeSVG
                  value={window.location.href}
                  size={176}
                  level="M"
                  includeMargin
                />
              </div>
            </section>
            {isOwner ? (
              <div className={styles.shareActions}>
                <Link
                  className={styles.secondaryButton}
                  to={"/rules/" + rule.id + "/edit"}
                >
                  {t("editRule")}
                </Link>
                {rule.is_published ? (
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => void unpublish()}
                  >
                    {t("unpublishRule")}
                  </button>
                ) : null}
              </div>
            ) : rule.is_published ? (
              <form className={styles.reportForm} onSubmit={submitReport}>
                <h2>{t("reportRule")}</h2>
                <label>
                  <span>{t("reportReason")}</span>
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                  >
                    <option value="incorrect">{t("reportIncorrect")}</option>
                    <option value="misleading">{t("reportMisleading")}</option>
                    <option value="unsafe">{t("reportUnsafe")}</option>
                    <option value="spam">{t("reportSpam")}</option>
                    <option value="rights">{t("reportRights")}</option>
                    <option value="other">{t("reportOther")}</option>
                  </select>
                </label>
                <label>
                  <span>{t("reportDetails")}</span>
                  <textarea
                    maxLength={500}
                    value={reportDetails}
                    onChange={(event) => setReportDetails(event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("reportContact")}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={reportContact}
                    onChange={(event) => setReportContact(event.target.value)}
                  />
                  <small>{t("reportContactHint")}</small>
                </label>
                <p>{t("reportReviewNote")}</p>
                {!user && !authLoading ? (
                  <p role="status">{t("reportSessionRequired")}</p>
                ) : null}
                <button
                  className={styles.secondaryButton}
                  type="submit"
                  disabled={reporting || authLoading || !user}
                >
                  {reporting ? t("working") : t("submitReport")}
                </button>
              </form>
            ) : null}
            {message ? (
              <p className={styles.formStatus} role="status">
                {message}
              </p>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

export function CommunityRuleEditorPage() {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { user, isAnonymous } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState<Sport>("badminton");
  const [rules, setRules] = useState<ScoringRules>({
    ...OFFICIAL_RULESETS.badminton.configuration,
  });
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [loading, setLoading] = useState(Boolean(ruleId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newRuleId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!ruleId || !supabase) return;
    let active = true;
    void (async () => {
      const { data: rules, error: loadError } = await supabase.rpc(
        "read_community_rule",
        { p_rule_id: ruleId },
      );
      if (!active) return;
      const rule = rules?.[0];
      if (loadError || !rule || !user || isAnonymous || !rule.is_owner) {
        setError(t("notRuleOwner"));
        setLoading(false);
        return;
      }
      if (!validSport(rule.sport)) {
        setError(t("loadRuleError"));
        setLoading(false);
        return;
      }
      setSport(rule.sport);
      setTitle(rule.title);
      setDescription(rule.description);
      setExpectedVersion(rule.current_version);
      const { data: versions } = await supabase.rpc(
        "read_community_rule_version",
        { p_rule_id: rule.id, p_version: rule.current_version },
      );
      if (!active) return;
      const version = versions?.[0];
      if (version && isScoringRules(version.configuration))
        setRules(version.configuration);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ruleId, user, isAnonymous, t]);

  function changeSport(nextSport: Sport) {
    setSport(nextSport);
    setRules({ ...OFFICIAL_RULESETS[nextSport].configuration });
  }

  function updateRules<Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) {
    setRules((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || isAnonymous) {
      setError(t("googleRequired"));
      return;
    }
    if (rules.maxPoints !== null && rules.maxPoints < rules.pointsToWin) {
      setError(t("capMustBeAtLeastTarget"));
      return;
    }
    setSaving(true);
    setError("");
    const id = ruleId ?? newRuleId;
    const { error: saveError } = await supabase.rpc("save_community_rule", {
      p_rule_id: id,
      p_expected_version: expectedVersion,
      p_sport: sport,
      p_title: title.trim(),
      p_description: description.trim(),
      p_configuration: JSON.parse(JSON.stringify(rules)) as Json,
      p_is_published: true,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    navigate("/rules/" + id);
  }

  if (!user || isAnonymous) {
    return (
      <div className={styles.pageShell}>
        <AppHeader />
        <main className={styles.rulesMain}>
          <h1>{t("googleRequired")}</h1>
          <p>{t("googleRequiredBody")}</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <Link className={styles.textButton} to="/rules">
          ← {t("backToRules")}
        </Link>
        <p className={styles.eyebrow}>{t("communityRules")}</p>
        <h1>{ruleId ? t("editRule") : t("createCommunityRule")}</h1>
        <CommunityDisclaimer />
        {loading ? <p role="status">{t("loading")}</p> : null}
        <form className={styles.communityRuleForm} onSubmit={save}>
          <label>
            <span>{t("ruleTitle")}</span>
            <input
              required
              minLength={3}
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            <span>{t("sport")}</span>
            <select
              value={sport}
              onChange={(event) => changeSport(event.target.value as Sport)}
            >
              <option value="badminton">{t("badminton")}</option>
              <option value="pickleball">{t("pickleball")}</option>
            </select>
          </label>
          <label>
            <span>{t("ruleDescription")}</span>
            <textarea
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <ScoringRulesFields rules={rules} updateRules={updateRules} t={t} />
          <p className={styles.rulePublishNote}>{t("publishNowNote")}</p>
          {error ? (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={saving || loading}
          >
            {saving ? t("working") : t("publishRule")}
          </button>
        </form>
      </main>
    </div>
  );
}

function CommunityDisclaimer() {
  const { t } = useLocale();
  return (
    <p className={styles.communityDisclaimer} role="note">
      {t("communityDisclaimer")}
    </p>
  );
}

function RulesSummary({ rules }: { rules: ScoringRules }) {
  const { t } = useLocale();
  return (
    <dl className={styles.rulesSummary}>
      <div>
        <dt>{t("pointsToWin")}</dt>
        <dd>{rules.pointsToWin}</dd>
      </div>
      <div>
        <dt>{t("winBy")}</dt>
        <dd>{rules.winBy}</dd>
      </div>
      <div>
        <dt>{t("maxPoints")}</dt>
        <dd>{rules.maxPoints ?? t("noCap")}</dd>
      </div>
      <div>
        <dt>{t("bestOf")}</dt>
        <dd>{rules.bestOf}</dd>
      </div>
      <div>
        <dt>{t("scoringMode")}</dt>
        <dd>
          {t(rules.scoringMode === "rally" ? "rallyScoring" : "sideOutScoring")}
        </dd>
      </div>
    </dl>
  );
}

function ScoringRulesFields({
  rules,
  updateRules,
  t,
}: {
  rules: ScoringRules;
  updateRules: <Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <div className={styles.communityScoringFields}>
      <label>
        <span>{t("pointsToWin")}</span>
        <input
          type="number"
          min="1"
          max="101"
          value={rules.pointsToWin}
          onChange={(event) =>
            updateRules("pointsToWin", Number(event.target.value))
          }
          required
        />
      </label>
      <label>
        <span>{t("winBy")}</span>
        <input
          type="number"
          min="1"
          max="10"
          value={rules.winBy}
          onChange={(event) => updateRules("winBy", Number(event.target.value))}
          required
        />
      </label>
      <label>
        <span>{t("maxPoints")}</span>
        <input
          type="number"
          min={rules.pointsToWin}
          max="101"
          value={rules.maxPoints ?? ""}
          onChange={(event) =>
            updateRules(
              "maxPoints",
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      </label>
      <label>
        <span>{t("bestOf")}</span>
        <select
          value={rules.bestOf}
          onChange={(event) =>
            updateRules("bestOf", Number(event.target.value) as 1 | 3 | 5)
          }
        >
          <option value="1">{t("bestOfOne")}</option>
          <option value="3">{t("bestOfThree")}</option>
          <option value="5">{t("bestOfFive")}</option>
        </select>
      </label>
      <label>
        <span>{t("scoringMode")}</span>
        <select
          value={rules.scoringMode}
          onChange={(event) =>
            updateRules(
              "scoringMode",
              event.target.value as ScoringRules["scoringMode"],
            )
          }
        >
          <option value="rally">{t("rallyScoring")}</option>
          <option value="side_out">{t("sideOutScoring")}</option>
        </select>
      </label>
      {rules.scoringMode === "side_out" ? (
        <>
          <label>
            <span>{t("serversPerTurn")}</span>
            <select
              value={rules.serversPerTurn}
              onChange={(event) =>
                updateRules(
                  "serversPerTurn",
                  Number(event.target.value) as 1 | 2,
                )
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <label>
            <span>{t("openingServerNumber")}</span>
            <select
              value={rules.openingServerNumber}
              onChange={(event) =>
                updateRules(
                  "openingServerNumber",
                  Number(event.target.value) as 1 | 2,
                )
              }
            >
              <option value="1">{t("serverOne")}</option>
              <option value="2">{t("serverTwo")}</option>
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}
