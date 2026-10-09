import { useCallback, useEffect, useState } from "react";

export type MatchControlStatus = "waiting" | "active" | "error";

export function useMatchControl(matchId: string | undefined) {
  const [status, setStatus] = useState<MatchControlStatus>(() =>
    typeof navigator !== "undefined" && navigator.locks ? "waiting" : "active",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!matchId || !navigator.locks) {
      setStatus("active");
      return;
    }

    let active = true;
    let releaseLock: () => void = () => undefined;
    const controller = new AbortController();
    const holdLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    setStatus("waiting");

    try {
      void navigator.locks
        .request(
          `skor-lapangan:match:${matchId}`,
          { mode: "exclusive", signal: controller.signal },
          () => {
            if (!active) return;
            setStatus("active");
            return holdLock;
          },
        )
        .catch((error: unknown) => {
          if (
            !active ||
            (error as { name?: string } | null)?.name === "AbortError"
          ) {
            return;
          }
          setStatus("error");
        });
    } catch {
      setStatus("error");
    }

    return () => {
      active = false;
      controller.abort();
      releaseLock();
    };
  }, [attempt, matchId]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { status, canControl: status === "active", retry };
}
