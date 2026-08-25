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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      corners: {
        Row: {
          content: Json
          corner_type: Database["public"]["Enums"]["corner_type"]
          couple_id: string
          created_at: string
          engine_version: string | null
          generation_attempts: number
          id: string
          issue_id: string | null
          last_error: string | null
          period_end: string
          period_start: string
          seq: number | null
          skip_reason: string | null
          source_date_ids: string[]
          source_entry_ids: string[]
          source_message_ids: string[]
          status: Database["public"]["Enums"]["corner_status"]
          updated_at: string
        }
        Insert: {
          content?: Json
          corner_type: Database["public"]["Enums"]["corner_type"]
          couple_id: string
          created_at?: string
          engine_version?: string | null
          generation_attempts?: number
          id?: string
          issue_id?: string | null
          last_error?: string | null
          period_end: string
          period_start: string
          seq?: number | null
          skip_reason?: string | null
          source_date_ids?: string[]
          source_entry_ids?: string[]
          source_message_ids?: string[]
          status?: Database["public"]["Enums"]["corner_status"]
          updated_at?: string
        }
        Update: {
          content?: Json
          corner_type?: Database["public"]["Enums"]["corner_type"]
          couple_id?: string
          created_at?: string
          engine_version?: string | null
          generation_attempts?: number
          id?: string
          issue_id?: string | null
          last_error?: string | null
          period_end?: string
          period_start?: string
          seq?: number | null
          skip_reason?: string | null
          source_date_ids?: string[]
          source_entry_ids?: string[]
          source_message_ids?: string[]
          status?: Database["public"]["Enums"]["corner_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corners_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corners_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corners_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues_public"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_dissolutions: {
        Row: {
          cancelled_at: string | null
          couple_id: string
          executed_at: string | null
          id: string
          initiated_by: string
          partner_notified_at: string | null
          purge_scheduled_at: string
          reason: Database["public"]["Enums"]["dissolution_reason"]
          requested_at: string
        }
        Insert: {
          cancelled_at?: string | null
          couple_id: string
          executed_at?: string | null
          id?: string
          initiated_by: string
          partner_notified_at?: string | null
          purge_scheduled_at: string
          reason: Database["public"]["Enums"]["dissolution_reason"]
          requested_at?: string
        }
        Update: {
          cancelled_at?: string | null
          couple_id?: string
          executed_at?: string | null
          id?: string
          initiated_by?: string
          partner_notified_at?: string | null
          purge_scheduled_at?: string
          reason?: Database["public"]["Enums"]["dissolution_reason"]
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_dissolutions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_dissolutions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          connected_at: string | null
          created_at: string
          dissolved_at: string | null
          id: string
          invite_code: string
          invite_expires_at: string | null
          nickname: string | null
          reference_photo_path: string | null
          relationship_start_date: string | null
          start_date_confirmed_by: string | null
          start_date_set_by: string | null
          status: Database["public"]["Enums"]["couple_status"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_a_id: string
          user_b_id: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          dissolved_at?: string | null
          id?: string
          invite_code: string
          invite_expires_at?: string | null
          nickname?: string | null
          reference_photo_path?: string | null
          relationship_start_date?: string | null
          start_date_confirmed_by?: string | null
          start_date_set_by?: string | null
          status?: Database["public"]["Enums"]["couple_status"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_a_id: string
          user_b_id?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          dissolved_at?: string | null
          id?: string
          invite_code?: string
          invite_expires_at?: string | null
          nickname?: string | null
          reference_photo_path?: string | null
          relationship_start_date?: string | null
          start_date_confirmed_by?: string | null
          start_date_set_by?: string | null
          status?: Database["public"]["Enums"]["couple_status"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_a_id?: string
          user_b_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couples_start_date_confirmed_by_fkey"
            columns: ["start_date_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couples_start_date_set_by_fkey"
            columns: ["start_date_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couples_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couples_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_temperature: {
        Row: {
          computed_at: string
          couple_id: string
          date_on: string
          factors: Json
          temperature: number
        }
        Insert: {
          computed_at?: string
          couple_id: string
          date_on: string
          factors?: Json
          temperature?: number
        }
        Update: {
          computed_at?: string
          couple_id?: string
          date_on?: string
          factors?: Json
          temperature?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_temperature_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      data_entries: {
        Row: {
          access_locked: boolean
          ai_tags: Json
          author_id: string
          byte_size: number | null
          captured_at: string | null
          couple_id: string
          created_at: string
          date_id: string | null
          date_stop_id: string | null
          deleted_at: string | null
          downgraded_at: string | null
          drawing_path: string | null
          entry_type: Database["public"]["Enums"]["entry_type"]
          hashtags: string[]
          height: number | null
          id: string
          lat: number | null
          lng: number | null
          location_verified: boolean
          place_name: string | null
          resolution_tier: Database["public"]["Enums"]["resolution_tier"]
          storage_path: string | null
          text_content: string | null
          thumb_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          access_locked?: boolean
          ai_tags?: Json
          author_id: string
          byte_size?: number | null
          captured_at?: string | null
          couple_id: string
          created_at?: string
          date_id?: string | null
          date_stop_id?: string | null
          deleted_at?: string | null
          downgraded_at?: string | null
          drawing_path?: string | null
          entry_type: Database["public"]["Enums"]["entry_type"]
          hashtags?: string[]
          height?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_verified?: boolean
          place_name?: string | null
          resolution_tier?: Database["public"]["Enums"]["resolution_tier"]
          storage_path?: string | null
          text_content?: string | null
          thumb_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          access_locked?: boolean
          ai_tags?: Json
          author_id?: string
          byte_size?: number | null
          captured_at?: string | null
          couple_id?: string
          created_at?: string
          date_id?: string | null
          date_stop_id?: string | null
          deleted_at?: string | null
          downgraded_at?: string | null
          drawing_path?: string | null
          entry_type?: Database["public"]["Enums"]["entry_type"]
          hashtags?: string[]
          height?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_verified?: boolean
          place_name?: string | null
          resolution_tier?: Database["public"]["Enums"]["resolution_tier"]
          storage_path?: string | null
          text_content?: string | null
          thumb_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "data_entries_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_entries_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_entries_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_entries_date_stop_id_fkey"
            columns: ["date_stop_id"]
            isOneToOne: false
            referencedRelation: "date_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      date_stops: {
        Row: {
          arrived_at: string
          caption: string | null
          couple_id: string
          created_at: string
          date_id: string
          id: string
          lat: number | null
          lng: number | null
          location_verified: boolean
          place_name: string | null
          place_provider_id: string | null
          seq: number
          updated_at: string
        }
        Insert: {
          arrived_at: string
          caption?: string | null
          couple_id: string
          created_at?: string
          date_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_verified?: boolean
          place_name?: string | null
          place_provider_id?: string | null
          seq: number
          updated_at?: string
        }
        Update: {
          arrived_at?: string
          caption?: string | null
          couple_id?: string
          created_at?: string
          date_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_verified?: boolean
          place_name?: string | null
          place_provider_id?: string | null
          seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "date_stops_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_stops_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: false
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
        ]
      }
      dates: {
        Row: {
          couple_id: string
          created_at: string
          date_on: string
          deleted_at: string | null
          duration_minutes: number | null
          feature_count: number
          has_user_note: boolean
          id: string
          is_new_region: boolean
          last_featured_at: string | null
          narrative: string | null
          photo_count: number
          region: string | null
          source: string
          title: string | null
          updated_at: string
          user_confirmed: boolean
        }
        Insert: {
          couple_id: string
          created_at?: string
          date_on: string
          deleted_at?: string | null
          duration_minutes?: number | null
          feature_count?: number
          has_user_note?: boolean
          id?: string
          is_new_region?: boolean
          last_featured_at?: string | null
          narrative?: string | null
          photo_count?: number
          region?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          user_confirmed?: boolean
        }
        Update: {
          couple_id?: string
          created_at?: string
          date_on?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          feature_count?: number
          has_user_note?: boolean
          id?: string
          is_new_region?: boolean
          last_featured_at?: string | null
          narrative?: string | null
          photo_count?: number
          region?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          user_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dates_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      dna_scores: {
        Row: {
          base_score: number
          breakdown: Json
          chat_delta: number
          chat_factors: Json
          computed_at: string
          couple_id: string
          engine_version: string
          id: string
          period_month: string
          total_score: number
        }
        Insert: {
          base_score: number
          breakdown?: Json
          chat_delta?: number
          chat_factors?: Json
          computed_at?: string
          couple_id: string
          engine_version: string
          id?: string
          period_month: string
          total_score: number
        }
        Update: {
          base_score?: number
          breakdown?: Json
          chat_delta?: number
          chat_factors?: Json
          computed_at?: string
          couple_id?: string
          engine_version?: string
          id?: string
          period_month?: string
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "dna_scores_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          couple_id: string
          cover_path: string | null
          created_at: string
          id: string
          is_trial: boolean
          issue_number: number
          issue_type: Database["public"]["Enums"]["issue_type"]
          page_count: number | null
          pdf_digital_path: string | null
          pdf_print_path: string | null
          period_end: string
          period_start: string
          publish_mode: string
          published_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          couple_id: string
          cover_path?: string | null
          created_at?: string
          id?: string
          is_trial?: boolean
          issue_number: number
          issue_type: Database["public"]["Enums"]["issue_type"]
          page_count?: number | null
          pdf_digital_path?: string | null
          pdf_print_path?: string | null
          period_end: string
          period_start: string
          publish_mode?: string
          published_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          couple_id?: string
          cover_path?: string | null
          created_at?: string
          id?: string
          is_trial?: boolean
          issue_number?: number
          issue_type?: Database["public"]["Enums"]["issue_type"]
          page_count?: number | null
          pdf_digital_path?: string | null
          pdf_print_path?: string | null
          period_end?: string
          period_start?: string
          publish_mode?: string
          published_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      love_type_labels: {
        Row: {
          attachment: Database["public"]["Enums"]["attachment_type"]
          code: string
          copy_ko: string
          core_en: string
          description_ko: string | null
          enneagram_core: number
          label_en: string
          label_ko: string
          suffix_en: string
          updated_at: string
        }
        Insert: {
          attachment: Database["public"]["Enums"]["attachment_type"]
          code: string
          copy_ko: string
          core_en: string
          description_ko?: string | null
          enneagram_core: number
          label_en: string
          label_ko: string
          suffix_en: string
          updated_at?: string
        }
        Update: {
          attachment?: Database["public"]["Enums"]["attachment_type"]
          code?: string
          copy_ko?: string
          core_en?: string
          description_ko?: string | null
          enneagram_core?: number
          label_en?: string
          label_ko?: string
          suffix_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_reports: {
        Row: {
          computed_at: string
          couple_id: string
          engine_version: string
          id: string
          measured_keys: string[]
          metrics: Json
          period_end: string
          period_start: string
        }
        Insert: {
          computed_at?: string
          couple_id: string
          engine_version: string
          id?: string
          measured_keys?: string[]
          metrics: Json
          period_end: string
          period_start: string
        }
        Update: {
          computed_at?: string
          couple_id?: string
          engine_version?: string
          id?: string
          measured_keys?: string[]
          metrics?: Json
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_reports_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          analyzed_at: string | null
          body: string | null
          client_msg_id: string | null
          couple_id: string
          deleted_at: string | null
          id: string
          media_path: string | null
          read_at: string | null
          sender_id: string
          sent_at: string
          sentiment: Json | null
          warmth_score: number | null
        }
        Insert: {
          analyzed_at?: string | null
          body?: string | null
          client_msg_id?: string | null
          couple_id: string
          deleted_at?: string | null
          id?: string
          media_path?: string | null
          read_at?: string | null
          sender_id: string
          sent_at?: string
          sentiment?: Json | null
          warmth_score?: number | null
        }
        Update: {
          analyzed_at?: string | null
          body?: string | null
          client_msg_id?: string | null
          couple_id?: string
          deleted_at?: string | null
          id?: string
          media_path?: string | null
          read_at?: string | null
          sender_id?: string
          sent_at?: string
          sentiment?: Json | null
          warmth_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personality_assessments: {
        Row: {
          attach_anxiety: number
          attach_avoidance: number
          attachment: Database["public"]["Enums"]["attachment_type"]
          big_a: number
          big_c: number
          big_e: number
          big_n: number
          big_o: number
          created_at: string
          engine_version: string
          enneagram_core: number
          id: string
          mbti: string
          mbti_self_reported: boolean
          q1: Database["public"]["Enums"]["quiz_choice"]
          q2: Database["public"]["Enums"]["quiz_choice"]
          q3: Database["public"]["Enums"]["quiz_choice"]
          q4: Database["public"]["Enums"]["quiz_choice"]
          q5: Database["public"]["Enums"]["quiz_choice"]
          seq: number
          stern_commitment: number
          stern_intimacy: number
          stern_passion: number
          user_id: string
        }
        Insert: {
          attach_anxiety: number
          attach_avoidance: number
          attachment: Database["public"]["Enums"]["attachment_type"]
          big_a: number
          big_c: number
          big_e: number
          big_n: number
          big_o: number
          created_at?: string
          engine_version: string
          enneagram_core: number
          id?: string
          mbti: string
          mbti_self_reported?: boolean
          q1: Database["public"]["Enums"]["quiz_choice"]
          q2: Database["public"]["Enums"]["quiz_choice"]
          q3: Database["public"]["Enums"]["quiz_choice"]
          q4: Database["public"]["Enums"]["quiz_choice"]
          q5: Database["public"]["Enums"]["quiz_choice"]
          seq: number
          stern_commitment: number
          stern_intimacy: number
          stern_passion: number
          user_id: string
        }
        Update: {
          attach_anxiety?: number
          attach_avoidance?: number
          attachment?: Database["public"]["Enums"]["attachment_type"]
          big_a?: number
          big_c?: number
          big_e?: number
          big_n?: number
          big_o?: number
          created_at?: string
          engine_version?: string
          enneagram_core?: number
          id?: string
          mbti?: string
          mbti_self_reported?: boolean
          q1?: Database["public"]["Enums"]["quiz_choice"]
          q2?: Database["public"]["Enums"]["quiz_choice"]
          q3?: Database["public"]["Enums"]["quiz_choice"]
          q4?: Database["public"]["Enums"]["quiz_choice"]
          q5?: Database["public"]["Enums"]["quiz_choice"]
          seq?: number
          stern_commitment?: number
          stern_intimacy?: number
          stern_passion?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personality_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personality_profiles: {
        Row: {
          active_assessment_id: string
          attachment: Database["public"]["Enums"]["attachment_type"]
          created_at: string
          enneagram_effective: number | null
          enneagram_inferred: number
          enneagram_override: number | null
          love_type_code: string
          override_count: number
          override_updated_at: string | null
          retest_used: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active_assessment_id: string
          attachment: Database["public"]["Enums"]["attachment_type"]
          created_at?: string
          enneagram_effective?: number | null
          enneagram_inferred: number
          enneagram_override?: number | null
          love_type_code: string
          override_count?: number
          override_updated_at?: string | null
          retest_used?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active_assessment_id?: string
          attachment?: Database["public"]["Enums"]["attachment_type"]
          created_at?: string
          enneagram_effective?: number | null
          enneagram_inferred?: number
          enneagram_override?: number | null
          love_type_code?: string
          override_count?: number
          override_updated_at?: string | null
          retest_used?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personality_profiles_active_assessment_id_fkey"
            columns: ["active_assessment_id"]
            isOneToOne: false
            referencedRelation: "personality_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personality_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      // ⚠️ 017_profiles_marketing_consent.sql 반영을 위해 수동 편집됨
      // (marketing_agreed_at 추가, terms/privacy_agreed_at의 Insert 필수화).
      // 마이그레이션을 원격에 적용한 뒤 `supabase gen types`로 재생성해
      // 이 주석을 지우고 실제 생성 결과와 대조할 것.
      profiles: {
        Row: {
          ai_usage_agreed_at: string | null
          biometric_consent_at: string | null
          biometric_consent_revoked_at: string | null
          birth_date: string
          created_at: string
          deleted_at: string | null
          display_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          marketing_agreed_at: string | null
          mbti: string | null
          onboarding_step: number
          photo_scan_completed_at: string | null
          photo_scan_cursor: string | null
          photo_sync_enabled: boolean
          privacy_agreed_at: string
          purge_scheduled_at: string | null
          reference_photo_path: string | null
          terms_agreed_at: string
          updated_at: string
        }
        Insert: {
          ai_usage_agreed_at?: string | null
          biometric_consent_at?: string | null
          biometric_consent_revoked_at?: string | null
          birth_date: string
          created_at?: string
          deleted_at?: string | null
          display_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          marketing_agreed_at?: string | null
          mbti?: string | null
          onboarding_step?: number
          photo_scan_completed_at?: string | null
          photo_scan_cursor?: string | null
          photo_sync_enabled?: boolean
          privacy_agreed_at: string
          purge_scheduled_at?: string | null
          reference_photo_path?: string | null
          terms_agreed_at: string
          updated_at?: string
        }
        Update: {
          ai_usage_agreed_at?: string | null
          biometric_consent_at?: string | null
          biometric_consent_revoked_at?: string | null
          birth_date?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          marketing_agreed_at?: string | null
          mbti?: string | null
          onboarding_step?: number
          photo_scan_completed_at?: string | null
          photo_scan_cursor?: string | null
          photo_sync_enabled?: boolean
          privacy_agreed_at?: string
          purge_scheduled_at?: string | null
          reference_photo_path?: string | null
          terms_agreed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stat_snapshots: {
        Row: {
          att: number
          computed_at: string
          couple_id: string
          def: number
          delta: Json
          emp: number
          engine_version: string
          id: string
          inputs: Json
          ovr: number
          ovr_percentile: number | null
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["stat_period_type"]
          position_code: string | null
          pus: number
          rea: number
          tac: number
          user_id: string
        }
        Insert: {
          att: number
          computed_at?: string
          couple_id: string
          def: number
          delta?: Json
          emp: number
          engine_version: string
          id?: string
          inputs?: Json
          ovr: number
          ovr_percentile?: number | null
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["stat_period_type"]
          position_code?: string | null
          pus: number
          rea: number
          tac: number
          user_id: string
        }
        Update: {
          att?: number
          computed_at?: string
          couple_id?: string
          def?: number
          delta?: Json
          emp?: number
          engine_version?: string
          id?: string
          inputs?: Json
          ovr?: number
          ovr_percentile?: number | null
          period_end?: string
          period_start?: string
          period_type?: Database["public"]["Enums"]["stat_period_type"]
          position_code?: string | null
          pus?: number
          rea?: number
          tac?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stat_snapshots_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stat_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          archived_entry_id: string | null
          author_id: string
          caption: string | null
          couple_id: string
          created_at: string
          expires_at: string
          id: string
          media_path: string
          resolution: string | null
          resolved_at: string | null
        }
        Insert: {
          archived_entry_id?: string | null
          author_id: string
          caption?: string | null
          couple_id: string
          created_at?: string
          expires_at: string
          id?: string
          media_path: string
          resolution?: string | null
          resolved_at?: string | null
        }
        Update: {
          archived_entry_id?: string | null
          author_id?: string
          caption?: string | null
          couple_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          media_path?: string
          resolution?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_archived_entry_id_fkey"
            columns: ["archived_entry_id"]
            isOneToOne: false
            referencedRelation: "data_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          couple_id: string
          created_at: string
          current_period_end: string | null
          external_txn_id: string | null
          id: string
          platform: string
          started_at: string
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          cancelled_at?: string | null
          couple_id: string
          created_at?: string
          current_period_end?: string | null
          external_txn_id?: string | null
          id?: string
          platform: string
          started_at?: string
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          cancelled_at?: string | null
          couple_id?: string
          created_at?: string
          current_period_end?: string | null
          external_txn_id?: string | null
          id?: string
          platform?: string
          started_at?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      issues_public: {
        Row: {
          couple_id: string | null
          cover_path: string | null
          created_at: string | null
          id: string | null
          is_trial: boolean | null
          issue_number: number | null
          issue_type: Database["public"]["Enums"]["issue_type"] | null
          page_count: number | null
          pdf_digital_path: string | null
          period_end: string | null
          period_start: string | null
          published_at: string | null
          title: string | null
        }
        Insert: {
          couple_id?: string | null
          cover_path?: string | null
          created_at?: string | null
          id?: string | null
          is_trial?: boolean | null
          issue_number?: number | null
          issue_type?: Database["public"]["Enums"]["issue_type"] | null
          page_count?: number | null
          pdf_digital_path?: string | null
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          title?: string | null
        }
        Update: {
          couple_id?: string | null
          cover_path?: string | null
          created_at?: string | null
          id?: string | null
          is_trial?: boolean | null
          issue_number?: number | null
          issue_type?: Database["public"]["Enums"]["issue_type"] | null
          page_count?: number | null
          pdf_digital_path?: string | null
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_retention_policy: { Args: never; Returns: number }
      current_couple_id: { Args: never; Returns: string }
      execute_dissolution: {
        Args: { p_dissolution_id: string }
        Returns: undefined
      }
      expire_stories: { Args: never; Returns: number }
      is_couple_member: { Args: { p_couple_id: string }; Returns: boolean }
      is_entry_visible: {
        Args: { p_access_locked: boolean; p_couple_id: string }
        Returns: boolean
      }
      partner_id: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      attachment_type: "secure" | "anxious" | "avoidant" | "fearful"
      corner_status:
        | "pending"
        | "generating"
        | "ready"
        | "published"
        | "skipped"
        | "failed"
      corner_type:
        | "date_archive"
        | "love_dna"
        | "league_weekly"
        | "league_monthly"
        | "sweet_words"
        | "offline_setlog"
        | "couple_interview"
        | "this_month"
        | "special_guest"
        | "over_shoulder"
        | "appendix"
        | "sponsored"
        | "rough_guess"
      couple_status: "pending" | "active" | "dissolving" | "dissolved"
      dissolution_reason: "unlink" | "withdrawal"
      entry_type: "photo" | "memo" | "drawing"
      gender_type: "male" | "female" | "other"
      issue_type: "daily" | "weekly" | "monthly"
      quiz_choice: "A" | "B" | "C"
      resolution_tier: "original" | "low"
      stat_period_type: "weekly" | "monthly"
      subscription_tier: "free" | "paid"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attachment_type: ["secure", "anxious", "avoidant", "fearful"],
      corner_status: [
        "pending",
        "generating",
        "ready",
        "published",
        "skipped",
        "failed",
      ],
      corner_type: [
        "date_archive",
        "love_dna",
        "league_weekly",
        "league_monthly",
        "sweet_words",
        "offline_setlog",
        "couple_interview",
        "this_month",
        "special_guest",
        "over_shoulder",
        "appendix",
        "sponsored",
        "rough_guess",
      ],
      couple_status: ["pending", "active", "dissolving", "dissolved"],
      dissolution_reason: ["unlink", "withdrawal"],
      entry_type: ["photo", "memo", "drawing"],
      gender_type: ["male", "female", "other"],
      issue_type: ["daily", "weekly", "monthly"],
      quiz_choice: ["A", "B", "C"],
      resolution_tier: ["original", "low"],
      stat_period_type: ["weekly", "monthly"],
      subscription_tier: ["free", "paid"],
    },
  },
} as const
