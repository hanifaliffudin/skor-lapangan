import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLocale } from "../lib/i18n";
import styles from "../styles/App.module.css";

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const { loading, user, signOut } = useAuth();

  return (
    <header
      className={`${styles.header} ${compact ? styles.headerCompact : ""}`}
    >
      <Link className={styles.brand} to="/" aria-label={t("appName")}>
        <span className={styles.brandMark} aria-hidden="true">
          SL
        </span>
        <span>{t("appName")}</span>
      </Link>
      <div className={styles.headerControls}>
        {!loading && user ? (
          <div className={styles.accountMenu}>
            <span className={styles.accountEmail} title={user.email}>
              {user.email}
            </span>
            <button type="button" onClick={() => void signOut()}>
              {t("signOut")}
            </button>
          </div>
        ) : null}
        <div className={styles.languageSwitch} aria-label="Language">
          <button
            type="button"
            aria-pressed={locale === "id"}
            onClick={() => setLocale("id")}
          >
            ID
          </button>
          <button
            type="button"
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
