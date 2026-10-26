import { Button } from "@/components/ui/button";
import { fillMessage, useLocale } from "../lib/i18n";
import type { AuthProviderId } from "../lib/runtime-config";

interface AuthProviderButtonsProps {
  action?: string | null;
  className?: string;
  disabled?: boolean;
  fallbackSignIn: () => Promise<string | null>;
  labelMode?: "signIn" | "saveHistory";
  providers?: readonly AuthProviderId[];
  signInWithProvider?: (provider: AuthProviderId) => Promise<string | null>;
}

function providerName(provider: AuthProviderId): string {
  return provider === "github"
    ? "GitHub"
    : provider === "apple"
      ? "Apple"
      : "Google";
}

export function AuthProviderButtons({
  action,
  className = "flex flex-wrap gap-2",
  disabled = false,
  fallbackSignIn,
  labelMode = "signIn",
  providers,
  signInWithProvider,
}: AuthProviderButtonsProps) {
  const { t } = useLocale();
  const providerOptions: readonly AuthProviderId[] = providers ?? ["google"];
  const busy = action === "oauth" || action === "claiming";

  return (
    <div className={className}>
      {providerOptions.map((provider) => (
        <Button
          key={provider}
          type="button"
          className="min-h-11"
          disabled={disabled || busy}
          onClick={() =>
            void (typeof signInWithProvider === "function"
              ? signInWithProvider(provider)
              : fallbackSignIn())
          }
        >
          {busy
            ? t("working")
            : labelMode === "saveHistory"
              ? t("saveHistory")
              : provider === "google"
                ? t("signInWithGoogle")
                : fillMessage(t("signInWithProvider"), {
                    provider: providerName(provider),
                  })}
        </Button>
      ))}
    </div>
  );
}
