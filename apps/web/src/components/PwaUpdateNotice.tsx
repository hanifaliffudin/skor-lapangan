import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
import { Button } from "@/components/ui/button";
import {
  applyPwaUpdate,
  isPwaUpdateAvailable,
  subscribeToPwaUpdate,
} from "../lib/pwa";

export function PwaUpdateNotice() {
  const { t } = useLocale();
  const [updateAvailable, setUpdateAvailable] = useState(isPwaUpdateAvailable);
  const [updating, setUpdating] = useState(false);
  const [deferred, setDeferred] = useState(false);

  useEffect(() => subscribeToPwaUpdate(() => setUpdateAvailable(true)), []);

  if (!updateAvailable) return null;

  return (
    <aside
      className="mb-[26px] flex items-center justify-between gap-3 border border-line-strong bg-surface p-3 max-[560px]:flex-col max-[560px]:items-stretch"
      aria-live="polite"
    >
      <p
        className="m-0 text-sm leading-[1.45] text-ink"
        role={deferred ? "status" : undefined}
      >
        {deferred ? t("pwaUpdateDeferred") : t("pwaUpdateReady")}
      </p>
      <Button
        className="h-11 shrink-0 border border-line-strong bg-lime px-[14px] font-extrabold text-ink hover:bg-[#84d84c] max-[560px]:w-full"
        type="button"
        disabled={updating}
        onClick={async () => {
          setUpdating(true);
          setDeferred(false);
          const result = await applyPwaUpdate();
          setUpdating(false);
          setDeferred(result === "deferred");
        }}
      >
        {updating ? t("working") : t("pwaUpdateButton")}
      </Button>
    </aside>
  );
}
