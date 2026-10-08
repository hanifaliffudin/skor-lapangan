import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import type { MatchState } from "@skor-lapangan/scoring-core";
import { useLocale } from "../../lib/i18n";
import styles from "../../styles/App.module.css";

export function OverrideDialog({
  dialogRef,
  state,
  onSave,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  state: MatchState;
  onSave: (points: { A: number; B: number }) => void;
}) {
  const { t } = useLocale();
  const [scoreA, setScoreA] = useState(String(state.points.A));
  const [scoreB, setScoreB] = useState(String(state.points.B));
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const sync = () => {
      setScoreA(String(state.points.A));
      setScoreB(String(state.points.B));
      window.requestAnimationFrame(() => firstInput.current?.select());
    };
    dialog.addEventListener("toggle", sync);
    return () => dialog.removeEventListener("toggle", sync);
  }, [dialogRef, state.points.A, state.points.B]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const A = Number(scoreA);
    const B = Number(scoreB);
    if (!Number.isInteger(A) || !Number.isInteger(B) || A < 0 || B < 0) return;
    onSave({ A, B });
    dialogRef.current?.close();
  }

  return (
    <dialog className={styles.dialog} ref={dialogRef}>
      <form className={styles.dialogBody} onSubmit={submit}>
        <h2>{t("correction")}</h2>
        <p>{t("correctionHint")}</p>
        <div className={styles.overrideFields}>
          <label>
            <span>{t("teamA")}</span>
            <input
              ref={firstInput}
              type="number"
              min="0"
              inputMode="numeric"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
              required
            />
          </label>
          <label>
            <span>{t("teamB")}</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
              required
            />
          </label>
        </div>
        <div className={styles.dialogActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            {t("cancel")}
          </button>
          <button className={styles.primaryButton} type="submit">
            {t("save")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
