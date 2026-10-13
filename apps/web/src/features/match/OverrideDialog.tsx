import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MatchState } from "@skor-lapangan/scoring-core";
import { useLocale } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "../../styles/App.module.css";

export function OverrideDialog({
  open,
  onOpenChange,
  state,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: MatchState;
  onSave: (points: { A: number; B: number }) => void;
}) {
  const { t } = useLocale();
  const [scoreA, setScoreA] = useState(String(state.points.A));
  const [scoreB, setScoreB] = useState(String(state.points.B));
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setScoreA(String(state.points.A));
    setScoreB(String(state.points.B));
    window.requestAnimationFrame(() => firstInput.current?.select());
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const A = Number(scoreA);
    const B = Number(scoreB);
    if (!Number.isInteger(A) || !Number.isInteger(B) || A < 0 || B < 0) return;
    onSave({ A, B });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <form className={styles.dialogBody} onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("correction")}</DialogTitle>
            <DialogDescription>{t("correctionHint")}</DialogDescription>
          </DialogHeader>
          <div className={styles.overrideFields}>
            <Label>
              <span>{t("teamA")}</span>
              <Input
                name="score-team-a"
                ref={firstInput}
                type="number"
                min="0"
                inputMode="numeric"
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
                required
              />
            </Label>
            <Label>
              <span>{t("teamB")}</span>
              <Input
                name="score-team-b"
                type="number"
                min="0"
                inputMode="numeric"
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
                required
              />
            </Label>
          </div>
          <DialogFooter className={styles.dialogActions}>
            <Button
              variant="outline"
              className={styles.secondaryButton}
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button className={styles.primaryButton} type="submit">
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
