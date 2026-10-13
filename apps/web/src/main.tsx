import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import { LocaleProvider } from "./lib/i18n";
import { sanitizeAnalyticsEvent } from "./lib/analytics";
import "./styles/global.css";

const AuthProvider = lazy(() =>
  import("./lib/auth").then(({ AuthProvider: provider }) => ({
    default: provider,
  })),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <Suspense
        fallback={
          <div
            className="grid min-h-screen min-h-dvh place-items-center bg-paper px-6 text-sm font-semibold text-text-muted"
            role="status"
            aria-live="polite"
          >
            Loading…
          </div>
        }
      >
        <BrowserRouter>
          <LocaleProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </LocaleProvider>
        </BrowserRouter>
      </Suspense>
      <Analytics beforeSend={sanitizeAnalyticsEvent} />
    </>
  </StrictMode>,
);
