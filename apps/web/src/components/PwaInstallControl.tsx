import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
import { Button } from "@/components/ui/button";
import styles from "../styles/App.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    (window.matchMedia?.("(display-mode: standalone)").matches ?? false) ||
    navigatorWithStandalone.standalone === true
  );
}

function isIosDevice(): boolean {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const installSnoozeKey = "skor-lapangan:install-snoozed-until";
const installSnoozeDuration = 7 * 24 * 60 * 60 * 1000;

function isInstallSnoozed(): boolean {
  const snoozedUntil = Number(
    window.localStorage.getItem(installSnoozeKey) ?? "0",
  );
  return Number.isFinite(snoozedUntil) && snoozedUntil > Date.now();
}

function snoozeInstallPrompt(): void {
  window.localStorage.setItem(
    installSnoozeKey,
    String(Date.now() + installSnoozeDuration),
  );
}

export function PwaInstallControl({
  hasUserEngaged,
}: {
  hasUserEngaged: boolean;
}) {
  const { t } = useLocale();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [snoozed, setSnoozed] = useState(isInstallSnoozed);
  const ios = isIosDevice();

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstalled(choice.outcome === "accepted");
      if (choice.outcome === "dismissed") {
        snoozeInstallPrompt();
        setSnoozed(true);
      }
    } catch {
      setInstallPrompt(null);
    }
    setInstallPrompt(null);
  }

  function dismiss() {
    snoozeInstallPrompt();
    setSnoozed(true);
  }

  if (installed || snoozed || !hasUserEngaged || (!installPrompt && !ios)) {
    return null;
  }

  return (
    <aside
      className={styles.installControl}
      aria-labelledby="install-app-title"
    >
      <h2 id="install-app-title" className={styles.installPromptTitle}>
        {t("installPromptTitle")}
      </h2>
      <p className={styles.installPromptBody}>{t("installPromptBody")}</p>

      {installPrompt ? (
        <div className={styles.installPromptActions}>
          <Button
            className={styles.installButton}
            type="button"
            onClick={() => void install()}
          >
            {t("installApp")}
          </Button>
          <Button
            variant="outline"
            className={styles.installLaterButton}
            type="button"
            onClick={dismiss}
          >
            {t("installLater")}
          </Button>
        </div>
      ) : null}

      {ios ? (
        <details className={styles.installInstructions}>
          <summary>{t("installToHomeScreen")}</summary>
          <p>{t("installOnIosInstructions")}</p>
        </details>
      ) : null}

      {!installPrompt ? (
        <Button
          variant="outline"
          className={styles.installLaterButton}
          type="button"
          onClick={dismiss}
        >
          {t("installLater")}
        </Button>
      ) : null}
    </aside>
  );
}
