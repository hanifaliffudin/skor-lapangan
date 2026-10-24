import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireMatchControl,
  releaseMatchControl,
  renewMatchControl,
} from "../../lib/sync";
import { supabase } from "../../lib/supabase";
import {
  createTabControlIdentity,
  localControlLeaseMs,
  localControlStore,
} from "../../lib/localControl";

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
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [localStatus, setLocalStatus] = useState<MatchControlStatus>(() =>
    enabled ? "waiting" : "disabled",
  );
  const [serverStatus, setServerStatus] = useState<MatchControlStatus>(() =>
    serverEnabled && isOnline ? "waiting" : "active",
  );
  const [attempt, setAttempt] = useState(0);
  const controlToken = useRef<string>(createControlToken());
  const localOwnerId = useRef<string>(createTabControlIdentity());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (serverEnabled) setServerStatus("waiting");
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (serverEnabled) setServerStatus("active");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [serverEnabled]);

  useEffect(() => {
    if (!enabled) {
      setLocalStatus("disabled");
      return;
    }
    if (!matchId) {
      setLocalStatus("active");
      return;
    }

    if (!navigator.locks) {
      let active = true;
      let leaseHeld = false;
      let retryHandle: number | null = null;

      const claim = async () => {
        const result = await localControlStore.claim(
          matchId,
          localOwnerId.current,
        );
        if (!active) {
          if (result === "acquired") {
            void localControlStore.release(matchId, localOwnerId.current);
          }
          return;
        }
        leaseHeld = result === "acquired";
        setLocalStatus(
          result === "acquired"
            ? "active"
            : result === "held"
              ? "waiting"
              : "error",
        );
      };

      const renew = async () => {
        if (!leaseHeld) {
          await claim();
          return;
        }
        const renewed = await localControlStore.renew(
          matchId,
          localOwnerId.current,
        );
        if (!renewed && active) {
          leaseHeld = false;
          setLocalStatus("waiting");
          await claim();
        }
      };

      void claim();
      retryHandle = window.setInterval(
        () => void renew(),
        Math.max(1_000, Math.floor(localControlLeaseMs / 2)),
      );
      const handleStorage = (event: StorageEvent) => {
        if (event.key === `skor-lapangan:control:${matchId}`) {
          void claim();
        }
      };
      window.addEventListener("storage", handleStorage);

      return () => {
        active = false;
        if (retryHandle !== null) window.clearInterval(retryHandle);
        window.removeEventListener("storage", handleStorage);
        if (leaseHeld) {
          void localControlStore.release(matchId, localOwnerId.current);
        }
      };
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
    } else if (!serverEnabled || !isOnline) {
      setServerStatus("active");
    } else if (localStatus === "active") {
      setServerStatus("waiting");
    }
  }, [enabled, isOnline, localStatus, serverEnabled]);

  useEffect(() => {
    if (
      !enabled ||
      !serverEnabled ||
      !isOnline ||
      !matchId ||
      localStatus !== "active"
    ) {
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
  }, [attempt, enabled, isOnline, localStatus, matchId, serverEnabled]);

  useEffect(() => {
    if (
      !enabled ||
      !serverEnabled ||
      !isOnline ||
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, isOnline, localStatus, matchId, serverEnabled, serverStatus]);

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
