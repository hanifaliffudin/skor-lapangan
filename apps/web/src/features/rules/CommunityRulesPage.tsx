import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  type CommunityRuleConfiguration,
  type PadelRules,
  type ScoringRules,
  type Sport,
  type SquashRules,
  type TableTennisRules,
  type TennisRules,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectControl } from "@/components/ui/select-control";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { normalizeIntegerInput } from "../../lib/numberInput";
import { applySeoMetadata, communityRulesSchema } from "../../lib/seo";
import { saveDraft } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { isRateLimitError } from "../../lib/userError";
import type { Json } from "../../lib/database.types";
import {
  decodeCommunityRuleConfiguration,
  defaultCommunityRuleConfiguration,
  isCommunitySport,
  type CommunityRuleRecord,
} from "./communityRule";
import styles from "../../styles/App.module.css";

const RULES_PAGE_SIZE = 50;
type CommunityRuleScope = "all" | "published" | "mine";

export function CommunityRulesDirectoryPage() {
  const location = useLocation();
  const { locale, t } = useLocale();
  const { user, isAnonymous } = useAuth();

  useEffect(() => {
    const path = locale === "id" ? "/id/rules" : "/rules";
    applySeoMetadata({
      locale,
      path,
      title: t("communityRulesPageTitle"),
      description: t("communityRulesSeoDescription"),
      schema: communityRulesSchema(
        locale,
        t("communityRulesPageTitle"),
        t("communityRulesSeoDescription"),
      ),
    });
  }, [locale, location.pathname, t]);

  const [rules, setRules] = useState<CommunityRuleRecord[]>([]);
  const [sportFilter, setSportFilter] = useState<Sport | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<CommunityRuleScope>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rulesCursor, setRulesCursor] = useState<{
    updatedAt: string;
    id: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setSearchQuery(searchInput.trim()),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if ((!user || isAnonymous) && scopeFilter === "mine") {
      setScopeFilter("all");
    }
  }, [isAnonymous, scopeFilter, user]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRules([]);
    setRulesCursor(null);
    setHasMore(false);
    async function load() {
      if (!supabase) {
        setLoading(false);
        setError(t("backendNotConfigured"));
        return;
      }
      const { data: visibleRules, error: publicError } = await supabase.rpc(
        "list_community_rules_page",
        {
          p_sport: sportFilter === "all" ? null : sportFilter,
          p_search: searchQuery || null,
          p_scope: scopeFilter,
          p_limit: RULES_PAGE_SIZE,
          p_before_updated_at: null,
          p_before_id: null,
        },
      );
      if (!active) return;
      if (publicError) {
        setError(publicError.message);
        setLoading(false);
        return;
      }
      const page = (visibleRules ?? []).filter(
        (rule): rule is CommunityRuleRecord => isCommunitySport(rule.sport),
      );
      const last = page.at(-1);
      setRules(page);
      setRulesCursor(last ? { updatedAt: last.updated_at, id: last.id } : null);
      setHasMore(page.length === RULES_PAGE_SIZE);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [isAnonymous, searchQuery, scopeFilter, sportFilter, t, user]);

  async function loadMoreRules() {
    if (!supabase || !rulesCursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data, error: publicError } = await supabase.rpc(
      "list_community_rules_page",
      {
        p_sport: sportFilter === "all" ? null : sportFilter,
        p_search: searchQuery || null,
        p_scope: scopeFilter,
        p_limit: RULES_PAGE_SIZE,
        p_before_updated_at: rulesCursor.updatedAt,
        p_before_id: rulesCursor.id,
      },
    );
    if (publicError) {
      setError(publicError.message);
      setLoadingMore(false);
      return;
    }
    const page = (data ?? []).filter((rule): rule is CommunityRuleRecord =>
      isCommunitySport(rule.sport),
    );
    const last = page.at(-1);
    setRules((current) => [...current, ...page]);
    setRulesCursor(last ? { updatedAt: last.updated_at, id: last.id } : null);
    setHasMore(page.length === RULES_PAGE_SIZE);
    setLoadingMore(false);
  }

  const normalizedSearch = searchInput.trim().toLocaleLowerCase();
  const visibleRules = rules.filter((rule) => {
    const matchesSport = sportFilter === "all" || rule.sport === sportFilter;
    const matchesScope =
      scopeFilter === "all" ||
      (scopeFilter === "published" && rule.is_published) ||
      (scopeFilter === "mine" && rule.is_owner);
    const matchesSearch =
      !normalizedSearch ||
      `${rule.title} ${rule.description}`
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    return matchesSport && matchesScope && matchesSearch;
  });
  const hasRuleFilters = Boolean(
    searchInput.trim() || sportFilter !== "all" || scopeFilter !== "all",
  );

  function clearCommunityFilters() {
    setSearchInput("");
    setSearchQuery("");
    setSportFilter("all");
    setScopeFilter("all");
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <Link className={styles.textButton} to={localizedPath("/", locale)}>
          ← {t("backToHome")}
        </Link>
        <div className={styles.rulesPageHeading}>
          <div>
            <p className={styles.eyebrow}>{t("communityRules")}</p>
            <h1>{t("communityLibraryTitle")}</h1>
            <p>{t("communityLibraryIntro")}</p>
          </div>
          {user && !isAnonymous ? (
            <Link
              className={styles.primaryButton}
              to={localizedPath("/rules/new", locale)}
            >
              {t("createCommunityRule")}
            </Link>
          ) : null}
        </div>
        <CommunityDisclaimer />
        <section
          className={styles.communityFilters}
          aria-label={t("communityRules")}
        >
          <label className={styles.communitySearch}>
            <span className="sr-only">{t("communitySearchPlaceholder")}</span>
            <Input
              type="search"
              value={searchInput}
              placeholder={t("communitySearchPlaceholder")}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <div className={styles.communityFilterRow}>
            <Label className={styles.selectField}>
              <span>{t("sport")}</span>
              <SelectControl
                name="community-sport-filter"
                value={sportFilter}
                onChange={(event) =>
                  setSportFilter(event.target.value as Sport | "all")
                }
              >
                <option value="all">{t("allSports")}</option>
                <option value="badminton">{t("badminton")}</option>
                <option value="pickleball">{t("pickleball")}</option>
                <option value="tennis">{t("tennis")}</option>
                <option value="padel">{t("padel")}</option>
                <option value="table_tennis">{t("table_tennis")}</option>
                <option value="squash">{t("squash")}</option>
              </SelectControl>
            </Label>
            <Label className={styles.selectField}>
              <span>{t("communityFilterLabel")}</span>
              <SelectControl
                name="community-scope-filter"
                value={scopeFilter}
                onChange={(event) =>
                  setScopeFilter(event.target.value as CommunityRuleScope)
                }
              >
                <option value="all">{t("communityFilterAll")}</option>
                <option value="published">
                  {t("communityFilterPublished")}
                </option>
                {user && !isAnonymous ? (
                  <option value="mine">{t("communityFilterMine")}</option>
                ) : null}
              </SelectControl>
            </Label>
          </div>
        </section>
        {loading ? <p role="status">{t("loading")}</p> : null}
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && visibleRules.length === 0 ? (
          <section className={styles.rulesEmpty}>
            <h2>
              {t(hasRuleFilters ? "communityNoResults" : "noCommunityRulesYet")}
            </h2>
            <p>
              {t(
                hasRuleFilters
                  ? "communityLibraryIntro"
                  : "noCommunityRulesBody",
              )}
            </p>
            {hasRuleFilters ? (
              <Button
                variant="outline"
                type="button"
                className="mt-4 min-h-11"
                onClick={clearCommunityFilters}
              >
                {t("clearCommunityFilters")}
              </Button>
            ) : null}
          </section>
        ) : null}
        <div className={styles.communityRuleList}>
          {visibleRules.map((rule) => (
            <article className={styles.communityRuleCard} key={rule.id}>
              <Link
                className={styles.communityRuleCardLink}
                to={localizedPath(`/rules/${rule.id}`, locale)}
              >
                <div className={styles.communityRuleCardTop}>
                  <span className={styles.unofficialBadge}>
                    {t("unofficial")}
                  </span>
                  <span>
                    {t(isCommunitySport(rule.sport) ? rule.sport : "badminton")}
                  </span>
                  {!rule.is_published ? <span>{t("unpublished")}</span> : null}
                </div>
                <h2>{rule.title}</h2>
                <p>{rule.description || t("noRuleDescription")}</p>
                <div className={styles.communityRuleCardFooter}>
                  <span className={styles.ruleVersion}>
                    {t("version")} {rule.current_version}
                  </span>
                  <span className={styles.communityRuleCardCta}>
                    {t("viewCommunityRule")}
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
        {hasMore && !error ? (
          <Button
            variant="outline"
            className="mt-6 min-h-11"
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMoreRules()}
          >
            {loadingMore ? t("loading") : t("loadMore")}
          </Button>
        ) : null}
      </main>
    </div>
  );
}

export function CommunityRuleDetailPage() {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { loading: authLoading, user, isAnonymous } = useAuth();

  useEffect(() => {
    applySeoMetadata({
      locale,
      path: `${locale === "id" ? "/id" : ""}/rules/${ruleId ?? "unknown"}`,
      title: t("communityRulesPageTitle"),
      description: t("communityRulesSeoDescription"),
      robots: "noindex, nofollow",
    });
  }, [locale, ruleId, t]);

  const [rule, setRule] = useState<CommunityRuleRecord | null>(null);
  const [configuration, setConfiguration] =
    useState<CommunityRuleConfiguration | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [configurationError, setConfigurationError] = useState("");
  const [reportReason, setReportReason] = useState("misleading");
  const [reportDetails, setReportDetails] = useState("");
  const [reportContact, setReportContact] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState("");
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setReportSubmitted(false);
    setReportError("");
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
      if (error || !data || !isCommunitySport(data.sport)) {
        setLoading(false);
        return;
      }
      const typedRule = { ...data, sport: data.sport } as CommunityRuleRecord;
      setRule(typedRule);
      setIsOwner(data.is_owner && Boolean(user && !isAnonymous));
      const { data: versions } = await supabase.rpc(
        "read_community_rule_version",
        { p_rule_id: ruleId, p_version: data.current_version },
      );
      if (!active) return;
      const version = versions?.[0];
      const decoded = version
        ? decodeCommunityRuleConfiguration(version.configuration, data.sport)
        : null;
      setConfiguration(decoded);
      setConfigurationError(decoded ? "" : t("loadRuleError"));
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
    if (!rule || !isCommunitySport(rule.sport)) return;
    saveDraft({
      sport: rule.sport,
      format: "doubles",
      mode: "casual",
      communityRuleId: rule.id,
    });
    navigate(localizedPath("/setup", locale));
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

  async function publish() {
    if (!ruleId || !supabase) return;
    setPublishing(true);
    const { data, error } = await supabase.rpc("publish_community_rule", {
      p_rule_id: ruleId,
    });
    setPublishing(false);
    if (error || !data) {
      setMessage(error?.message ?? t("saveFailed"));
      return;
    }
    setRule((current) =>
      current ? { ...current, is_published: true } : current,
    );
    setMessage(t("ruleRepublished"));
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ruleId || !supabase) return;
    setReporting(true);
    setReportError("");
    const { error } = await supabase.rpc("report_community_rule_v2", {
      p_rule_id: ruleId,
      p_reason: reportReason,
      p_details: reportDetails.trim(),
      p_reporter_contact: reportContact.trim() || null,
    });
    setReporting(false);
    if (error) {
      setReportError(
        isRateLimitError(error.message) ? t("rateLimited") : error.message,
      );
      return;
    }
    setReportDetails("");
    setReportContact("");
    setReportSubmitted(true);
  }

  function startAnotherReport() {
    setReportReason("misleading");
    setReportError("");
    setReportSubmitted(false);
    window.setTimeout(() => reportHeadingRef.current?.focus(), 0);
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <Link
          className={styles.textButton}
          to={localizedPath("/rules", locale)}
        >
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
                  {t(isCommunitySport(rule.sport) ? rule.sport : "badminton")}
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
              <Button
                className={styles.primaryButton}
                type="button"
                disabled={!configuration || !rule.is_published}
                onClick={useRule}
              >
                {t("useTheseRules")}
              </Button>
            </div>
            <CommunityDisclaimer />
            {configurationError ? (
              <p className={styles.formError} role="alert">
                {configurationError}
              </p>
            ) : null}
            {configuration ? (
              <RulesSummary sport={rule.sport} configuration={configuration} />
            ) : null}
            <section className={styles.ruleSharePanel}>
              <div>
                <h2>{t("shareCommunityRule")}</h2>
                <p>{t("shareCommunityRuleBody")}</p>
                <div className={styles.shareActions}>
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void shareRuleLink()}
                  >
                    {t("shareLink")}
                  </Button>
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void copyRuleLink()}
                  >
                    {t("copyLink")}
                  </Button>
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
              <div className={styles.ruleOwnerActions}>
                <Link
                  className={styles.secondaryButton}
                  to={localizedPath(`/rules/${rule.id}/edit`, locale)}
                >
                  {t("editRule")}
                </Link>
                {rule.is_published ? (
                  <Button
                    variant="destructive"
                    className={styles.ruleUnpublishButton}
                    type="button"
                    onClick={() => void unpublish()}
                  >
                    {t("unpublishRule")}
                  </Button>
                ) : (
                  <Button
                    className={styles.ruleRepublishButton}
                    type="button"
                    disabled={publishing}
                    onClick={() => void publish()}
                  >
                    {publishing ? t("working") : t("republishRule")}
                  </Button>
                )}
              </div>
            ) : rule.is_published ? (
              reportSubmitted ? (
                <section
                  className={`${styles.reportForm} ${styles.reportSuccess}`}
                  role="status"
                  aria-live="polite"
                >
                  <h2>{t("reportSubmitted")}</h2>
                  <p>{t("reportSubmittedBody")}</p>
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    type="button"
                    onClick={startAnotherReport}
                  >
                    {t("reportAnother")}
                  </Button>
                </section>
              ) : (
                <form className={styles.reportForm} onSubmit={submitReport}>
                  <h2 ref={reportHeadingRef} tabIndex={-1}>
                    {t("reportRule")}
                  </h2>
                  <Label>
                    <span>{t("reportReason")}</span>
                    <SelectControl
                      name="report-reason"
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                    >
                      <option value="incorrect">{t("reportIncorrect")}</option>
                      <option value="misleading">
                        {t("reportMisleading")}
                      </option>
                      <option value="unsafe">{t("reportUnsafe")}</option>
                      <option value="spam">{t("reportSpam")}</option>
                      <option value="rights">{t("reportRights")}</option>
                      <option value="other">{t("reportOther")}</option>
                    </SelectControl>
                  </Label>
                  <Label>
                    <span>{t("reportDetails")}</span>
                    <Textarea
                      name="report-details"
                      maxLength={500}
                      value={reportDetails}
                      onChange={(event) => setReportDetails(event.target.value)}
                    />
                  </Label>
                  <Label>
                    <span>{t("reportContact")}</span>
                    <Input
                      name="report-contact"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={reportContact}
                      onChange={(event) => setReportContact(event.target.value)}
                    />
                    <small>{t("reportContactHint")}</small>
                  </Label>
                  <p>{t("reportReviewNote")}</p>
                  <p>{t("reportLimitNote")}</p>
                  {reportError ? (
                    <p className={styles.formError} role="alert">
                      {reportError}
                    </p>
                  ) : null}
                  {!user && !authLoading ? (
                    <p role="status">{t("reportSessionRequired")}</p>
                  ) : null}
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    type="submit"
                    disabled={reporting || authLoading || !user}
                  >
                    {reporting ? t("working") : t("submitReport")}
                  </Button>
                </form>
              )
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
  const { locale, t } = useLocale();
  const { user, isAnonymous } = useAuth();

  useEffect(() => {
    applySeoMetadata({
      locale,
      path: `${locale === "id" ? "/id" : ""}/rules/${ruleId ? `${ruleId}/edit` : "new"}`,
      title: t("communityRulesPageTitle"),
      description: t("communityRulesSeoDescription"),
      robots: "noindex, nofollow",
    });
  }, [locale, ruleId, t]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState<Sport>("badminton");
  const [configuration, setConfiguration] =
    useState<CommunityRuleConfiguration>(() =>
      defaultCommunityRuleConfiguration("badminton"),
    );
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [loading, setLoading] = useState(Boolean(ruleId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newRuleId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!supabase) {
      setError(t("backendNotConfigured"));
      setLoading(false);
      return;
    }
    if (!ruleId) return;
    let active = true;
    void (async () => {
      const { data: rules, error: loadError } = await supabase.rpc(
        "read_community_rule",
        { p_rule_id: ruleId },
      );
      if (!active) return;
      const rule = rules?.[0];
      if (loadError) {
        setError(t("loadRuleError"));
        setLoading(false);
        return;
      }
      if (!user || isAnonymous) {
        setError(t("googleRequired"));
        setLoading(false);
        return;
      }
      if (!rule || !rule.is_owner) {
        setError(t("notRuleOwner"));
        setLoading(false);
        return;
      }
      if (!isCommunitySport(rule.sport)) {
        setError(t("loadRuleError"));
        setLoading(false);
        return;
      }
      setSport(rule.sport);
      setTitle(rule.title);
      setDescription(rule.description);
      setExpectedVersion(rule.current_version);
      const { data: versions, error: versionError } = await supabase.rpc(
        "read_community_rule_version",
        { p_rule_id: rule.id, p_version: rule.current_version },
      );
      if (!active) return;
      if (versionError) {
        setError(t("loadRuleError"));
        setLoading(false);
        return;
      }
      const version = versions?.[0];
      const decoded = version
        ? decodeCommunityRuleConfiguration(version.configuration, rule.sport)
        : null;
      if (!decoded) {
        setError(t("loadRuleError"));
        setLoading(false);
        return;
      }
      setConfiguration(decoded);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ruleId, user, isAnonymous, t]);

  function changeSport(nextSport: Sport) {
    setSport(nextSport);
    setConfiguration(defaultCommunityRuleConfiguration(nextSport));
  }

  function updateRules<Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) {
    setConfiguration((current) => ({
      ...current,
      scoring: { ...current.scoring, [key]: value },
    }));
  }

  function updateTennis<Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) {
    if (!configuration.tennis) return;
    setConfiguration((current) => ({
      ...current,
      tennis: { ...current.tennis!, [key]: value },
    }));
  }

  function updatePadel<Key extends keyof PadelRules>(
    key: Key,
    value: PadelRules[Key],
  ) {
    if (!configuration.padel) return;
    setConfiguration((current) => ({
      ...current,
      padel: { ...current.padel!, [key]: value },
    }));
  }

  function updateTableTennis<Key extends keyof TableTennisRules>(
    key: Key,
    value: TableTennisRules[Key],
  ) {
    if (!configuration.tableTennis) return;
    setConfiguration((current) => ({
      ...current,
      tableTennis: { ...current.tableTennis!, [key]: value },
    }));
  }

  function updateSquash<Key extends keyof SquashRules>(
    key: Key,
    value: SquashRules[Key],
  ) {
    if (!configuration.squash) return;
    setConfiguration((current) => ({
      ...current,
      squash: { ...current.squash!, [key]: value },
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError(t("backendNotConfigured"));
      return;
    }
    if (!user || isAnonymous) {
      setError(t("googleRequired"));
      return;
    }
    if (
      configuration.scoring.maxPoints !== null &&
      configuration.scoring.maxPoints < configuration.scoring.pointsToWin
    ) {
      setError(t("capMustBeAtLeastTarget"));
      return;
    }
    if (!decodeCommunityRuleConfiguration(configuration, sport)) {
      setError(t("loadRuleError"));
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
      p_configuration: JSON.parse(JSON.stringify(configuration)) as Json,
      p_is_published: true,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    navigate(localizedPath(`/rules/${id}`, locale));
  }

  if (!user || isAnonymous) {
    return (
      <div className={styles.pageShell}>
        <AppHeader />
        <main className={styles.rulesMain}>
          <Link
            className={styles.textButton}
            to={localizedPath("/rules", locale)}
          >
            ← {t("backToRules")}
          </Link>
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
        <Link
          className={styles.textButton}
          to={localizedPath("/rules", locale)}
        >
          ← {t("backToRules")}
        </Link>
        <p className={styles.eyebrow}>{t("communityRules")}</p>
        <h1>{ruleId ? t("editRule") : t("createCommunityRule")}</h1>
        <CommunityDisclaimer />
        {loading ? <p role="status">{t("loading")}</p> : null}
        <form className={styles.communityRuleForm} onSubmit={save}>
          <Label>
            <span>{t("ruleTitle")}</span>
            <Input
              name="community-rule-title"
              required
              minLength={3}
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Label>
          <Label>
            <span>{t("sport")}</span>
            <SelectControl
              name="community-sport"
              value={sport}
              onChange={(event) => changeSport(event.target.value as Sport)}
            >
              <option value="badminton">{t("badminton")}</option>
              <option value="pickleball">{t("pickleball")}</option>
              <option value="tennis">{t("tennis")}</option>
              <option value="padel">{t("padel")}</option>
              <option value="table_tennis">{t("table_tennis")}</option>
              <option value="squash">{t("squash")}</option>
            </SelectControl>
          </Label>
          <Label>
            <span>{t("ruleDescription")}</span>
            <Textarea
              name="community-rule-description"
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Label>
          <CommunityConfigurationFields
            sport={sport}
            configuration={configuration}
            updateRules={updateRules}
            updateTennis={updateTennis}
            updatePadel={updatePadel}
            updateTableTennis={updateTableTennis}
            updateSquash={updateSquash}
            t={t}
          />
          <p className={styles.rulePublishNote}>{t("publishNowNote")}</p>
          {error ? (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}
          <Button
            className={styles.primaryButton}
            type="submit"
            disabled={saving || loading}
          >
            {saving ? t("working") : t("publishRule")}
          </Button>
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

function RulesSummary({
  sport,
  configuration,
}: {
  sport: Sport;
  configuration: CommunityRuleConfiguration;
}) {
  const { t } = useLocale();
  const bestOfLabel = (bestOf: 1 | 3 | 5) =>
    t(bestOf === 1 ? "bestOfOne" : bestOf === 3 ? "bestOfThree" : "bestOfFive");
  const rows: Array<[string, string | number]> = [
    [t("pointsToWin"), configuration.scoring.pointsToWin],
    [t("winBy"), configuration.scoring.winBy],
    [t("maxPoints"), configuration.scoring.maxPoints ?? t("noCap")],
    [t("bestOf"), bestOfLabel(configuration.scoring.bestOf)],
    [
      t("scoringMode"),
      t(
        configuration.scoring.scoringMode === "rally"
          ? "rallyScoring"
          : "sideOutScoring",
      ),
    ],
  ];

  if (sport === "tennis" && configuration.tennis) {
    rows.push(
      [
        t("tennisGameScoring"),
        t(
          configuration.tennis.gameScoring === "advantage"
            ? "tennisAdvantage"
            : "tennisNoAd",
        ),
      ],
      [
        t("tennisSetScoring"),
        t(
          configuration.tennis.setScoring === "tiebreak"
            ? "tennisTiebreakSet"
            : "tennisAdvantageSet",
        ),
      ],
      [
        t("tennisFinalSet"),
        t(
          configuration.tennis.finalSetScoring === "tiebreak"
            ? "tennisTiebreakSet"
            : configuration.tennis.finalSetScoring === "advantage"
              ? "tennisAdvantageSet"
              : "tennisMatchTiebreak",
        ),
      ],
      [
        t("tennisMatchTiebreakTarget"),
        configuration.tennis.matchTieBreakPoints,
      ],
    );
  }
  if (sport === "padel" && configuration.padel) {
    rows.push(
      [
        t("padelGameScoring"),
        t(
          configuration.padel.gameScoring === "advantage"
            ? "padelAdvantage"
            : configuration.padel.gameScoring === "star_point"
              ? "padelStarPoint"
              : "padelGoldenPoint",
        ),
      ],
      [
        t("padelSetScoring"),
        t(
          configuration.padel.setScoring === "standard"
            ? "padelStandardSet"
            : "padelMiniSet",
        ),
      ],
      [
        t("padelFinalSet"),
        t(
          configuration.padel.finalSetScoring === "standard"
            ? "padelStandardSet"
            : configuration.padel.finalSetScoring === "advantage"
              ? "padelAdvantageSet"
              : "padelMatchTiebreak",
        ),
      ],
      [t("padelMatchTiebreakTarget"), configuration.padel.matchTieBreakPoints],
    );
  }
  if (sport === "table_tennis" && configuration.tableTennis) {
    rows.push([
      t("tableTennisFormatTitle"),
      bestOfLabel(configuration.tableTennis.bestOf),
    ]);
  }
  if (sport === "squash" && configuration.squash) {
    rows.push([
      t("squashFormatTitle"),
      bestOfLabel(configuration.squash.bestOf),
    ]);
  }

  return (
    <dl className={styles.rulesSummary}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CommunityConfigurationFields({
  sport,
  configuration,
  updateRules,
  updateTennis,
  updatePadel,
  updateTableTennis,
  updateSquash,
  t,
}: {
  sport: Sport;
  configuration: CommunityRuleConfiguration;
  updateRules: <Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) => void;
  updateTennis: <Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) => void;
  updatePadel: <Key extends keyof PadelRules>(
    key: Key,
    value: PadelRules[Key],
  ) => void;
  updateTableTennis: <Key extends keyof TableTennisRules>(
    key: Key,
    value: TableTennisRules[Key],
  ) => void;
  updateSquash: <Key extends keyof SquashRules>(
    key: Key,
    value: SquashRules[Key],
  ) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const rules = configuration.scoring;
  const [numberDrafts, setNumberDrafts] = useState({
    pointsToWin: String(rules.pointsToWin),
    winBy: String(rules.winBy),
    maxPoints: rules.maxPoints === null ? "" : String(rules.maxPoints),
  });

  useEffect(() => {
    setNumberDrafts({
      pointsToWin: String(rules.pointsToWin),
      winBy: String(rules.winBy),
      maxPoints: rules.maxPoints === null ? "" : String(rules.maxPoints),
    });
  }, [rules.maxPoints, rules.pointsToWin, rules.winBy]);

  function updateNumberDraft(
    field: "pointsToWin" | "winBy" | "maxPoints",
    value: string,
  ) {
    if (!/^\d*$/.test(value)) return;
    const normalized = normalizeIntegerInput(value);
    setNumberDrafts((current) => ({ ...current, [field]: normalized }));

    if (normalized === "") {
      if (field === "maxPoints") updateRules("maxPoints", null);
      return;
    }

    const numericValue = Number(normalized);
    if (Number.isInteger(numericValue)) updateRules(field, numericValue);
  }

  function commitNumberDraft(field: "pointsToWin" | "winBy" | "maxPoints") {
    const rawValue = numberDrafts[field];
    if (field === "maxPoints" && rawValue === "") {
      updateRules("maxPoints", null);
      return;
    }

    if (rawValue === "") {
      setNumberDrafts((current) => ({
        ...current,
        [field]: String(rules[field]),
      }));
      return;
    }

    const numericValue = Number(rawValue);
    if (Number.isInteger(numericValue)) updateRules(field, numericValue);
  }

  return (
    <div className={styles.communityScoringFields}>
      <Label>
        <span>{t("pointsToWin")}</span>
        <Input
          name="community-points-to-win"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={numberDrafts.pointsToWin}
          onChange={(event) =>
            updateNumberDraft("pointsToWin", event.target.value)
          }
          onBlur={() => commitNumberDraft("pointsToWin")}
          required
        />
      </Label>
      <Label>
        <span>{t("winBy")}</span>
        <Input
          name="community-win-by"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={numberDrafts.winBy}
          onChange={(event) => updateNumberDraft("winBy", event.target.value)}
          onBlur={() => commitNumberDraft("winBy")}
          required
        />
      </Label>
      <Label>
        <span>{t("maxPoints")}</span>
        <Input
          name="community-max-points"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={numberDrafts.maxPoints}
          onChange={(event) =>
            updateNumberDraft("maxPoints", event.target.value)
          }
          onBlur={() => commitNumberDraft("maxPoints")}
        />
      </Label>
      <Label>
        <span>{t("bestOf")}</span>
        <SelectControl
          name="community-best-of"
          value={rules.bestOf}
          onChange={(event) =>
            updateRules("bestOf", Number(event.target.value) as 1 | 3 | 5)
          }
        >
          <option value="1">{t("bestOfOne")}</option>
          <option value="3">{t("bestOfThree")}</option>
          <option value="5">{t("bestOfFive")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("scoringMode")}</span>
        <SelectControl
          name="community-scoring-mode"
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
        </SelectControl>
      </Label>
      {rules.scoringMode === "side_out" ? (
        <>
          <Label>
            <span>{t("serversPerTurn")}</span>
            <SelectControl
              name="community-servers-per-turn"
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
            </SelectControl>
          </Label>
          <Label>
            <span>{t("openingServerNumber")}</span>
            <SelectControl
              name="community-opening-server-number"
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
            </SelectControl>
          </Label>
        </>
      ) : null}
      {sport === "tennis" && configuration.tennis ? (
        <TennisConfigurationFields
          rules={configuration.tennis}
          update={updateTennis}
          t={t}
        />
      ) : null}
      {sport === "padel" && configuration.padel ? (
        <PadelConfigurationFields
          rules={configuration.padel}
          update={updatePadel}
          t={t}
        />
      ) : null}
      {sport === "table_tennis" && configuration.tableTennis ? (
        <TableTennisConfigurationFields
          rules={configuration.tableTennis}
          update={updateTableTennis}
          t={t}
        />
      ) : null}
      {sport === "squash" && configuration.squash ? (
        <SquashConfigurationFields
          rules={configuration.squash}
          update={updateSquash}
          t={t}
        />
      ) : null}
    </div>
  );
}

function TennisConfigurationFields({
  rules,
  update,
  t,
}: {
  rules: TennisRules;
  update: <Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <>
      <Label>
        <span>{t("tennisGameScoring")}</span>
        <SelectControl
          value={rules.gameScoring}
          onChange={(event) =>
            update(
              "gameScoring",
              event.target.value as TennisRules["gameScoring"],
            )
          }
        >
          <option value="advantage">{t("tennisAdvantage")}</option>
          <option value="no_ad">{t("tennisNoAd")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("tennisSetScoring")}</span>
        <SelectControl
          value={rules.setScoring}
          onChange={(event) =>
            update(
              "setScoring",
              event.target.value as TennisRules["setScoring"],
            )
          }
        >
          <option value="tiebreak">{t("tennisTiebreakSet")}</option>
          <option value="advantage">{t("tennisAdvantageSet")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("tennisFinalSet")}</span>
        <SelectControl
          value={rules.finalSetScoring}
          onChange={(event) =>
            update(
              "finalSetScoring",
              event.target.value as TennisRules["finalSetScoring"],
            )
          }
        >
          <option value="tiebreak">{t("tennisTiebreakSet")}</option>
          <option value="advantage">{t("tennisAdvantageSet")}</option>
          <option value="match_tiebreak">{t("tennisMatchTiebreak")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("tennisMatchTiebreakTarget")}</span>
        <SelectControl
          value={rules.matchTieBreakPoints}
          onChange={(event) =>
            update("matchTieBreakPoints", Number(event.target.value) as 7 | 10)
          }
        >
          <option value="7">7</option>
          <option value="10">10</option>
        </SelectControl>
      </Label>
    </>
  );
}

function PadelConfigurationFields({
  rules,
  update,
  t,
}: {
  rules: PadelRules;
  update: <Key extends keyof PadelRules>(
    key: Key,
    value: PadelRules[Key],
  ) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <>
      <Label>
        <span>{t("padelGameScoring")}</span>
        <SelectControl
          value={rules.gameScoring}
          onChange={(event) =>
            update(
              "gameScoring",
              event.target.value as PadelRules["gameScoring"],
            )
          }
        >
          <option value="advantage">{t("padelAdvantage")}</option>
          <option value="star_point">{t("padelStarPoint")}</option>
          <option value="golden_point">{t("padelGoldenPoint")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("padelSetScoring")}</span>
        <SelectControl
          value={rules.setScoring}
          onChange={(event) =>
            update("setScoring", event.target.value as PadelRules["setScoring"])
          }
        >
          <option value="standard">{t("padelStandardSet")}</option>
          <option value="mini">{t("padelMiniSet")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("padelFinalSet")}</span>
        <SelectControl
          value={rules.finalSetScoring}
          onChange={(event) =>
            update(
              "finalSetScoring",
              event.target.value as PadelRules["finalSetScoring"],
            )
          }
        >
          <option value="standard">{t("padelStandardSet")}</option>
          <option value="advantage">{t("padelAdvantageSet")}</option>
          <option value="match_tiebreak">{t("padelMatchTiebreak")}</option>
        </SelectControl>
      </Label>
      <Label>
        <span>{t("padelMatchTiebreakTarget")}</span>
        <SelectControl
          value={rules.matchTieBreakPoints}
          onChange={(event) =>
            update("matchTieBreakPoints", Number(event.target.value) as 7 | 10)
          }
        >
          <option value="7">7</option>
          <option value="10">10</option>
        </SelectControl>
      </Label>
    </>
  );
}

function TableTennisConfigurationFields({
  rules,
  update,
  t,
}: {
  rules: TableTennisRules;
  update: <Key extends keyof TableTennisRules>(
    key: Key,
    value: TableTennisRules[Key],
  ) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <Label>
      <span>{t("bestOf")}</span>
      <SelectControl
        value={rules.bestOf}
        onChange={(event) =>
          update("bestOf", Number(event.target.value) as 3 | 5)
        }
      >
        <option value="3">{t("bestOfThree")}</option>
        <option value="5">{t("bestOfFive")}</option>
      </SelectControl>
    </Label>
  );
}

function SquashConfigurationFields({
  rules,
  update,
  t,
}: {
  rules: SquashRules;
  update: <Key extends keyof SquashRules>(
    key: Key,
    value: SquashRules[Key],
  ) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <Label>
      <span>{t("bestOf")}</span>
      <SelectControl
        value={rules.bestOf}
        onChange={(event) =>
          update("bestOf", Number(event.target.value) as 3 | 5)
        }
      >
        <option value="3">{t("bestOfThree")}</option>
        <option value="5">{t("bestOfFive")}</option>
      </SelectControl>
    </Label>
  );
}
