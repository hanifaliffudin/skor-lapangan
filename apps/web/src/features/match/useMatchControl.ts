import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireMatchControl,
  releaseMatchControl,
  renewMatchControl,
} from "../../lib/sync";
import { supabase } from "../../lib/supabase";

export type MatchControlStatus =
  "disabled" | "waiting" | "active" | "held" | "lost" | "error";

interface MatchControlOptions {
  enabled?: boolean;
  server?: boolean;
}

function createControlToken(): string {
  return crypto.randomUUID();
}

export function useMatchControl(
  matchId: string | undefined,
  options: MatchControlOptions = {},
) {
  const enabled = options.enabled ?? true;
  const serverEnabled = Boolean(options.server && supabase);
  const [localStatus, setLocalStatus] = useState<MatchControlStatus>(() =>
    !enabled
      ? "disabled"
      : typeof navigator !== "undefined" && navigator.locks
        ? "waiting"
        : "active",
  );
  const [serverStatus, setServerStatus] = useState<MatchControlStatus>(
    serverEnabled ? "waiting" : "active",
  );
  const [attempt, setAttempt] = useState(0);
  const controlToken = useRef<string>(createControlToken());

  useEffect(() => {
    if (!enabled) {
      setLocalStatus("disabled");
      return;
    }
    if (!matchId || !navigator.locks) {
      setLocalStatus("active");
      return;
    }

    let active = true;
    let releaseLock: () => void = () => undefined;
    const controller = new AbortController();
    const holdLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    setLocalStatus("waiting");

    try {
      void navigator.locks
        .request(
          `skor-lapangan:match:${matchId}`,
          { mode: "exclusive", signal: controller.signal },
          () => {
            if (!active) return;
            setLocalStatus("active");
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
          setLocalStatus("error");
        });
    } catch {
      setLocalStatus("error");
    }

    return () => {
      active = false;
      controller.abort();
      releaseLock();
    };
  }, [attempt, enabled, matchId]);

  useEffect(() => {
    if (!enabled) {
      setServerStatus("disabled");
    } else if (!serverEnabled) {
      setServerStatus("active");
    } else if (localStatus === "active") {
      setServerStatus("waiting");
    }
  }, [enabled, localStatus, serverEnabled]);

  useEffect(() => {
    if (!enabled || !serverEnabled || !matchId || localStatus !== "active") {
      if (!enabled) setServerStatus("disabled");
      return;
    }

    let active = true;
    setServerStatus("waiting");
    void acquireMatchControl(matchId, controlToken.current, false).then(
      (result) => {
        if (!active) return;
        setServerStatus(
          result === "acquired" || result === "not_found"
            ? "active"
            : result === "held"
              ? "held"
              : result === "complete"
                ? "disabled"
                : "error",
        );
      },
    );

    return () => {
      active = false;
    };
  }, [attempt, enabled, localStatus, matchId, serverEnabled]);

  useEffect(() => {
    if (
      !enabled ||
      !serverEnabled ||
      !matchId ||
      localStatus !== "active" ||
      serverStatus !== "active"
    ) {
      return;
    }

    const heartbeat = (blockUntilValidated = false) => {
      if (blockUntilValidated) setServerStatus("waiting");
      void renewMatchControl(matchId, controlToken.current).then((result) => {
        if (result === "lost" || result === "failed") setServerStatus("lost");
        if (result === "offline") setServerStatus("active");
      });
    };
    const intervalId = window.setInterval(heartbeat, 15_000);
    const handleOnline = () => heartbeat(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat(true);
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, localStatus, matchId, serverEnabled, serverStatus]);

  useEffect(() => {
    return () => {
      if (serverEnabled && matchId && controlToken.current) {
        void releaseMatchControl(matchId, controlToken.current);
      }
    };
  }, [matchId, serverEnabled]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const takeOver = useCallback(async () => {
    if (!matchId || !serverEnabled) return false;
    setServerStatus("waiting");
    const result = await acquireMatchControl(
      matchId,
      controlToken.current,
      true,
    );
    const acquired = result === "acquired";
    setServerStatus(
      acquired
        ? "active"
        : result === "held"
          ? "held"
          : result === "not_found"
            ? "active"
            : "error",
    );
    return acquired;
  }, [matchId, serverEnabled]);

  const status = !enabled
    ? "disabled"
    : localStatus !== "active"
      ? localStatus
      : serverEnabled
        ? serverStatus
        : "active";

  return {
    status,
    canControl: status === "active",
    controlToken: controlToken.current,
    retry,
    takeOver,
  };
}
