export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      club_sessions: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          session_date: string;
          sport: string;
          format: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          session_date: string;
          sport?: string;
          format?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          session_date?: string;
          sport?: string;
          format?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_session_players: {
        Row: {
          id: string;
          session_id: string;
          owner_id: string;
          display_name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          owner_id: string;
          display_name: string;
          sort_order: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      club_session_courts: {
        Row: {
          id: string;
          session_id: string;
          owner_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          owner_id: string;
          name: string;
          sort_order: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      club_session_matches: {
        Row: {
          id: string;
          session_id: string;
          owner_id: string;
          match_id: string;
          linked_match_id: string | null;
          court_id: string;
          team_a_player_1: string;
          team_a_player_2: string;
          team_b_player_1: string;
          team_b_player_2: string;
          queue_order: number;
          started_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          owner_id: string;
          match_id: string;
          linked_match_id?: string | null;
          court_id: string;
          team_a_player_1: string;
          team_a_player_2: string;
          team_b_player_1: string;
          team_b_player_2: string;
          queue_order: number;
          started_at?: string | null;
          created_at?: string;
        };
        Update: {
          court_id?: string;
          queue_order?: number;
          started_at?: string | null;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          owner_id: string;
          sport: string;
          ruleset_id: string;
          mode: string;
          definition: Json;
          status: string;
          winner: string | null;
          current_state: Json;
          last_client_sequence: number;
          created_at: string;
          updated_at: string;
          is_guest: boolean;
          last_activity_at: string;
          expires_at: string | null;
          hard_expires_at: string | null;
          viewer_token_hash: string | null;
          viewer_expires_at: string | null;
          viewer_revoked_at: string | null;
          control_token_hash: string | null;
          control_heartbeat_at: string | null;
          control_expires_at: string | null;
        };
        Insert: {
          id: string;
          owner_id: string;
          sport: string;
          ruleset_id: string;
          mode: string;
          definition: Json;
          status: string;
          winner?: string | null;
          current_state: Json;
          last_client_sequence: number;
          created_at: string;
          updated_at?: string;
          is_guest: boolean;
          last_activity_at?: string;
          expires_at?: string | null;
          hard_expires_at?: string | null;
          viewer_token_hash?: string | null;
          viewer_expires_at?: string | null;
          viewer_revoked_at?: string | null;
          control_token_hash?: string | null;
          control_heartbeat_at?: string | null;
          control_expires_at?: string | null;
        };
        Update: {
          sport?: string;
          ruleset_id?: string;
          mode?: string;
          definition?: Json;
          status?: string;
          winner?: string | null;
          current_state?: Json;
          last_client_sequence?: number;
          updated_at?: string;
          is_guest?: boolean;
          last_activity_at?: string;
          expires_at?: string | null;
          hard_expires_at?: string | null;
          viewer_token_hash?: string | null;
          viewer_expires_at?: string | null;
          viewer_revoked_at?: string | null;
          control_token_hash?: string | null;
          control_heartbeat_at?: string | null;
          control_expires_at?: string | null;
        };
        Relationships: [];
      };
      match_events: {
        Row: {
          id: string;
          match_id: string;
          owner_id: string;
          client_sequence: number;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          match_id: string;
          owner_id: string;
          client_sequence: number;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Update: never;
        Relationships: [];
      };
      community_rules: {
        Row: {
          id: string;
          author_id: string;
          sport: string;
          title: string;
          description: string;
          current_version: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      community_rule_versions: {
        Row: {
          rule_id: string | null;
          version: number;
          configuration: Json;
          created_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      community_rule_reports: {
        Row: {
          id: string;
          rule_id: string | null;
          reporter_id: string | null;
          reason: string;
          details: string;
          created_at: string;
          reporter_contact: string | null;
          status: string;
          reviewed_at: string | null;
          resolution: string | null;
          review_notes: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      sync_match_journal: {
        Args: {
          p_match_id: string;
          p_owner_id: string;
          p_sport: string;
          p_ruleset_id: string;
          p_mode: string;
          p_definition: Json;
          p_status: string;
          p_winner: string | null;
          p_current_state: Json;
          p_last_client_sequence: number;
          p_created_at: string;
          p_is_guest: boolean;
          p_control_token: string;
          p_events: Json;
        };
        Returns: string;
      };
      claim_guest_matches: { Args: Record<string, never>; Returns: number };
      transfer_guest_matches: {
        Args: { p_guest_owner_id: string; p_account_owner_id: string };
        Returns: number;
      };
      delete_my_account_data: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      create_live_viewer_link: {
        Args: { p_match_id: string };
        Returns: string;
      };
      revoke_live_viewer_link: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      read_live_viewer: {
        Args: { p_token: string };
        Returns: Array<{
          sport: string;
          status: string;
          current_state: Json;
          updated_at: string;
          expires_at: string;
        }>;
      };
      read_match_journal: {
        Args: { p_match_id: string };
        Returns: Array<{
          id: string;
          owner_id: string;
          sport: string;
          status: string;
          winner: string | null;
          definition: Json;
          current_state: Json;
          last_client_sequence: number;
          created_at: string;
          updated_at: string;
          events: Json;
        }>;
      };
      read_match_definition: {
        Args: { p_match_id: string };
        Returns: Array<{
          id: string;
          owner_id: string;
          sport: string;
          status: string;
          winner: string | null;
          definition: Json;
          current_state: Json;
          last_client_sequence: number;
          created_at: string;
          updated_at: string;
          event_count: number;
        }>;
      };
      read_match_head: {
        Args: { p_match_id: string };
        Returns: Array<{
          id: string;
          sport: string;
          status: string;
          winner: string | null;
          current_state: Json;
          last_client_sequence: number;
          updated_at: string;
        }>;
      };
      read_match_events_since: {
        Args: {
          p_match_id: string;
          p_after_sequence?: number;
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          match_id: string;
          client_sequence: number;
          event_type: string;
          payload: Json;
          created_at: string;
        }>;
      };
      list_my_match_summaries: {
        Args: {
          p_search?: string | null;
          p_status?: string | null;
          p_sport?: string | null;
          p_sort?: string;
          p_limit?: number;
          p_before_updated_at?: string | null;
          p_before_id?: string | null;
        };
        Returns: Array<{
          id: string;
          sport: string;
          status: string;
          winner: string | null;
          team_a_name: string;
          team_b_name: string;
          current_state: Json;
          created_at: string;
          updated_at: string;
        }>;
      };
      acquire_match_control: {
        Args: {
          p_match_id: string;
          p_control_token: string;
          p_force?: boolean;
        };
        Returns: string;
      };
      renew_match_control: {
        Args: { p_match_id: string; p_control_token: string };
        Returns: boolean;
      };
      release_match_control: {
        Args: { p_match_id: string; p_control_token: string };
        Returns: boolean;
      };
      save_community_rule: {
        Args: {
          p_rule_id: string;
          p_expected_version: number;
          p_sport: string;
          p_title: string;
          p_description: string;
          p_configuration: Json;
          p_is_published?: boolean;
        };
        Returns: number;
      };
      unpublish_community_rule: {
        Args: { p_rule_id: string };
        Returns: boolean;
      };
      publish_community_rule: {
        Args: { p_rule_id: string };
        Returns: boolean;
      };
      report_community_rule: {
        Args: { p_rule_id: string; p_reason: string; p_details?: string };
        Returns: string;
      };
      report_community_rule_v2: {
        Args: {
          p_rule_id: string;
          p_reason: string;
          p_details: string;
          p_reporter_contact: string | null;
        };
        Returns: string;
      };
      can_manage_community_rule: {
        Args: { p_rule_id: string };
        Returns: boolean;
      };
      list_community_rules: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          sport: string;
          title: string;
          description: string;
          current_version: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
          is_owner: boolean;
        }>;
      };
      list_community_rules_page: {
        Args: {
          p_sport?: string | null;
          p_search?: string | null;
          p_scope?: string;
          p_limit?: number;
          p_before_updated_at?: string | null;
          p_before_id?: string | null;
        };
        Returns: Array<{
          id: string;
          sport: string;
          title: string;
          description: string;
          current_version: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
          is_owner: boolean;
        }>;
      };
      read_community_rule: {
        Args: { p_rule_id: string };
        Returns: Array<{
          id: string;
          sport: string;
          title: string;
          description: string;
          current_version: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
          is_owner: boolean;
        }>;
      };
      read_community_rule_version: {
        Args: { p_rule_id: string; p_version: number };
        Returns: Array<{ configuration: Json }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
