import { supabase } from "../../lib/supabase";
import type {
  ClubSessionAdapter,
  ClubSessionAvailability,
  ClubSessionDetail,
  ClubSessionGender,
  ClubSessionMatchResult,
  ClubSessionPairingMode,
  ClubSessionPlayProfileId,
  ClubSessionSport,
  ClubSessionStatus,
  ClubSessionSummary,
} from "./clubSessionManagement";

function requireAccount(userId: string | null): string {
  if (!supabase || !userId) throw new Error("CLUB_SESSION_BACKEND_UNAVAILABLE");
  return userId;
}

function assignmentColumns(playerIds: string[]): {
  team_a_player_1: string;
  team_a_player_2: string | null;
  team_b_player_1: string;
  team_b_player_2: string | null;
} {
  if (playerIds.length === 2) {
    return {
      team_a_player_1: playerIds[0]!,
      team_a_player_2: null,
      team_b_player_1: playerIds[1]!,
      team_b_player_2: null,
    };
  }
  return {
    team_a_player_1: playerIds[0]!,
    team_a_player_2: playerIds[1] ?? null,
    team_b_player_1: playerIds[2]!,
    team_b_player_2: playerIds[3] ?? null,
  };
}

export function createClubSessionSupabaseAdapter(
  userId: string | null,
): ClubSessionAdapter {
  return {
    async listSessions() {
      const ownerId = requireAccount(userId);
      const { data, error } = await supabase!
        .from("club_sessions")
        .select(
          "id,name,session_date,start_time,time_zone,location_name,sport,play_profile,status,pairing_mode,created_at,updated_at",
        )
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
            .select(
              "id,name,session_date,start_time,time_zone,location_name,sport,play_profile,status,pairing_mode,created_at,updated_at",
            )
            .eq("id", sessionId)
            .eq("owner_id", ownerId)
            .maybeSingle(),
          supabase!
            .from("club_session_players")
            .select(
              "id,display_name,sort_order,is_active,gender,skill_level,availability,avoid_player_ids",
            )
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
              "id,match_id,linked_match_id,court_id,team_a_player_1,team_a_player_2,team_b_player_1,team_b_player_2,queue_order,started_at,is_open_fallback",
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
        players: (playerResult.data ?? []) as ClubSessionDetail["players"],
        courts: courtResult.data ?? [],
        queue,
        results,
      } satisfies ClubSessionDetail;
    },
    async createSession(input: {
      name: string;
      sessionDate: string;
      startTime?: string;
      timeZone?: string;
      locationName?: string;
      sport: ClubSessionSport;
      playProfile: ClubSessionPlayProfileId;
      pairingMode?: ClubSessionPairingMode;
    }) {
      const ownerId = requireAccount(userId);
      const { data, error } = await supabase!
        .from("club_sessions")
        .insert({
          owner_id: ownerId,
          name: input.name,
          session_date: input.sessionDate,
          start_time: input.startTime || null,
          time_zone:
            input.timeZone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC",
          location_name: input.locationName?.trim() || null,
          sport: input.sport,
          play_profile: input.playProfile,
          format:
            input.playProfile.endsWith("_singles") ||
            input.playProfile === "table_tennis_singles_short"
              ? "singles"
              : "doubles",
          pairing_mode: input.pairingMode ?? "open",
        })
        .select("id")
        .single();
      if (error || !data)
        throw error ?? new Error("CLUB_SESSION_CREATE_FAILED");
      return data;
    },
    async addPlayer(input: {
      sessionId: string;
      displayName: string;
      sortOrder: number;
      gender?: ClubSessionGender;
      skillLevel?: number;
    }) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!.from("club_session_players").insert({
        session_id: input.sessionId,
        owner_id: ownerId,
        display_name: input.displayName,
        sort_order: input.sortOrder,
        gender: input.gender ?? null,
        skill_level: input.skillLevel ?? 3,
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
    async updatePlayerProfile(input: {
      sessionId: string;
      playerId: string;
      gender?: ClubSessionGender;
      skillLevel?: number;
      availability?: ClubSessionAvailability;
      avoidPlayerIds?: string[];
    }) {
      const ownerId = requireAccount(userId);
      const updates = {
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.skillLevel !== undefined
          ? { skill_level: input.skillLevel }
          : {}),
        ...(input.availability !== undefined
          ? { availability: input.availability }
          : {}),
        ...(input.avoidPlayerIds !== undefined
          ? { avoid_player_ids: input.avoidPlayerIds }
          : {}),
      };
      const { error } = await supabase!
        .from("club_session_players")
        .update(updates)
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
      const { error } = await supabase!.from("club_session_matches").insert({
        session_id: input.sessionId,
        owner_id: ownerId,
        match_id: input.matchId,
        court_id: input.courtId,
        ...assignmentColumns(input.playerIds),
        queue_order: input.queueOrder,
        is_open_fallback: input.isOpenFallback ?? false,
      });
      if (error) throw error;
    },
    async addQueuedMatches(input) {
      const ownerId = requireAccount(userId);
      const { error } = await supabase!.from("club_session_matches").insert(
        input.matches.map((match) => {
          return {
            session_id: input.sessionId,
            owner_id: ownerId,
            match_id: match.matchId,
            court_id: match.courtId,
            ...assignmentColumns(match.playerIds),
            queue_order: match.queueOrder,
            is_open_fallback: match.isOpenFallback ?? false,
          };
        }),
      );
      if (error) throw error;
    },
    async addQueuedMatchesIfCurrent(input) {
      requireAccount(userId);
      const { error } = await supabase!.rpc("queue_club_session_matches", {
        p_session_id: input.sessionId,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_matches: input.matches.map((match) => ({
          matchId: match.matchId,
          courtId: match.courtId,
          playerIds: match.playerIds,
          queueOrder: match.queueOrder,
          isOpenFallback: match.isOpenFallback ?? false,
        })),
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
