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
          rule_id: string;
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
      claim_guest_matches: { Args: Record<string, never>; Returns: number };
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
