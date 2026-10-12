import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
import {
  applyPwaUpdate,
  isPwaUpdateAvailable,
  subscribeToPwaUpdate,
} from "../lib/pwa";
import styles from "../styles/App.module.css";

export function PwaUpdateNotice() {
  const { t } = useLocale();
  const [updateAvailable, setUpdateAvailable] = useState(
    isPwaUpdateAvailable,
  );
  const [updating, setUpdating] = useState(false);

  useEffect(
    () => subscribeToPwaUpdate(() => setUpdateAvailable(true)),
    [],
  );

  if (!updateAvailable) return null;

  return (
    <aside className={styles.pwaUpdateNotice} aria-live="polite">
      <p>{t("pwaUpdateReady")}</p>
      <button
        className={styles.pwaUpdateButton}
        type="button"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          void applyPwaUpdate();
        }}
      >
        {updating ? t("working") : t("pwaUpdateButton")}
      </button>
    </aside>
  );
}
