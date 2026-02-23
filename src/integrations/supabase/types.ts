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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_definitions: {
        Row: {
          created_at: string
          dedupe_window_sec: number
          group_id: string | null
          id: string
          match_mode: string
          name: string
          notify_in_app: boolean
          organization_id: string | null
          scope_all_groups: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_window_sec?: number
          group_id?: string | null
          id?: string
          match_mode?: string
          name: string
          notify_in_app?: boolean
          organization_id?: string | null
          scope_all_groups?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_window_sec?: number
          group_id?: string | null
          id?: string
          match_mode?: string
          name?: string
          notify_in_app?: boolean
          organization_id?: string | null
          scope_all_groups?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_events: {
        Row: {
          alert_definition_id: string
          alert_term_id: string
          created_at: string
          first_message_id: string | null
          first_triggered_at: string
          group_id: string
          id: string
          last_message_id: string | null
          last_triggered_at: string
          message_ids: Json
          occurrences: number
          organization_id: string
          snippet: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_definition_id: string
          alert_term_id: string
          created_at?: string
          first_message_id?: string | null
          first_triggered_at?: string
          group_id: string
          id?: string
          last_message_id?: string | null
          last_triggered_at?: string
          message_ids?: Json
          occurrences?: number
          organization_id: string
          snippet?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_definition_id?: string
          alert_term_id?: string
          created_at?: string
          first_message_id?: string | null
          first_triggered_at?: string
          group_id?: string
          id?: string
          last_message_id?: string | null
          last_triggered_at?: string
          message_ids?: Json
          occurrences?: number
          organization_id?: string
          snippet?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_terms: {
        Row: {
          alert_definition_id: string
          created_at: string
          id: string
          term_kind: string
          term_norm: string
          term_raw: string
          updated_at: string
        }
        Insert: {
          alert_definition_id: string
          created_at?: string
          id?: string
          term_kind?: string
          term_norm?: string
          term_raw: string
          updated_at?: string
        }
        Update: {
          alert_definition_id?: string
          created_at?: string
          id?: string
          term_kind?: string
          term_norm?: string
          term_raw?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      group_daily_keywords: {
        Row: {
          created_at: string
          group_id: string
          id: string
          keyword: string
          keyword_date: string
          mentions_count: number
          messages_count: number
          participants_count: number
          rank: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          keyword: string
          keyword_date: string
          mentions_count?: number
          messages_count?: number
          participants_count?: number
          rank: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          keyword?: string
          keyword_date?: string
          mentions_count?: number
          messages_count?: number
          participants_count?: number
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_daily_keywords_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_daily_keywords_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_daily_keywords_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      group_daily_summaries: {
        Row: {
          created_at: string
          group_id: string
          id: string
          metadata: Json | null
          summary_date: string
          summary_text: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          metadata?: Json | null
          summary_date: string
          summary_text: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          metadata?: Json | null
          summary_date?: string
          summary_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_daily_summaries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_daily_summaries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_daily_summaries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      group_daily_topics: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          rank: number
          title: string
          topic_date: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          rank: number
          title: string
          topic_date: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          rank?: number
          title?: string
          topic_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_daily_topics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_daily_topics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_daily_topics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      group_daily_topics_backup_before_rename_summary_to_content_2026: {
        Row: {
          created_at: string
          group_id: string
          id: string
          rank: number
          summary: string
          title: string
          topic_date: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          rank: number
          summary: string
          title: string
          topic_date: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          rank?: number
          summary?: string
          title?: string
          topic_date?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          granted_at: string | null
          granted_by_user_id: string | null
          group_id: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          revoked_at: string | null
          role_in_group: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          granted_at?: string | null
          granted_by_user_id?: string | null
          group_id: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          revoked_at?: string | null
          role_in_group?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          granted_at?: string | null
          granted_by_user_id?: string | null
          group_id?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          revoked_at?: string | null
          role_in_group?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      group_settings: {
        Row: {
          daily_summary_enabled: boolean
          daily_summary_time: string
          daily_topics_enabled: boolean
          group_id: string
          peak_moment_enabled: boolean
          polls_enabled: boolean
          updated_at: string
        }
        Insert: {
          daily_summary_enabled?: boolean
          daily_summary_time?: string
          daily_topics_enabled?: boolean
          group_id: string
          peak_moment_enabled?: boolean
          polls_enabled?: boolean
          updated_at?: string
        }
        Update: {
          daily_summary_enabled?: boolean
          daily_summary_time?: string
          daily_topics_enabled?: boolean
          group_id?: string
          peak_moment_enabled?: boolean
          polls_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          assistant_id: string | null
          assistant_prompt: string | null
          counts_cache: Json | null
          created_at: string
          created_at_provider: string | null
          deleted_at: string | null
          description: string | null
          id: string
          invite_link: string | null
          invite_link_status: string | null
          is_active: boolean | null
          is_archived: boolean | null
          last_sync_at: string | null
          metadata: Json | null
          name: string
          organization_id: string
          provider: string
          provider_phone: string | null
          raw_provider: Json | null
          status: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string
          whatsapp_provider_id: string | null
        }
        Insert: {
          assistant_id?: string | null
          assistant_prompt?: string | null
          counts_cache?: Json | null
          created_at?: string
          created_at_provider?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          invite_link?: string | null
          invite_link_status?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_sync_at?: string | null
          metadata?: Json | null
          name: string
          organization_id: string
          provider?: string
          provider_phone?: string | null
          raw_provider?: Json | null
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Update: {
          assistant_id?: string | null
          assistant_prompt?: string | null
          counts_cache?: Json | null
          created_at?: string
          created_at_provider?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          invite_link?: string | null
          invite_link_status?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_sync_at?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          provider?: string
          provider_phone?: string | null
          raw_provider?: Json | null
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      member_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["member_event_type"]
          member_lid: string
          group_id: string
          id: string
          member_id: string | null
          meta: Json | null
          occurred_at: string
          payload_raw: Json | null
          source: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["member_event_type"]
          member_lid: string
          group_id: string
          id?: string
          member_id?: string | null
          meta?: Json | null
          occurred_at: string
          payload_raw?: Json | null
          source?: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["member_event_type"]
          member_lid?: string
          group_id?: string
          id?: string
          member_id?: string | null
          meta?: Json | null
          occurred_at?: string
          payload_raw?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "member_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "member_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string | null
          group_id: string
          id: string
          is_admin: boolean
          is_owner: boolean | null
          is_super_admin: boolean | null
          joined_at: string | null
          last_seen_message_at: string | null
          left_at: string | null
          lid: string | null
          metadata: Json | null
          name: string
          phone_e164: string | null
          profile_pic_url: string | null
          provider: string | null
          provider_member_id: string | null
          raw_provider: Json | null
          status: string | null
          updated_at: string
          whatsapp_provider_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          group_id: string
          id?: string
          is_admin?: boolean
          is_owner?: boolean | null
          is_super_admin?: boolean | null
          joined_at?: string | null
          last_seen_message_at?: string | null
          left_at?: string | null
          lid?: string | null
          metadata?: Json | null
          name: string
          phone_e164?: string | null
          profile_pic_url?: string | null
          provider?: string | null
          provider_member_id?: string | null
          raw_provider?: Json | null
          status?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          group_id?: string
          id?: string
          is_admin?: boolean
          is_owner?: boolean | null
          is_super_admin?: boolean | null
          joined_at?: string | null
          last_seen_message_at?: string | null
          left_at?: string | null
          lid?: string | null
          metadata?: Json | null
          name?: string
          phone_e164?: string | null
          profile_pic_url?: string | null
          provider?: string | null
          provider_member_id?: string | null
          raw_provider?: Json | null
          status?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          deleted_at: string | null
          emoji: string
          group_id: string
          id: string
          member_id: string | null
          message_id: string
          metadata: Json | null
          provider: string | null
          provider_reaction_key: string | null
          raw_provider: Json | null
          reacted_at: string
          removed_at: string | null
          status: string | null
          updated_at: string
          whatsapp_provider_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          emoji: string
          group_id: string
          id?: string
          member_id?: string | null
          message_id: string
          metadata?: Json | null
          provider?: string | null
          provider_reaction_key?: string | null
          raw_provider?: Json | null
          reacted_at?: string
          removed_at?: string | null
          status?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          emoji?: string
          group_id?: string
          id?: string
          member_id?: string | null
          message_id?: string
          metadata?: Json | null
          provider?: string | null
          provider_reaction_key?: string | null
          raw_provider?: Json | null
          reacted_at?: string
          removed_at?: string | null
          status?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_whatsapp_provider_id: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          delivery_status: string | null
          direction: string | null
          edited_at: string | null
          from_me: boolean | null
          group_id: string
          id: string
          is_deleted: boolean | null
          is_edit: boolean | null
          last_read_at: string | null
          media_caption: string | null
          media_duration_sec: number | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          member_id: string | null
          message_ts: string | null
          message_type: string
          metadata: Json | null
          provider: string | null
          raw_provider: Json | null
          read_count: number | null
          reference_message_id: string | null
          reply_to_whatsapp_provider_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          text: string | null
          thumbnail_url: string | null
          type: string | null
          updated_at: string
          whatsapp_provider_id: string | null
        }
        Insert: {
          chat_whatsapp_provider_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          edited_at?: string | null
          from_me?: boolean | null
          group_id: string
          id?: string
          is_deleted?: boolean | null
          is_edit?: boolean | null
          last_read_at?: string | null
          media_caption?: string | null
          media_duration_sec?: number | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          member_id?: string | null
          message_ts?: string | null
          message_type?: string
          metadata?: Json | null
          provider?: string | null
          raw_provider?: Json | null
          read_count?: number | null
          reference_message_id?: string | null
          reply_to_whatsapp_provider_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          text?: string | null
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Update: {
          chat_whatsapp_provider_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          edited_at?: string | null
          from_me?: boolean | null
          group_id?: string
          id?: string
          is_deleted?: boolean | null
          is_edit?: boolean | null
          last_read_at?: string | null
          media_caption?: string | null
          media_duration_sec?: number | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          member_id?: string | null
          message_ts?: string | null
          message_type?: string
          metadata?: Json | null
          provider?: string | null
          raw_provider?: Json | null
          read_count?: number | null
          reference_message_id?: string | null
          reply_to_whatsapp_provider_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          text?: string | null
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      organization_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          organization_id: string
          phone: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          organization_id: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_plan: string | null
          billing_status: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          current_period_end: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          name: string
          owner_user_id: string | null
          plan: string | null
          settings: Json | null
          slug: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          billing_plan?: string | null
          billing_status?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          current_period_end?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          owner_user_id?: string | null
          plan?: string | null
          settings?: Json | null
          slug?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_plan?: string | null
          billing_status?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          current_period_end?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          owner_user_id?: string | null
          plan?: string | null
          settings?: Json | null
          slug?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: string
          option_index: number
          option_text: string
          poll_id: string
        }
        Insert: {
          id?: string
          option_index: number
          option_text: string
          poll_id: string
        }
        Update: {
          id?: string
          option_index?: number
          option_text?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "v_polls_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          person_id: string | null
          poll_id: string
          provider: string
          provider_vote_message_id: string | null
          raw_payload: Json | null
          vote_sequence: number | null
          voted_options: Json
        }
        Insert: {
          created_at?: string
          id?: string
          person_id?: string | null
          poll_id: string
          provider?: string
          provider_vote_message_id?: string | null
          raw_payload?: Json | null
          vote_sequence?: number | null
          voted_options: Json
        }
        Update: {
          created_at?: string
          id?: string
          person_id?: string | null
          poll_id?: string
          provider?: string
          provider_vote_message_id?: string | null
          raw_payload?: Json | null
          vote_sequence?: number | null
          voted_options?: Json
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "v_polls_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by_person_id: string | null
          group_id: string
          id: string
          max_options: number | null
          max_votes_per_member: number
          provider: string
          question: string
          whatsapp_provider_id: string
        }
        Insert: {
          created_at?: string
          created_by_person_id?: string | null
          group_id: string
          id?: string
          max_options?: number | null
          max_votes_per_member?: number
          provider?: string
          question: string
          whatsapp_provider_id: string
        }
        Update: {
          created_at?: string
          created_by_person_id?: string | null
          group_id?: string
          id?: string
          max_options?: number | null
          max_votes_per_member?: number
          provider?: string
          question?: string
          whatsapp_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          locale: string | null
          metadata: Json | null
          name: string | null
          phone_e164: string | null
          role_global: string | null
          status: string | null
          timezone: string | null
          updated_at: string
          whatsapp_verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          locale?: string | null
          metadata?: Json | null
          name?: string | null
          phone_e164?: string | null
          role_global?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string
          whatsapp_verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          locale?: string | null
          metadata?: Json | null
          name?: string | null
          phone_e164?: string | null
          role_global?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string
          whatsapp_verified_at?: string | null
        }
        Relationships: []
      }
      user_access_scope: {
        Row: {
          created_at: string
          id: string
          scope_id: string
          scope_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scope_id: string
          scope_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scope_id?: string
          scope_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          org_id: string
          page: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          page?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          page?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_overrides: {
        Row: {
          classification: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          organization_id: string
          phone_e164: string | null
          provider_member_id: string | null
          updated_at: string
        }
        Insert: {
          classification?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          phone_e164?: string | null
          provider_member_id?: string | null
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          phone_e164?: string | null
          provider_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_events_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string | null
          id: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_group_members_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          deleted_at: string | null
          granted_at: string | null
          granted_by_user_id: string | null
          group_id: string | null
          id: string | null
          is_active: boolean | null
          metadata: Json | null
          revoked_at: string | null
          role_in_group: string | null
          status: string | null
          updated_at: string | null
          updated_at_local: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          granted_at?: string | null
          granted_by_user_id?: string | null
          group_id?: string | null
          id?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          revoked_at?: string | null
          role_in_group?: string | null
          status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          granted_at?: string | null
          granted_by_user_id?: string | null
          group_id?: string | null
          id?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          revoked_at?: string | null
          role_in_group?: string | null
          status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_group_overview: {
        Row: {
          counts_cache: Json | null
          description: string | null
          group_id: string | null
          group_name: string | null
          invite_link_status: string | null
          is_active: boolean | null
          is_archived: boolean | null
          last_message_at: string | null
          last_message_member_name: string | null
          last_message_preview: string | null
          last_sync_at: string | null
          members_count: number | null
          messages_count: number | null
          organization_id: string | null
          provider: string | null
          sync_status: string | null
          whatsapp_provider_id: string | null
        }
        Insert: {
          counts_cache?: Json | null
          description?: string | null
          group_id?: string | null
          group_name?: string | null
          invite_link_status?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_message_at?: never
          last_message_member_name?: never
          last_message_preview?: never
          last_sync_at?: string | null
          members_count?: never
          messages_count?: never
          organization_id?: string | null
          provider?: string | null
          sync_status?: string | null
          whatsapp_provider_id?: string | null
        }
        Update: {
          counts_cache?: Json | null
          description?: string | null
          group_id?: string | null
          group_name?: string | null
          invite_link_status?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_message_at?: never
          last_message_member_name?: never
          last_message_preview?: never
          last_sync_at?: string | null
          members_count?: never
          messages_count?: never
          organization_id?: string | null
          provider?: string | null
          sync_status?: string | null
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_groups_br_time: {
        Row: {
          counts_cache: Json | null
          created_at: string | null
          created_at_local: string | null
          created_at_provider: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          invite_link: string | null
          invite_link_status: string | null
          is_active: boolean | null
          is_archived: boolean | null
          last_sync_at: string | null
          metadata: Json | null
          name: string | null
          organization_id: string | null
          provider: string | null
          provider_phone: string | null
          raw_provider: Json | null
          status: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
          updated_at_local: string | null
          whatsapp_provider_id: string | null
        }
        Insert: {
          counts_cache?: Json | null
          created_at?: string | null
          created_at_local?: never
          created_at_provider?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          invite_link?: string | null
          invite_link_status?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_sync_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id?: string | null
          provider?: string | null
          provider_phone?: string | null
          raw_provider?: Json | null
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Update: {
          counts_cache?: Json | null
          created_at?: string | null
          created_at_local?: never
          created_at_provider?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          invite_link?: string | null
          invite_link_status?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_sync_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id?: string | null
          provider?: string | null
          provider_phone?: string | null
          raw_provider?: Json | null
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_members_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          deleted_at: string | null
          display_name: string | null
          group_id: string | null
          id: string | null
          is_admin: boolean | null
          is_owner: boolean | null
          is_super_admin: boolean | null
          joined_at: string | null
          last_seen_message_at: string | null
          left_at: string | null
          lid: string | null
          metadata: Json | null
          name: string | null
          phone_e164: string | null
          profile_pic_url: string | null
          provider: string | null
          raw_provider: Json | null
          status: string | null
          updated_at: string | null
          updated_at_local: string | null
          whatsapp_provider_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          display_name?: string | null
          group_id?: string | null
          id?: string | null
          is_admin?: boolean | null
          is_owner?: boolean | null
          is_super_admin?: boolean | null
          joined_at?: string | null
          last_seen_message_at?: string | null
          left_at?: string | null
          lid?: string | null
          metadata?: Json | null
          name?: string | null
          phone_e164?: string | null
          profile_pic_url?: string | null
          provider?: string | null
          raw_provider?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          display_name?: string | null
          group_id?: string | null
          id?: string | null
          is_admin?: boolean | null
          is_owner?: boolean | null
          is_super_admin?: boolean | null
          joined_at?: string | null
          last_seen_message_at?: string | null
          left_at?: string | null
          lid?: string | null
          metadata?: Json | null
          name?: string | null
          phone_e164?: string | null
          profile_pic_url?: string | null
          provider?: string | null
          raw_provider?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_message_reactions: {
        Row: {
          emoji: string | null
          group_id: string | null
          member_avatar: string | null
          member_display_name: string | null
          member_id: string | null
          member_name: string | null
          member_phone: string | null
          message_id: string | null
          reacted_at: string | null
          reaction_id: string | null
          reaction_status: string | null
          removed_at: string | null
          whatsapp_provider_id: string | null
        }
        Relationships: []
      }
      v_message_reactions_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          deleted_at: string | null
          emoji: string | null
          group_id: string | null
          id: string | null
          member_id: string | null
          message_id: string | null
          metadata: Json | null
          provider: string | null
          provider_reaction_key: string | null
          raw_provider: Json | null
          reacted_at: string | null
          removed_at: string | null
          status: string | null
          updated_at: string | null
          updated_at_local: string | null
          whatsapp_provider_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          emoji?: string | null
          group_id?: string | null
          id?: string | null
          member_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          provider?: string | null
          provider_reaction_key?: string | null
          raw_provider?: Json | null
          reacted_at?: string | null
          removed_at?: string | null
          status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          emoji?: string | null
          group_id?: string | null
          id?: string | null
          member_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          provider?: string | null
          provider_reaction_key?: string | null
          raw_provider?: Json | null
          reacted_at?: string | null
          removed_at?: string | null
          status?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Relationships: []
      }
      v_message_reactions_summary: {
        Row: {
          count: number | null
          emoji: string | null
          message_id: string | null
          reactors: Json[] | null
        }
        Relationships: []
      }
      v_messages_br_time: {
        Row: {
          chat_whatsapp_provider_id: string | null
          content: string | null
          created_at: string | null
          created_at_local: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_status: string | null
          direction: string | null
          edited_at: string | null
          from_me: boolean | null
          group_id: string | null
          id: string | null
          is_deleted: boolean | null
          is_edit: boolean | null
          last_read_at: string | null
          media_caption: string | null
          media_duration_sec: number | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          member_id: string | null
          message_ts: string | null
          message_type: string | null
          metadata: Json | null
          provider: string | null
          raw_provider: Json | null
          read_count: number | null
          reference_message_id: string | null
          reply_to_whatsapp_provider_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          text: string | null
          thumbnail_url: string | null
          type: string | null
          updated_at: string | null
          updated_at_local: string | null
          whatsapp_provider_id: string | null
        }
        Insert: {
          chat_whatsapp_provider_id?: string | null
          content?: string | null
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          edited_at?: string | null
          from_me?: boolean | null
          group_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_edit?: boolean | null
          last_read_at?: string | null
          media_caption?: string | null
          media_duration_sec?: number | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          member_id?: string | null
          message_ts?: string | null
          message_type?: string | null
          metadata?: Json | null
          provider?: string | null
          raw_provider?: Json | null
          read_count?: number | null
          reference_message_id?: string | null
          reply_to_whatsapp_provider_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          text?: string | null
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Update: {
          chat_whatsapp_provider_id?: string | null
          content?: string | null
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          edited_at?: string | null
          from_me?: boolean | null
          group_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_edit?: boolean | null
          last_read_at?: string | null
          media_caption?: string | null
          media_duration_sec?: number | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          member_id?: string | null
          message_ts?: string | null
          message_type?: string | null
          metadata?: Json | null
          provider?: string | null
          raw_provider?: Json | null
          read_count?: number | null
          reference_message_id?: string | null
          reply_to_whatsapp_provider_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          text?: string | null
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      v_messages_feed: {
        Row: {
          content_preview: string | null
          created_at: string | null
          delivery_status: string | null
          direction: string | null
          from_me: boolean | null
          group_id: string | null
          media_mime_type: string | null
          media_url: string | null
          member_avatar: string | null
          member_display_name: string | null
          member_id: string | null
          member_name: string | null
          message_id: string | null
          message_type: string | null
          provider: string | null
          sender_phone: string | null
          status: string | null
          type: string | null
          whatsapp_provider_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      v_messages_with_members: {
        Row: {
          chat_whatsapp_provider_id: string | null
          content: string | null
          delivered_at: string | null
          delivery_status: string | null
          direction: string | null
          display_name: string | null
          edited_at: string | null
          from_me: boolean | null
          group_id: string | null
          is_admin: boolean | null
          is_deleted: boolean | null
          is_edit: boolean | null
          is_owner: boolean | null
          is_super_admin: boolean | null
          joined_at: string | null
          last_read_at: string | null
          last_seen_message_at: string | null
          left_at: string | null
          lid: string | null
          media_caption: string | null
          media_duration_sec: number | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          member_created_at: string | null
          member_deleted_at: string | null
          member_id: string | null
          member_id_resolved: string | null
          member_metadata: Json | null
          member_name: string | null
          member_provider: string | null
          member_provider_id: string | null
          member_raw_provider: Json | null
          member_status: string | null
          member_updated_at: string | null
          message_created_at: string | null
          message_deleted_at: string | null
          message_id: string | null
          message_metadata: Json | null
          message_provider: string | null
          message_provider_id: string | null
          message_raw_provider: Json | null
          message_ts: string | null
          message_type: string | null
          message_updated_at: string | null
          phone_e164: string | null
          profile_pic_url: string | null
          provider_member_id: string | null
          read_count: number | null
          reply_to_whatsapp_provider_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          text: string | null
          thumbnail_url: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      v_organization_contacts_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          email: string | null
          id: string | null
          is_primary: boolean | null
          name: string | null
          organization_id: string | null
          phone: string | null
          role_title: string | null
          updated_at: string | null
          updated_at_local: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          email?: string | null
          id?: string | null
          is_primary?: boolean | null
          name?: string | null
          organization_id?: string | null
          phone?: string | null
          role_title?: string | null
          updated_at?: string | null
          updated_at_local?: never
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          email?: string | null
          id?: string | null
          is_primary?: boolean | null
          name?: string | null
          organization_id?: string | null
          phone?: string | null
          role_title?: string | null
          updated_at?: string | null
          updated_at_local?: never
        }
        Relationships: [
          {
            foreignKeyName: "organization_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_organizations_br_time: {
        Row: {
          billing_plan: string | null
          billing_status: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_at_local: string | null
          current_period_end: string | null
          deleted_at: string | null
          id: string | null
          metadata: Json | null
          name: string | null
          owner_user_id: string | null
          plan: string | null
          settings: Json | null
          slug: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          updated_at_local: string | null
        }
        Insert: {
          billing_plan?: string | null
          billing_status?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_at_local?: never
          current_period_end?: string | null
          deleted_at?: string | null
          id?: string | null
          metadata?: Json | null
          name?: string | null
          owner_user_id?: string | null
          plan?: string | null
          settings?: Json | null
          slug?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          updated_at_local?: never
        }
        Update: {
          billing_plan?: string | null
          billing_status?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_at_local?: never
          current_period_end?: string | null
          deleted_at?: string | null
          id?: string | null
          metadata?: Json | null
          name?: string | null
          owner_user_id?: string | null
          plan?: string | null
          settings?: Json | null
          slug?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          updated_at_local?: never
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_poll_results: {
        Row: {
          option_index: number | null
          option_text: string | null
          poll_id: string | null
          votes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "v_polls_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_poll_summary: {
        Row: {
          poll_id: string | null
          selections_count: number | null
          vote_events_count: number | null
          voters_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "v_polls_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_poll_votes_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          id: string | null
          person_id: string | null
          poll_id: string | null
          provider: string | null
          voted_options: Json | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          id?: string | null
          person_id?: string | null
          poll_id?: string | null
          provider?: string | null
          voted_options?: Json | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          id?: string | null
          person_id?: string | null
          poll_id?: string | null
          provider?: string | null
          voted_options?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "v_polls_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_poll_votes_by_person: {
        Row: {
          created_at: string | null
          person_id: string | null
          person_name: string | null
          poll_id: string | null
          vote_sequence: number | null
          voted_options: Json | null
          votes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "poll_votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "v_polls_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_polls_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          created_by_person_id: string | null
          group_id: string | null
          id: string | null
          max_options: number | null
          provider: string | null
          question: string | null
          whatsapp_provider_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          created_by_person_id?: string | null
          group_id?: string | null
          id?: string | null
          max_options?: number | null
          provider?: string | null
          question?: string | null
          whatsapp_provider_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          created_by_person_id?: string | null
          group_id?: string | null
          id?: string | null
          max_options?: number | null
          provider?: string | null
          question?: string | null
          whatsapp_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_members_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_members"
            referencedColumns: ["member_id_resolved"]
          },
          {
            foreignKeyName: "polls_created_by_person_id_fkey"
            columns: ["created_by_person_id"]
            isOneToOne: false
            referencedRelation: "vw_groups_members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      v_profiles_br_time: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_at_local: string | null
          deleted_at: string | null
          id: string | null
          is_active: boolean | null
          last_login_at: string | null
          locale: string | null
          metadata: Json | null
          name: string | null
          phone_e164: string | null
          role_global: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
          updated_at_local: string | null
          whatsapp_verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          locale?: string | null
          metadata?: Json | null
          name?: string | null
          phone_e164?: string | null
          role_global?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_at_local?: never
          deleted_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          locale?: string | null
          metadata?: Json | null
          name?: string | null
          phone_e164?: string | null
          role_global?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          updated_at_local?: never
          whatsapp_verified_at?: string | null
        }
        Relationships: []
      }
      v_user_roles_br_time: {
        Row: {
          created_at: string | null
          created_at_local: string | null
          group_id: string | null
          id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_at_local?: never
          group_id?: string | null
          id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_at_local?: never
          group_id?: string | null
          id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_groups_members: {
        Row: {
          display_name: string | null
          group_id: string | null
          group_name: string | null
          is_admin: boolean | null
          is_owner: boolean | null
          is_super_admin: boolean | null
          joined_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_seen_message_at: string | null
          left_at: string | null
          member_id: string | null
          messages_count: number | null
          name: string | null
          organization_id: string | null
          phone_e164: string | null
          profile_pic_url: string | null
          provider: string | null
          provider_member_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_group_collaborators: {
        Row: {
          classification: string | null
          collaborator_ref: string | null
          display_name: string | null
          group_id: string | null
          is_admin: boolean | null
          is_owner: boolean | null
          is_super_admin: boolean | null
          member_id: string | null
          organization_id: string | null
          phone_e164: string | null
          profile_pic_url: string | null
          provider_member_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_overview"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_groups_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_org_collaborators: {
        Row: {
          classification: string | null
          collaborator_ref: string | null
          display_name: string | null
          group_ids: string[] | null
          groups_count: number | null
          organization_id: string | null
          phone_e164: string | null
          profile_pic_url: string | null
          provider_member_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_organizations_br_time"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activity_daily_org_admins: {
        Args: { _end: string; _start: string }
        Returns: { day: string; org_admins: number }[]
      }
      activity_org_admins: {
        Args: {
          _end: string
          _limit?: number
          _offset?: number
          _order_by?: string
          _order_dir?: string
          _org_id?: string
          _search?: string
          _start: string
        }
        Returns: {
          active_days: number
          last_activity_at: string | null
          last_login_at: string | null
          org_id: string
          org_name: string
          top_pages: string[]
          total_count: number
          user_id: string
          user_name: string | null
        }[]
      }
      activity_orgs: {
        Args: {
          _end: string
          _limit?: number
          _min_active_days: number
          _offset?: number
          _order_by?: string
          _order_dir?: string
          _recent_days: number
          _search?: string
          _start: string
          _status?: string
        }
        Returns: {
          active_days: number
          admins_active: number
          last_activity_at: string | null
          last_login_at: string | null
          org_id: string
          org_name: string
          status: string
          total_count: number
        }[]
      }
      activity_overview: {
        Args: {
          _end: string
          _min_active_days: number
          _recent_days: number
          _start: string
        }
        Returns: {
          logins: number
          org_admins_active: number
          orgs_active: number
          orgs_inactive: number
          orgs_total: number
          orgs_warm: number
          orgs_with_activity: number
          page_views: number
        }[]
      }
      activity_top_pages: {
        Args: { _end: string; _limit?: number; _start: string }
        Returns: { admins: number; page: string; page_views: number }[]
      }
      can_create_group: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      get_group_peak_moment: {
        Args: {
          p_end: string
          p_group_id: string
          p_start: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      get_system_signal_concentration: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: Json
      }
      has_group_access: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      has_org_access: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
      org_collaborator_group_kpis: {
        Args: { _end: string; _org_id: string; _start: string }
        Returns: {
          collaborator_ref: string
          group_id: string
          group_name: string
          messages_total: number
        }[]
      }
      org_collaborator_kpis: {
        Args: { _end: string; _org_id: string; _start: string }
        Returns: {
          classification: string
          collaborator_ref: string
          display_name: string
          groups_active: number
          groups_count: number
          messages_total: number
          phone_e164: string | null
          profile_pic_url: string | null
          provider_member_id: string | null
        }[]
      }
      org_team_collaborator_kpis: {
        Args: { _end: string; _org_id: string; _start: string }
        Returns: {
          collaborators_active: number
          collaborators_active_in_period: number
          collaborators_external: number
          collaborators_total: number
          messages_from_collaborators: number
          messages_total: number
        }[]
      }
    }
    Enums: {
      app_role: "SYSTEM_ADMIN" | "ORG_ADMIN" | "GROUP_MANAGER" | "USER"
      member_event_type:
        | "MEMBERSHIP_APPROVAL_REQUEST"
        | "REVOKED_MEMBERSHIP_REQUESTS"
        | "GROUP_PARTICIPANT_ADD"
        | "GROUP_PARTICIPANT_LEAVE"
        | "GROUP_PARTICIPANT_REMOVE"
        | "GROUP_PARTICIPANT_INVITE"
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
    Enums: {
      app_role: ["SYSTEM_ADMIN", "ORG_ADMIN", "GROUP_MANAGER", "USER"],
      member_event_type: [
        "MEMBERSHIP_APPROVAL_REQUEST",
        "REVOKED_MEMBERSHIP_REQUESTS",
        "GROUP_PARTICIPANT_ADD",
        "GROUP_PARTICIPANT_LEAVE",
        "GROUP_PARTICIPANT_REMOVE",
        "GROUP_PARTICIPANT_INVITE",
      ],
    },
  },
} as const
