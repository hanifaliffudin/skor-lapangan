import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./features/setup/HomePage";
import { SetupPage } from "./features/setup/SetupPage";
import { MatchPage } from "./features/match/MatchPage";
import { ViewerPage } from "./features/match/ViewerPage";
import {
  CommunityRuleDetailPage,
  CommunityRuleEditorPage,
  CommunityRulesDirectoryPage,
} from "./features/rules/CommunityRulesPage";
import { MatchHistoryPage } from "./features/history/MatchHistoryPage";

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
      <Route path="/view/:token" element={<ViewerPage />} />
      <Route path="/rules" element={<CommunityRulesDirectoryPage />} />
      <Route path="/rules/new" element={<CommunityRuleEditorPage />} />
      <Route path="/rules/:ruleId/edit" element={<CommunityRuleEditorPage />} />
      <Route path="/rules/:ruleId" element={<CommunityRuleDetailPage />} />
      <Route path="/history" element={<MatchHistoryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
