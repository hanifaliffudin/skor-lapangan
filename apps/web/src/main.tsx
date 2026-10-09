import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import { LocaleProvider } from "./lib/i18n";
import { AuthProvider } from "./lib/auth";
import { sanitizeAnalyticsEvent } from "./lib/analytics";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <BrowserRouter>
        <LocaleProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </BrowserRouter>
      <Analytics beforeSend={sanitizeAnalyticsEvent} />
    </>
  </StrictMode>,
);
