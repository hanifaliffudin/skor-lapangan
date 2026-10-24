import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { authReturnPathKey, useAuth } from "./lib/auth";
import { localeFromPath, useLocale } from "./lib/i18n";
import { syncPendingMatches } from "./lib/sync";

const HomePage = lazy(() =>
  import("./features/setup/HomePage").then(({ HomePage: page }) => ({
    default: page,
  })),
);
const SetupPage = lazy(() =>
  import("./features/setup/SetupPage").then(({ SetupPage: page }) => ({
    default: page,
  })),
);
const MatchPage = lazy(() =>
  import("./features/match/MatchPage").then(({ MatchPage: page }) => ({
    default: page,
  })),
);
const ViewerPage = lazy(() =>
  import("./features/match/ViewerPage").then(({ ViewerPage: page }) => ({
    default: page,
  })),
);
const DisplayModePage = lazy(() =>
  import("./features/match/ViewerPage").then(({ DisplayModePage: page }) => ({
    default: page,
  })),
);
const AccountPage = lazy(() =>
  import("./features/account/AccountPage").then(({ AccountPage: page }) => ({
    default: page,
  })),
);
const MatchHistoryPage = lazy(() =>
  import("./features/history/MatchHistoryPage").then(
    ({ MatchHistoryPage: page }) => ({ default: page }),
  ),
);
const ClubSessionsPage = lazy(() =>
  import("./features/club-sessions/ClubSessionsPage").then(
    ({ ClubSessionsPage: page }) => ({ default: page }),
  ),
);
const CommunityRulesDirectoryPage = lazy(() =>
  import("./features/rules/CommunityRulesPage").then(
    ({ CommunityRulesDirectoryPage: page }) => ({ default: page }),
  ),
);
const CommunityRuleDetailPage = lazy(() =>
  import("./features/rules/CommunityRulesPage").then(
    ({ CommunityRuleDetailPage: page }) => ({ default: page }),
  ),
);
const CommunityRuleEditorPage = lazy(() =>
  import("./features/rules/CommunityRulesPage").then(
    ({ CommunityRuleEditorPage: page }) => ({ default: page }),
  ),
);

function RouteLoading() {
  const { t } = useLocale();
  return (
    <div
      className="grid min-h-screen min-h-dvh place-items-center bg-paper px-6 text-sm font-semibold text-text-muted"
      role="status"
      aria-live="polite"
    >
      {t("loading")}
    </div>
  );
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLocale } = useLocale();
  const { isAnonymous, user } = useAuth();

  useLayoutEffect(() => {
    setLocale(localeFromPath(location.pathname));
  }, [location.pathname, setLocale]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!user || isAnonymous) return;
    const returnPath = window.sessionStorage.getItem(authReturnPathKey);
    if (
      !returnPath ||
      !returnPath.startsWith("/") ||
      returnPath.startsWith("//")
    ) {
      return;
    }
    window.sessionStorage.removeItem(authReturnPathKey);
    const currentPath = `${location.pathname}${location.search}`;
    if (returnPath !== currentPath) navigate(returnPath, { replace: true });
  }, [isAnonymous, location.pathname, location.search, navigate, user]);

  useEffect(() => {
    if (!user) return;

    const retryPendingMatches = () => {
      void syncPendingMatches(user.id, isAnonymous).catch(() => undefined);
    };

    retryPendingMatches();
    window.addEventListener("online", retryPendingMatches);
    return () => window.removeEventListener("online", retryPendingMatches);
  }, [isAnonymous, user?.id]);

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/id/" element={<HomePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/id/setup" element={<SetupPage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="/id/match/:matchId" element={<MatchPage />} />
        <Route path="/view/:token" element={<ViewerPage />} />
        <Route path="/id/view/:token" element={<ViewerPage />} />
        <Route path="/display/:token" element={<DisplayModePage />} />
        <Route path="/id/display/:token" element={<DisplayModePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/id/account" element={<AccountPage />} />
        <Route path="/history" element={<MatchHistoryPage />} />
        <Route path="/id/history" element={<MatchHistoryPage />} />
        <Route path="/sessions" element={<ClubSessionsPage />} />
        <Route path="/id/sessions" element={<ClubSessionsPage />} />
        <Route path="/sessions/:sessionId" element={<ClubSessionsPage />} />
        <Route path="/id/sessions/:sessionId" element={<ClubSessionsPage />} />
        <Route path="/rules" element={<CommunityRulesDirectoryPage />} />
        <Route path="/id/rules" element={<CommunityRulesDirectoryPage />} />
        <Route path="/rules/new" element={<CommunityRuleEditorPage />} />
        <Route path="/id/rules/new" element={<CommunityRuleEditorPage />} />
        <Route
          path="/rules/:ruleId/edit"
          element={<CommunityRuleEditorPage />}
        />
        <Route
          path="/id/rules/:ruleId/edit"
          element={<CommunityRuleEditorPage />}
        />
        <Route path="/rules/:ruleId" element={<CommunityRuleDetailPage />} />
        <Route path="/id/rules/:ruleId" element={<CommunityRuleDetailPage />} />
        <Route path="/id/*" element={<Navigate to="/id/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
