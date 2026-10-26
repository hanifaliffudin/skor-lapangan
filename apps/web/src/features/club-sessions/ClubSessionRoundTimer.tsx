import { useEffect, useMemo, useState } from "react";
import { fillMessage, useLocale } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import {
  clubSessionPlayProfileForSport,
  type ClubSessionSport,
} from "./clubSessionManagement";
import {
  clubSessionRoundRemainingMs,
  formatClubSessionCountdown,
} from "./clubSessionRoundTimerUtils";

interface ClubSessionRoundTimerProps {
  enabled: boolean;
  matchId: string;
  sessionId: string;
}

export function ClubSessionRoundTimer({
  enabled,
  matchId,
  sessionId,
}: ClubSessionRoundTimerProps) {
  const { t } = useLocale();
  const [round, setRound] = useState<{
    startedAt: string;
    roundMinutes: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setRound(null);
    if (!enabled || !supabase) {
      return;
    }

    let active = true;
    void (async () => {
      const { data: assignment } = await supabase
        .from("club_session_matches")
        .select("started_at")
        .eq("match_id", matchId)
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!active || !assignment?.started_at) return;

      const { data: session } = await supabase
        .from("club_sessions")
        .select("sport")
        .eq("id", sessionId)
        .maybeSingle();
      if (!active || !session) return;

      const profile = clubSessionPlayProfileForSport(
        session.sport as ClubSessionSport,
      );
      if (profile.rotationUnit !== "minutes" || !profile.roundMinutes) {
        setRound(null);
        return;
      }
      setRound({
        startedAt: assignment.started_at,
        roundMinutes: profile.roundMinutes,
      });
    })();

    return () => {
      active = false;
    };
  }, [enabled, matchId, sessionId]);

  useEffect(() => {
    if (!round) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [round]);

  const remainingMs = useMemo(
    () =>
      round
        ? clubSessionRoundRemainingMs(round.startedAt, round.roundMinutes, now)
        : null,
    [now, round],
  );
  if (remainingMs === null) return null;

  const expired = remainingMs === 0;
  const label = fillMessage(t("clubSessionRoundTimer"), {
    minutes: round?.roundMinutes ?? 0,
  });

  return (
    <div
      className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm ${
        expired ? "border-2 border-orange-700" : "border border-cobalt"
      }`}
      role="timer"
      aria-label={`${label}: ${formatClubSessionCountdown(remainingMs)}`}
    >
      <span className="font-semibold text-text-muted">{label}</span>
      <strong className="font-black tabular-nums text-ink">
        {formatClubSessionCountdown(remainingMs)}
      </strong>
      <span className="font-semibold text-text-muted">
        {t(expired ? "clubSessionRoundExpired" : "clubSessionRoundRemaining")}
      </span>
    </div>
  );
}
