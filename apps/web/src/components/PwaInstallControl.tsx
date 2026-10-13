import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
import { Button } from "@/components/ui/button";

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
      <div className="mt-[14px]">
        <Button
          className="h-12 w-full border border-line-strong bg-surface px-[14px] font-extrabold text-ink hover:bg-[#eef0f2]"
          type="button"
          onClick={() => void install()}
        >
          {t("installApp")}
        </Button>
      </div>
    );
  }

  if (!ios) return null;

  return (
    <details className="mt-3 border-t border-line text-left [&>summary]:flex [&>summary]:min-h-11 [&>summary]:items-center [&>summary]:text-sm [&>summary]:font-extrabold [&>summary]:text-cobalt-dark">
      <summary>{t("installToHomeScreen")}</summary>
      <p className="m-0 px-0 pt-0 pb-3 text-[13px] leading-[1.5] text-text-muted">
        {t("installOnIosInstructions")}
      </p>
    </details>
  );
}
