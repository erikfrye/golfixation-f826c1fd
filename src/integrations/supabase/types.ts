export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          about_content: string | null
          id: string
          updated_at: string
        }
        Insert: {
          about_content?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          about_content?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hole_score_audit: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          edit_reason: string | null
          hole_number: number
          id: string
          new_mulligan_player_id: string | null
          new_strokes: number | null
          new_tee_shot_player_id: string | null
          old_mulligan_player_id: string | null
          old_strokes: number | null
          old_tee_shot_player_id: string | null
          team_id: string
          tournament_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          edit_reason?: string | null
          hole_number: number
          id?: string
          new_mulligan_player_id?: string | null
          new_strokes?: number | null
          new_tee_shot_player_id?: string | null
          old_mulligan_player_id?: string | null
          old_strokes?: number | null
          old_tee_shot_player_id?: string | null
          team_id: string
          tournament_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          edit_reason?: string | null
          hole_number?: number
          id?: string
          new_mulligan_player_id?: string | null
          new_strokes?: number | null
          new_tee_shot_player_id?: string | null
          old_mulligan_player_id?: string | null
          old_strokes?: number | null
          old_tee_shot_player_id?: string | null
          team_id?: string
          tournament_id?: string
        }
        Relationships: []
      }
      hole_scores: {
        Row: {
          first_saved_at: string
          hole_number: number
          id: string
          last_edit_reason: string | null
          mulligan_player_id: string | null
          strokes: number
          team_id: string
          tee_shot_player_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          first_saved_at?: string
          hole_number: number
          id?: string
          last_edit_reason?: string | null
          mulligan_player_id?: string | null
          strokes: number
          team_id: string
          tee_shot_player_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          first_saved_at?: string
          hole_number?: number
          id?: string
          last_edit_reason?: string | null
          mulligan_player_id?: string | null
          strokes?: number
          team_id?: string
          tee_shot_player_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hole_scores_mulligan_player_id_fkey"
            columns: ["mulligan_player_id"]
            isOneToOne: false
            referencedRelation: "team_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_tee_shot_player_id_fkey"
            columns: ["tee_shot_player_id"]
            isOneToOne: false
            referencedRelation: "team_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      holes: {
        Row: {
          handicap: number | null
          hole_number: number
          id: string
          par: number
          tournament_id: string
        }
        Insert: {
          handicap?: number | null
          hole_number: number
          id?: string
          par?: number
          tournament_id: string
        }
        Update: {
          handicap?: number | null
          hole_number?: number
          id?: string
          par?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          created_at: string
          id: string
          mulligans_total: number
          mulligans_used: number
          name: string
          team_id: string
          tee_shots_used: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mulligans_total?: number
          mulligans_used?: number
          name: string
          team_id: string
          tee_shots_used?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mulligans_total?: number
          mulligans_used?: number
          name?: string
          team_id?: string
          tee_shots_used?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_email: string
          created_at: string
          id: string
          name: string
          start_hole: number
          tournament_id: string
        }
        Insert: {
          captain_email: string
          created_at?: string
          id?: string
          name: string
          start_hole?: number
          tournament_id: string
        }
        Update: {
          captain_email?: string
          created_at?: string
          id?: string
          name?: string
          start_hole?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          about_content: string | null
          created_at: string
          created_by: string | null
          format: string
          id: string
          location: string | null
          mulligans_enabled: boolean
          name: string
          num_holes: number
          override_code: string
          start_date: string | null
          start_format: string
          status: string
          tee_shot_minimum: number
        }
        Insert: {
          about_content?: string | null
          created_at?: string
          created_by?: string | null
          format?: string
          id?: string
          location?: string | null
          mulligans_enabled?: boolean
          name: string
          num_holes?: number
          override_code: string
          start_date?: string | null
          start_format?: string
          status?: string
          tee_shot_minimum?: number
        }
        Update: {
          about_content?: string | null
          created_at?: string
          created_by?: string | null
          format?: string
          id?: string
          location?: string | null
          mulligans_enabled?: boolean
          name?: string
          num_holes?: number
          override_code?: string
          start_date?: string | null
          start_format?: string
          status?: string
          tee_shot_minimum?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_captain: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
