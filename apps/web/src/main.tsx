import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { LocaleProvider } from "./lib/i18n";
import { sanitizeAnalyticsEvent } from "./lib/analytics";
import { analyticsEnabled } from "./lib/runtime-config";
import { initializeTheme, ThemeProvider } from "./lib/theme";
import "./styles/global.css";

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <BrowserRouter>
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </BrowserRouter>
      {analyticsEnabled ? (
        <Analytics beforeSend={sanitizeAnalyticsEvent} />
      ) : null}
    </>
  </StrictMode>,
);
