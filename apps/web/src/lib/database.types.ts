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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
