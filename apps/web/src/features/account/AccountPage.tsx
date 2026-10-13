import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import styles from "../../styles/App.module.css";

export function AccountPage() {
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const {
    action,
    authError,
    authErrorKind,
    deleteAccount,
    isAnonymous,
    loading,
    signInWithGoogle,
    signOut,
    user,
  } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    document.title = t("accountPageTitle");
  }, [t]);

  async function handleDeleteAccount() {
    setDeleteError("");
    const error = await deleteAccount();
    if (error) {
      setDeleteError(error);
      return;
    }
    setConfirmingDelete(false);
    navigate(localizedPath("/", locale), { replace: true });
  }

  async function handleSignOut() {
    const didSignOut = await signOut();
    if (didSignOut) navigate(localizedPath("/", locale), { replace: true });
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={`${styles.rulesMain} max-w-[720px]`}>
        <Link className={styles.textButton} to={localizedPath("/", locale)}>
          {t("backToHome")}
        </Link>
        <p className={styles.eyebrow}>{t("account")}</p>
        <h1 className={styles.historyTitle}>{t("accountTitle")}</h1>
        <p className={styles.historyIntro}>{t("accountIntro")}</p>

        {loading && !user ? (
          <p role="status">{t("loading")}</p>
        ) : !user || isAnonymous ? (
          <section className={styles.rulesEmpty}>
            <h2>{t("accountRequiresGoogle")}</h2>
            <p>{t("accountRequiresGoogleBody")}</p>
            <Button
              type="button"
              className="mt-4 min-h-11"
              disabled={loading || action === "google" || action === "claiming"}
              onClick={() => void signInWithGoogle()}
            >
              {action === "google" || action === "claiming"
                ? t("working")
                : t("signInWithGoogle")}
            </Button>
          </section>
        ) : (
          <div className="grid gap-4">
            <section className="grid gap-3 rounded-lg border border-line-strong bg-surface p-5">
              <p className="m-0 text-sm font-bold text-muted">
                {t("accountSignedInAs")}
              </p>
              <p className="m-0 break-words text-base font-extrabold text-ink">
                {user.email ?? t("account")}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  to={localizedPath("/history", locale)}
                >
                  {t("matchHistory")}
                </Link>
                <Button
                  variant="outline"
                  type="button"
                  disabled={loading || action === "deleting"}
                  onClick={() => void handleSignOut()}
                >
                  {action === "signing-out" ? t("signingOut") : t("signOut")}
                </Button>
              </div>
            </section>

            <section className="grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
              <h2 className="m-0 text-xl font-extrabold text-ink">
                {t("accountDeleteSection")}
              </h2>
              <p className="m-0 text-sm leading-6 text-muted">
                {t("accountDeleteWarning")}
              </p>
              <Button
                variant="destructive"
                type="button"
                className="min-h-11 justify-self-start"
                disabled={loading || action === "deleting"}
                onClick={() => {
                  setDeleteError("");
                  setConfirmingDelete(true);
                }}
              >
                {action === "deleting"
                  ? t("accountDeleteInProgress")
                  : t("accountDeleteButton")}
              </Button>
              {deleteError || (authErrorKind === "delete" && authError) ? (
                <p
                  className="m-0 text-sm font-semibold text-destructive"
                  role="alert"
                >
                  {t("accountDeleteError")} {deleteError || authError}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </main>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accountDeleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("accountDeleteConfirmBody")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              type="button"
              disabled={action === "deleting"}
              onClick={() => void handleDeleteAccount()}
            >
              {action === "deleting"
                ? t("accountDeleteInProgress")
                : t("accountDeleteConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
