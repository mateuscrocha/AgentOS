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
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
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
          whatsapp_provider_id: string | null
          provider_phone: string | null
          raw_provider: Json | null
          status: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
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
          whatsapp_provider_id?: string | null
          provider_phone?: string | null
          raw_provider?: Json | null
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
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
          whatsapp_provider_id?: string | null
          provider_phone?: string | null
          raw_provider?: Json | null
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["member_event_type"]
          external_member_id: string
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
          external_member_id: string
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
          external_member_id?: string
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
            foreignKeyName: "member_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
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
          whatsapp_provider_id: string | null
          raw_provider: Json | null
          status: string | null
          updated_at: string
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
          whatsapp_provider_id?: string | null
          raw_provider?: Json | null
          status?: string | null
          updated_at?: string
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
          whatsapp_provider_id?: string | null
          raw_provider?: Json | null
          status?: string | null
          updated_at?: string
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
          whatsapp_provider_id: string | null
          provider_reaction_key: string | null
          raw_provider: Json | null
          reacted_at: string
          removed_at: string | null
          status: string | null
          updated_at: string
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
          whatsapp_provider_id?: string | null
          provider_reaction_key?: string | null
          raw_provider?: Json | null
          reacted_at?: string
          removed_at?: string | null
          status?: string | null
          updated_at?: string
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
          whatsapp_provider_id?: string | null
          provider_reaction_key?: string | null
          raw_provider?: Json | null
          reacted_at?: string
          removed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
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
          chat_whatsapp_provider_id: string | null
          whatsapp_provider_id: string | null
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
        }
        Insert: {
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
          chat_whatsapp_provider_id?: string | null
          whatsapp_provider_id?: string | null
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
        }
        Update: {
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
          chat_whatsapp_provider_id?: string | null
          whatsapp_provider_id?: string | null
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
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
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
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
          whatsapp_provider_id: string | null
          sync_status: string | null
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
          whatsapp_provider_id?: string | null
          sync_status?: string | null
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
          whatsapp_provider_id?: string | null
          sync_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          whatsapp_provider_id: string | null
          reacted_at: string | null
          reaction_id: string | null
          reaction_status: string | null
          removed_at: string | null
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
          whatsapp_provider_id: string | null
          sender_phone: string | null
          status: string | null
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
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
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
    }
    Enums: {
      app_role: "SYSTEM_ADMIN" | "ORG_ADMIN" | "GROUP_MANAGER" | "USER"
      member_event_type:
        | "MEMBERSHIP_APPROVAL_REQUEST"
        | "REVOKED_MEMBERSHIP_REQUESTS"
        | "GROUP_PARTICIPANT_ADD"
        | "GROUP_PARTICIPANT_INVITE"
        | "GROUP_PARTICIPANT_LEAVE"
        | "GROUP_PARTICIPANT_REMOVE"
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
        "GROUP_PARTICIPANT_INVITE",
        "GROUP_PARTICIPANT_LEAVE",
        "GROUP_PARTICIPANT_REMOVE",
      ],
    },
  },
} as const
