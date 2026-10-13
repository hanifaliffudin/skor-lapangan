import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { localeFromPath, useLocale } from "./lib/i18n";

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

function RouteLoading() {
  const { t } = useLocale();
  return (
    <div
      className="grid min-h-screen min-h-dvh place-items-center bg-paper px-6 text-sm font-semibold text-muted"
      role="status"
      aria-live="polite"
    >
      {t("loading")}
    </div>
  );
}

export function App() {
  const location = useLocation();
  const { setLocale } = useLocale();

  useLayoutEffect(() => {
    setLocale(localeFromPath(location.pathname));
  }, [location.pathname, setLocale]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

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
        <Route path="/id/*" element={<Navigate to="/id/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
