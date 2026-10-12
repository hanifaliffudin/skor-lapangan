import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
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

export function PwaInstallControl() {
  const { t } = useLocale();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
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
    } catch {
      setInstallPrompt(null);
    }
    setInstallPrompt(null);
  }

  if (installed) return null;

  if (installPrompt) {
    return (
      <div className={styles.installControl}>
        <button
          className={styles.installButton}
          type="button"
          onClick={() => void install()}
        >
          {t("installApp")}
        </button>
      </div>
    );
  }

  if (!ios) return null;

  return (
    <details className={styles.installInstructions}>
      <summary>{t("installToHomeScreen")}</summary>
      <p>{t("installOnIosInstructions")}</p>
    </details>
  );
}
