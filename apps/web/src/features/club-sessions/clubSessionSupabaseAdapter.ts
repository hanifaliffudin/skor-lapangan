import { supabase } from "../../lib/supabase";
import type {
  ClubSessionAdapter,
  ClubSessionDetail,
  ClubSessionMatchResult,
  ClubSessionStatus,
  ClubSessionSummary,
} from "./clubSessionManagement";

function requireAccount(userId: string | null): string {
  if (!supabase || !userId) throw new Error("CLUB_SESSION_BACKEND_UNAVAILABLE");
  return userId;
}

export function createClubSessionSupabaseAdapter(
  userId: string | null,
): ClubSessionAdapter {
  return {
    async listSessions() {
      const ownerId = requireAccount(userId);
      const { data, error } = await supabase!
        .from("club_sessions")
        .select("id,name,session_date,status,created_at")
        .eq("owner_id", ownerId)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClubSessionSummary[];
    },
    async loadSession(sessionId) {
      const ownerId = requireAccount(userId);
      const [sessionResult, playerResult, courtResult, queueResult] =
        await Promise.all([
          supabase!
            .from("club_sessions")
            .select("id,name,session_date,status,created_at")
            .eq("id", sessionId)
            .eq("owner_id", ownerId)
            .maybeSingle(),
          supabase!
            .from("club_session_players")
            .select("id,display_name,sort_order,is_active")
            .eq("session_id", sessionId)
            .eq("owner_id", ownerId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase!
            .from("club_session_courts")
            .select("id,name,sort_order,is_active")
            .eq("session_id", sessionId)
            .eq("owner_id", ownerId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase!
            .from("club_session_matches")
            .select(
              "id,match_id,linked_match_id,court_id,team_a_player_1,team_a_player_2,team_b_player_1,team_b_player_2,queue_order,started_at",
            )
            .eq("session_id", sessionId)
            .eq("owner_id", ownerId)
            .order("queue_order", { ascending: true })
            .order("created_at", { ascending: true }),
        ]);
      if (
        sessionResult.error ||
        playerResult.error ||
        courtResult.error ||
        queueResult.error ||
        !sessionResult.data
      ) {
        throw (
          sessionResult.error ??
          playerResult.error ??
          courtResult.error ??
          queueResult.error ??
          new Error("CLUB_SESSION_NOT_FOUND")
        );
      }
      const queue = queueResult.data ?? [];
      const linkedIds = queue
        .map((entry) => entry.linked_match_id)
        .filter((id): id is string => Boolean(id));
      let results: Record<string, ClubSessionMatchResult> = {};
      if (linkedIds.length) {
        const { data: matchRows, error: matchError } = await supabase!
          .from("matches")
          .select("id,status,winner")
          .in("id", linkedIds)
          .eq("owner_id", ownerId);
        if (matchError) throw matchError;
        results = Object.fromEntries(
          (matchRows ?? []).map((match) => [match.id, match]),
        );
      }
      return {
        session: sessionResult.data as ClubSessionSummary,
        players: playerResult.data ?? [],
        courts: courtResult.data ?? [],
        queue,
        results,
      } satisfies ClubSessionDetail;
    },
    async createSession(input) {
      const ownerId = requireAccount(userId);
      const { data, error } = await supabase!
        .from("club_sessions")
        .insert({
          owner_id: ownerId,
          name: input.name,
          session_date: input.sessionDate,
        })
        .select("id")
        .single();
      if (error || !data)
        throw error ?? new Error("CLUB_SESSION_CREATE_FAILED");
      return data;
    },
    async addPlayer(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!.from("club_session_players").insert({
        session_id: input.sessionId,
        owner_id: ownerId,
        display_name: input.displayName,
        sort_order: input.sortOrder,
      });
      if (error) throw error;
    },
    async addCourt(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!.from("club_session_courts").insert({
        session_id: input.sessionId,
        owner_id: ownerId,
        name: input.name,
        sort_order: input.sortOrder,
      });
      if (error) throw error;
    },
    async setPlayerActive(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!
        .from("club_session_players")
        .update({ is_active: input.isActive })
        .eq("id", input.playerId)
        .eq("session_id", input.sessionId)
        .eq("owner_id", ownerId);
      if (error) throw error;
    },
    async setCourtActive(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!
        .from("club_session_courts")
        .update({ is_active: input.isActive })
        .eq("id", input.courtId)
        .eq("session_id", input.sessionId)
        .eq("owner_id", ownerId);
      if (error) throw error;
    },
    async addQueuedMatch(input) {
      const ownerId = requireAccount(userId);
      const [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2] =
        input.playerIds;
      const { error } = await supabase!.from("club_session_matches").insert({
        session_id: input.sessionId,
        owner_id: ownerId,
        match_id: input.matchId,
        court_id: input.courtId,
        team_a_player_1: teamAPlayer1,
        team_a_player_2: teamAPlayer2,
        team_b_player_1: teamBPlayer1,
        team_b_player_2: teamBPlayer2,
        queue_order: input.queueOrder,
      });
      if (error) throw error;
    },
    async markMatchStarted(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!
        .from("club_session_matches")
        .update({ started_at: new Date().toISOString() })
        .eq("match_id", input.matchId)
        .eq("session_id", input.sessionId)
        .eq("owner_id", ownerId)
        .is("started_at", null);
      if (error) throw error;
    },
    async removeQueuedMatch(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!
        .from("club_session_matches")
        .delete()
        .eq("id", input.queueId)
        .eq("session_id", input.sessionId)
        .eq("owner_id", ownerId)
        .is("started_at", null);
      if (error) throw error;
    },
    async setStatus(input: { sessionId: string; status: ClubSessionStatus }) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!
        .from("club_sessions")
        .update({ status: input.status })
        .eq("id", input.sessionId)
        .eq("owner_id", ownerId);
      if (error) throw error;
    },
    async deleteSession(sessionId) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!
        .from("club_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("owner_id", ownerId);
      if (error) throw error;
    },
  };
}
