import { useEffect, useLayoutEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./features/setup/HomePage";
import { SetupPage } from "./features/setup/SetupPage";
import { MatchPage } from "./features/match/MatchPage";
import { ViewerPage } from "./features/match/ViewerPage";
import { localeFromPath, useLocale } from "./lib/i18n";

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
  );
}
