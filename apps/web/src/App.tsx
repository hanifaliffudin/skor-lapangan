import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./features/setup/HomePage";
import { SetupPage } from "./features/setup/SetupPage";
import { MatchPage } from "./features/match/MatchPage";

export function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/match/:matchId" element={<MatchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
