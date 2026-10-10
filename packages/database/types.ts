export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  access: {
    Tables: {
      oauth_clients: {
        Row: {
          areas: string[];
          client_id: string;
          contact_email: string;
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          name_ar: string | null;
          name_en: string;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          areas?: string[];
          client_id: string;
          contact_email: string;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          name_ar?: string | null;
          name_en: string;
          note?: string | null;
          updated_at?: string;
        };
        Update: {
          areas?: string[];
          client_id?: string;
          contact_email?: string;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          name_ar?: string | null;
          name_en?: string;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          description: string;
          key: string;
        };
        Insert: {
          description: string;
          key: string;
        };
        Update: {
          description?: string;
          key?: string;
        };
        Relationships: [];
      };
      role_assignments: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          ends_at: string | null;
          exception_resolution_id: string | null;
          id: string;
          note: string | null;
          role: string;
          scope_id: string | null;
          scope_type: string;
          starts_at: string;
          title_ar: string | null;
          title_en: string | null;
          user_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          ends_at?: string | null;
          exception_resolution_id?: string | null;
          id?: string;
          note?: string | null;
          role: string;
          scope_id?: string | null;
          scope_type?: string;
          starts_at?: string;
          title_ar?: string | null;
          title_en?: string | null;
          user_id: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          ends_at?: string | null;
          exception_resolution_id?: string | null;
          id?: string;
          note?: string | null;
          role?: string;
          scope_id?: string | null;
          scope_type?: string;
          starts_at?: string;
          title_ar?: string | null;
          title_en?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_assignments_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["key"];
          },
        ];
      };
      role_permissions: {
        Row: {
          permission: string;
          role: string;
        };
        Insert: {
          permission: string;
          role: string;
        };
        Update: {
          permission?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey";
            columns: ["permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "role_permissions_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["key"];
          },
        ];
      };
      roles: {
        Row: {
          description: string | null;
          is_council: boolean;
          key: string;
          name_ar: string;
          name_en: string;
          requires_mfa: boolean;
          sort: number;
          spending_limit_iqd: number | null;
        };
        Insert: {
          description?: string | null;
          is_council?: boolean;
          key: string;
          name_ar: string;
          name_en: string;
          requires_mfa?: boolean;
          sort?: number;
          spending_limit_iqd?: number | null;
        };
        Update: {
          description?: string | null;
          is_council?: boolean;
          key?: string;
          name_ar?: string;
          name_en?: string;
          requires_mfa?: boolean;
          sort?: number;
          spending_limit_iqd?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assign_role: {
        Args: {
          ends_at?: string;
          exception_resolution?: string;
          note?: string;
          role_key: string;
          scope_id?: string;
          scope_type?: string;
          starts_at?: string;
          target_user: string;
          title_ar?: string;
          title_en?: string;
        };
        Returns: string;
      };
      bootstrap_founder: { Args: { email: string }; Returns: string };
      end_role_assignment: {
        Args: { assignment_id: string; ends_at?: string };
        Returns: undefined;
      };
      has_permission: {
        Args: { permission: string; scope_id?: string; scope_type?: string };
        Returns: boolean;
      };
      has_permission_anywhere: {
        Args: { permission: string };
        Returns: boolean;
      };
      my_permissions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          permission: string;
          scope_id: string;
          scope_type: string;
        }[];
      };
      needs_two_step: { Args: Record<PropertyKey, never>; Returns: boolean };
      notion_publisher: {
        Args: {
          email: string;
          permission: string;
          scope_id?: string;
          scope_type?: string;
        };
        Returns: string;
      };
      oauth_client_info: {
        Args: { client_id: string };
        Returns: {
          areas: string[];
          enabled: boolean;
          name_ar: string;
          name_en: string;
        }[];
      };
      officer_directory: {
        Args: Record<PropertyKey, never>;
        Returns: {
          council: boolean;
          email: string;
          full_name_ar: string;
          full_name_en: string;
          roles: string[];
          term_ends: string;
          term_starts: string;
          user_id: string;
        }[];
      };
      permission_holders: {
        Args: { permission: string; scope_id?: string; scope_type?: string };
        Returns: {
          user_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  charity: {
    Tables: {
      campaigns: {
        Row: {
          cost_per_unit_iqd: number | null;
          created_at: string;
          ends_on: string | null;
          id: string;
          partner_id: string | null;
          price_list: NonNullable<Json>;
          programme_id: string | null;
          slug: string;
          starts_on: string | null;
          status: string;
          summary_ar: string | null;
          summary_en: string | null;
          target_units: number | null;
          title_ar: string;
          title_en: string;
          unit_label_ar: string;
          unit_label_en: string;
          updated_at: string;
        };
        Insert: {
          cost_per_unit_iqd?: number | null;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          partner_id?: string | null;
          price_list?: NonNullable<Json>;
          programme_id?: string | null;
          slug: string;
          starts_on?: string | null;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          target_units?: number | null;
          title_ar: string;
          title_en: string;
          unit_label_ar?: string;
          unit_label_en?: string;
          updated_at?: string;
        };
        Update: {
          cost_per_unit_iqd?: number | null;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          partner_id?: string | null;
          price_list?: NonNullable<Json>;
          programme_id?: string | null;
          slug?: string;
          starts_on?: string | null;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          target_units?: number | null;
          title_ar?: string;
          title_en?: string;
          unit_label_ar?: string;
          unit_label_en?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      impact_metrics: {
        Row: {
          campaign_id: string;
          created_at: string;
          id: string;
          label_ar: string;
          label_en: string;
          published_at: string | null;
          report_ar: string | null;
          report_en: string | null;
          sort: number;
          unit_ar: string | null;
          unit_en: string | null;
          updated_at: string;
          value: number;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          id?: string;
          label_ar: string;
          label_en: string;
          published_at?: string | null;
          report_ar?: string | null;
          report_en?: string | null;
          sort?: number;
          unit_ar?: string | null;
          unit_en?: string | null;
          updated_at?: string;
          value: number;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          id?: string;
          label_ar?: string;
          label_en?: string;
          published_at?: string | null;
          report_ar?: string | null;
          report_en?: string | null;
          sort?: number;
          unit_ar?: string | null;
          unit_en?: string | null;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "impact_metrics_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount_iqd: number;
          campaign_id: string;
          counted_by: string;
          counted_with: string;
          created_at: string;
          created_by: string;
          id: string;
          note: string | null;
          occurred_on: string;
          reverses_entry_id: string | null;
          source: Database["charity"]["Enums"]["source"];
        };
        Insert: {
          amount_iqd: number;
          campaign_id: string;
          counted_by: string;
          counted_with: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string | null;
          occurred_on?: string;
          reverses_entry_id?: string | null;
          source: Database["charity"]["Enums"]["source"];
        };
        Update: {
          amount_iqd?: number;
          campaign_id?: string;
          counted_by?: string;
          counted_with?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string | null;
          occurred_on?: string;
          reverses_entry_id?: string | null;
          source?: Database["charity"]["Enums"]["source"];
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_reverses_entry_id_fkey";
            columns: ["reverses_entry_id"];
            isOneToOne: true;
            referencedRelation: "ledger_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_signoffs: {
        Row: {
          entry_id: string;
          signed_at: string;
          signed_by: string;
        };
        Insert: {
          entry_id: string;
          signed_at?: string;
          signed_by?: string;
        };
        Update: {
          entry_id?: string;
          signed_at?: string;
          signed_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_signoffs_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: true;
            referencedRelation: "ledger_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      partners: {
        Row: {
          created_at: string;
          description_ar: string | null;
          description_en: string | null;
          id: string;
          logo_path: string | null;
          name_ar: string;
          name_en: string;
          slug: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          logo_path?: string | null;
          name_ar: string;
          name_en: string;
          slug: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          logo_path?: string | null;
          name_ar?: string;
          name_en?: string;
          slug?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      receipts: {
        Row: {
          amount_iqd: number | null;
          campaign_id: string;
          created_at: string;
          description_ar: string | null;
          description_en: string;
          id: string;
          is_public: boolean;
          ledger_entry_id: string | null;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          amount_iqd?: number | null;
          campaign_id: string;
          created_at?: string;
          description_ar?: string | null;
          description_en: string;
          id?: string;
          is_public?: boolean;
          ledger_entry_id?: string | null;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          amount_iqd?: number | null;
          campaign_id?: string;
          created_at?: string;
          description_ar?: string | null;
          description_en?: string;
          id?: string;
          is_public?: boolean;
          ledger_entry_id?: string | null;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_ledger_entry_id_fkey";
            columns: ["ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "ledger_entries";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      campaign_progress: {
        Args: { campaign_id?: string };
        Returns: {
          campaign_id: string;
          cost_per_unit_iqd: number;
          counted_iqd: number;
          pending_iqd: number;
          target_units: number;
          units: number;
        }[];
      };
    };
    Enums: {
      source:
        | "table_cash"
        | "stickers"
        | "blind_date"
        | "fill_a_bag"
        | "book_sales"
        | "donation"
        | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  content: {
    Tables: {
      announcements: {
        Row: {
          audience: string;
          body_ar: string | null;
          body_en: string | null;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          is_banner: boolean;
          link: string | null;
          starts_at: string;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          audience?: string;
          body_ar?: string | null;
          body_en?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          is_banner?: boolean;
          link?: string | null;
          starts_at?: string;
          title_ar: string;
          title_en: string;
        };
        Update: {
          audience?: string;
          body_ar?: string | null;
          body_en?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          is_banner?: boolean;
          link?: string | null;
          starts_at?: string;
          title_ar?: string;
          title_en?: string;
        };
        Relationships: [];
      };
      document_sections: {
        Row: {
          anchor: string;
          body: string;
          code: string;
          id: string;
          locale: string;
          path: string;
          search: unknown;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          anchor?: string;
          body: string;
          code: string;
          id?: string;
          locale: string;
          path: string;
          search?: never;
          status: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          anchor?: string;
          body?: string;
          code?: string;
          id?: string;
          locale?: string;
          path?: string;
          search?: never;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      homepage_slots: {
        Row: {
          body_ar: string | null;
          body_en: string | null;
          key: string;
          link: string | null;
          ref_id: string | null;
          ref_type: string | null;
          sort: number;
          title_ar: string | null;
          title_en: string | null;
          updated_at: string;
        };
        Insert: {
          body_ar?: string | null;
          body_en?: string | null;
          key: string;
          link?: string | null;
          ref_id?: string | null;
          ref_type?: string | null;
          sort?: number;
          title_ar?: string | null;
          title_en?: string | null;
          updated_at?: string;
        };
        Update: {
          body_ar?: string | null;
          body_en?: string | null;
          key?: string;
          link?: string | null;
          ref_id?: string | null;
          ref_type?: string | null;
          sort?: number;
          title_ar?: string | null;
          title_en?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          alt_ar: string;
          alt_en: string;
          consent_note: string | null;
          created_at: string;
          height: number | null;
          id: string;
          mime_type: string;
          storage_path: string;
          uploaded_by: string | null;
          width: number | null;
        };
        Insert: {
          alt_ar?: string;
          alt_en?: string;
          consent_note?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type: string;
          storage_path: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Update: {
          alt_ar?: string;
          alt_en?: string;
          consent_note?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type?: string;
          storage_path?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Relationships: [];
      };
      news_posts: {
        Row: {
          author_id: string | null;
          body_ar: string | null;
          body_en: string | null;
          cover_path: string | null;
          created_at: string;
          excerpt_ar: string | null;
          excerpt_en: string | null;
          id: string;
          programme_id: string | null;
          publish_at: string | null;
          published_at: string | null;
          search: unknown;
          slug: string;
          status: string;
          title_ar: string;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body_ar?: string | null;
          body_en?: string | null;
          cover_path?: string | null;
          created_at?: string;
          excerpt_ar?: string | null;
          excerpt_en?: string | null;
          id?: string;
          programme_id?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          search?: never;
          slug: string;
          status?: string;
          title_ar: string;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body_ar?: string | null;
          body_en?: string | null;
          cover_path?: string | null;
          created_at?: string;
          excerpt_ar?: string | null;
          excerpt_en?: string | null;
          id?: string;
          programme_id?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          search?: never;
          slug?: string;
          status?: string;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          body_ar: string | null;
          body_en: string | null;
          created_at: string;
          id: string;
          published_at: string | null;
          slug: string;
          status: string;
          title_ar: string;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          body_ar?: string | null;
          body_en?: string | null;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          slug: string;
          status?: string;
          title_ar: string;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          body_ar?: string | null;
          body_en?: string | null;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          slug?: string;
          status?: string;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search: {
        Args: { max_results?: number; query: string };
        Returns: {
          id: string;
          kind: string;
          occurred_at: string;
          rank: number;
          slug: string;
          snippet: string;
          title_ar: string;
          title_en: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  core: {
    Tables: {
      activity_log: {
        Row: {
          actor_id: string | null;
          id: number;
          new_row: Json | null;
          occurred_at: string;
          old_row: Json | null;
          operation: string;
          row_id: string | null;
          table_name: string;
          table_schema: string;
        };
        Insert: {
          actor_id?: string | null;
          id?: never;
          new_row?: Json | null;
          occurred_at?: string;
          old_row?: Json | null;
          operation: string;
          row_id?: string | null;
          table_name: string;
          table_schema: string;
        };
        Update: {
          actor_id?: string | null;
          id?: never;
          new_row?: Json | null;
          occurred_at?: string;
          old_row?: Json | null;
          operation?: string;
          row_id?: string | null;
          table_name?: string;
          table_schema?: string;
        };
        Relationships: [];
      };
      blackouts: {
        Row: {
          ends_on: string;
          id: string;
          label_ar: string;
          label_en: string;
          semester_id: string;
          starts_on: string;
        };
        Insert: {
          ends_on: string;
          id?: string;
          label_ar: string;
          label_en: string;
          semester_id: string;
          starts_on: string;
        };
        Update: {
          ends_on?: string;
          id?: string;
          label_ar?: string;
          label_en?: string;
          semester_id?: string;
          starts_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blackouts_semester_id_fkey";
            columns: ["semester_id"];
            isOneToOne: false;
            referencedRelation: "semesters";
            referencedColumns: ["id"];
          },
        ];
      };
      external_events: {
        Row: {
          all_day: boolean;
          ends_at: string | null;
          id: string;
          location: string | null;
          source: string;
          starts_at: string;
          synced_at: string;
          title: string;
          uid: string;
          url: string | null;
        };
        Insert: {
          all_day?: boolean;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          source: string;
          starts_at: string;
          synced_at?: string;
          title: string;
          uid: string;
          url?: string | null;
        };
        Update: {
          all_day?: boolean;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          source?: string;
          starts_at?: string;
          synced_at?: string;
          title?: string;
          uid?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      notion_links: {
        Row: {
          content_hash: string | null;
          kind: string;
          notion_page_id: string;
          record_key: string;
          synced_at: string;
        };
        Insert: {
          content_hash?: string | null;
          kind: string;
          notion_page_id: string;
          record_key: string;
          synced_at?: string;
        };
        Update: {
          content_hash?: string | null;
          kind?: string;
          notion_page_id?: string;
          record_key?: string;
          synced_at?: string;
        };
        Relationships: [];
      };
      outbox: {
        Row: {
          attempts: number;
          created_at: string;
          id: number;
          kind: string;
          last_error: string | null;
          payload: NonNullable<Json>;
          processed_at: string | null;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind: string;
          last_error?: string | null;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind?: string;
          last_error?: string | null;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          camera_shy: boolean;
          created_at: string;
          full_name_ar: string | null;
          full_name_en: string;
          id: string;
          locale: string;
          notify_email: boolean;
          personal_email: string | null;
          setup_completed_at: string | null;
          updated_at: string;
          verified_at: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          camera_shy?: boolean;
          created_at?: string;
          full_name_ar?: string | null;
          full_name_en?: string;
          id: string;
          locale?: string;
          notify_email?: boolean;
          personal_email?: string | null;
          setup_completed_at?: string | null;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          camera_shy?: boolean;
          created_at?: string;
          full_name_ar?: string | null;
          full_name_en?: string;
          id?: string;
          locale?: string;
          notify_email?: boolean;
          personal_email?: string | null;
          setup_completed_at?: string | null;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      programmes: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          name_ar: string;
          name_en: string;
          slug: string;
          sort: number;
          summary_ar: string | null;
          summary_en: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind: string;
          name_ar: string;
          name_en: string;
          slug: string;
          sort?: number;
          summary_ar?: string | null;
          summary_en?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name_ar?: string;
          name_en?: string;
          slug?: string;
          sort?: number;
          summary_ar?: string | null;
          summary_en?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          label: string | null;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          label?: string | null;
          p256dh: string;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          label?: string | null;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      semesters: {
        Row: {
          code: string;
          created_at: string;
          ends_on: string;
          id: string;
          name_ar: string;
          name_en: string;
          starts_on: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          ends_on: string;
          id?: string;
          name_ar: string;
          name_en: string;
          starts_on: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          ends_on?: string;
          id?: string;
          name_ar?: string;
          name_en?: string;
          starts_on?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          description: string | null;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        Insert: {
          description?: string | null;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string | null;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      current_semester: {
        Args: Record<PropertyKey, never>;
        Returns: {
          code: string;
          created_at: string;
          ends_on: string;
          id: string;
          name_ar: string;
          name_en: string;
          starts_on: string;
        };
        SetofOptions: {
          from: "*";
          to: "semesters";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      my_private_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          notify_email: boolean;
          personal_email: string;
        }[];
      };
      previous_semester: {
        Args: Record<PropertyKey, never>;
        Returns: {
          code: string;
          created_at: string;
          ends_on: string;
          id: string;
          name_ar: string;
          name_en: string;
          starts_on: string;
        };
        SetofOptions: {
          from: "*";
          to: "semesters";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_push_subscription: {
        Args: {
          auth: string;
          endpoint: string;
          label?: string;
          p256dh: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  events: {
    Tables: {
      campus_events: {
        Row: {
          all_day: boolean;
          description: string | null;
          ends_at: string | null;
          fetched_at: string;
          id: string;
          location: string | null;
          starts_at: string;
          title: string;
          uid: string;
          url: string | null;
        };
        Insert: {
          all_day?: boolean;
          description?: string | null;
          ends_at?: string | null;
          fetched_at?: string;
          id?: string;
          location?: string | null;
          starts_at: string;
          title: string;
          uid: string;
          url?: string | null;
        };
        Update: {
          all_day?: boolean;
          description?: string | null;
          ends_at?: string | null;
          fetched_at?: string;
          id?: string;
          location?: string | null;
          starts_at?: string;
          title?: string;
          uid?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      check_ins: {
        Row: {
          checked_in_at: string;
          checked_in_by: string | null;
          event_id: string;
          id: string;
          method: string;
          rsvp_id: string | null;
          user_id: string;
        };
        Insert: {
          checked_in_at?: string;
          checked_in_by?: string | null;
          event_id: string;
          id?: string;
          method: string;
          rsvp_id?: string | null;
          user_id: string;
        };
        Update: {
          checked_in_at?: string;
          checked_in_by?: string | null;
          event_id?: string;
          id?: string;
          method?: string;
          rsvp_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_ins_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_ins_rsvp_id_fkey";
            columns: ["rsvp_id"];
            isOneToOne: false;
            referencedRelation: "rsvps";
            referencedColumns: ["id"];
          },
        ];
      };
      event_staff: {
        Row: {
          added_by: string | null;
          duty: string | null;
          event_id: string;
          user_id: string;
        };
        Insert: {
          added_by?: string | null;
          duty?: string | null;
          event_id: string;
          user_id: string;
        };
        Update: {
          added_by?: string | null;
          duty?: string | null;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          body_ar: string | null;
          body_en: string | null;
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          image_path: string | null;
          members_only: boolean;
          programme_id: string | null;
          published_at: string | null;
          questions: NonNullable<Json>;
          rsvp_enabled: boolean;
          search: unknown;
          slug: string;
          starts_at: string;
          status: string;
          summary_ar: string | null;
          summary_en: string | null;
          title_ar: string;
          title_en: string;
          updated_at: string;
          venue_ar: string | null;
          venue_en: string | null;
        };
        Insert: {
          body_ar?: string | null;
          body_en?: string | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_path?: string | null;
          members_only?: boolean;
          programme_id?: string | null;
          published_at?: string | null;
          questions?: NonNullable<Json>;
          rsvp_enabled?: boolean;
          search?: never;
          slug: string;
          starts_at: string;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar: string;
          title_en: string;
          updated_at?: string;
          venue_ar?: string | null;
          venue_en?: string | null;
        };
        Update: {
          body_ar?: string | null;
          body_en?: string | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_path?: string | null;
          members_only?: boolean;
          programme_id?: string | null;
          published_at?: string | null;
          questions?: NonNullable<Json>;
          rsvp_enabled?: boolean;
          search?: never;
          slug?: string;
          starts_at?: string;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
          venue_ar?: string | null;
          venue_en?: string | null;
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          answers: NonNullable<Json>;
          cancelled_at: string | null;
          created_at: string;
          event_id: string;
          from_waitlist: boolean;
          id: string;
          status: string;
          ticket_code: string;
          user_id: string;
        };
        Insert: {
          answers?: NonNullable<Json>;
          cancelled_at?: string | null;
          created_at?: string;
          event_id: string;
          from_waitlist?: boolean;
          id?: string;
          status?: string;
          ticket_code?: string;
          user_id: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          cancelled_at?: string | null;
          created_at?: string;
          event_id?: string;
          from_waitlist?: boolean;
          id?: string;
          status?: string;
          ticket_code?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist: {
        Row: {
          answers: NonNullable<Json>;
          created_at: string;
          event_id: string;
          id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          answers?: NonNullable<Json>;
          created_at?: string;
          event_id: string;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          created_at?: string;
          event_id?: string;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_rsvp: { Args: { event_id: string }; Returns: undefined };
      check_in: {
        Args: { event_id: string; target_user?: string; ticket_code?: string };
        Returns: {
          already: boolean;
          full_name_ar: string;
          full_name_en: string;
          user_id: string;
        }[];
      };
      confirmed_count: { Args: { event_id: string }; Returns: number };
      find_attendee: {
        Args: { event_id: string; query: string };
        Returns: {
          email: string;
          full_name_ar: string;
          full_name_en: string;
          has_rsvp: boolean;
          user_id: string;
        }[];
      };
      rsvp: { Args: { answers?: Json; event_id: string }; Returns: string };
      waitlist_position: { Args: { event_id: string }; Returns: number };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  governance: {
    Tables: {
      ballot_receipts: {
        Row: {
          election_id: string;
          user_id: string;
        };
        Insert: {
          election_id: string;
          user_id: string;
        };
        Update: {
          election_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ballot_receipts_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
        ];
      };
      ballots: {
        Row: {
          choices: NonNullable<Json>;
          election_id: string;
          id: string;
        };
        Insert: {
          choices: NonNullable<Json>;
          election_id: string;
          id?: string;
        };
        Update: {
          choices?: NonNullable<Json>;
          election_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ballots_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          position_id: string;
          statement_ar: string | null;
          statement_en: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          position_id: string;
          statement_ar?: string | null;
          statement_en?: string | null;
          status?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          position_id?: string;
          statement_ar?: string | null;
          statement_en?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidates_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      conflict_declarations: {
        Row: {
          created_at: string;
          id: string;
          nothing_to_declare: boolean;
          received_at: string | null;
          received_by: string | null;
          role_title: string | null;
          semester_id: string | null;
          signed_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nothing_to_declare?: boolean;
          received_at?: string | null;
          received_by?: string | null;
          role_title?: string | null;
          semester_id?: string | null;
          signed_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nothing_to_declare?: boolean;
          received_at?: string | null;
          received_by?: string | null;
          role_title?: string | null;
          semester_id?: string | null;
          signed_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      conflict_items: {
        Row: {
          affects: string | null;
          closed_on: string | null;
          created_at: string;
          declaration_id: string;
          handling: string | null;
          id: string;
          kind: string;
          partner_id: string | null;
          what: string;
        };
        Insert: {
          affects?: string | null;
          closed_on?: string | null;
          created_at?: string;
          declaration_id: string;
          handling?: string | null;
          id?: string;
          kind: string;
          partner_id?: string | null;
          what: string;
        };
        Update: {
          affects?: string | null;
          closed_on?: string | null;
          created_at?: string;
          declaration_id?: string;
          handling?: string | null;
          id?: string;
          kind?: string;
          partner_id?: string | null;
          what?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conflict_items_declaration_id_fkey";
            columns: ["declaration_id"];
            isOneToOne: false;
            referencedRelation: "conflict_declarations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conflict_items_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      council_terms: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          name_ar: string;
          name_en: string;
          starts_on: string;
        };
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          name_ar: string;
          name_en: string;
          starts_on: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          name_ar?: string;
          name_en?: string;
          starts_on?: string;
        };
        Relationships: [];
      };
      election_results: {
        Row: {
          ballots_counted: number;
          computed_at: string;
          election_id: string;
          position_id: string;
          ron_won: boolean;
          rounds: NonNullable<Json>;
          winner_candidate_id: string | null;
        };
        Insert: {
          ballots_counted: number;
          computed_at?: string;
          election_id: string;
          position_id: string;
          ron_won?: boolean;
          rounds: NonNullable<Json>;
          winner_candidate_id?: string | null;
        };
        Update: {
          ballots_counted?: number;
          computed_at?: string;
          election_id?: string;
          position_id?: string;
          ron_won?: boolean;
          rounds?: NonNullable<Json>;
          winner_candidate_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "election_results_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "election_results_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "election_results_winner_candidate_id_fkey";
            columns: ["winner_candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      elections: {
        Row: {
          created_at: string;
          created_by: string | null;
          eligible_count: number | null;
          id: string;
          nominations_close_at: string;
          nominations_open_at: string;
          notice_given_at: string | null;
          status: string;
          title_ar: string;
          title_en: string;
          updated_at: string;
          voting_closes_at: string;
          voting_opens_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          eligible_count?: number | null;
          id?: string;
          nominations_close_at: string;
          nominations_open_at: string;
          notice_given_at?: string | null;
          status?: string;
          title_ar: string;
          title_en: string;
          updated_at?: string;
          voting_closes_at: string;
          voting_opens_at: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          eligible_count?: number | null;
          id?: string;
          nominations_close_at?: string;
          nominations_open_at?: string;
          notice_given_at?: string | null;
          status?: string;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
          voting_closes_at?: string;
          voting_opens_at?: string;
        };
        Relationships: [];
      };
      form_submissions: {
        Row: {
          acknowledged_at: string | null;
          closed_at: string | null;
          created_at: string;
          data: NonNullable<Json>;
          form_key: string;
          handled_by: string | null;
          id: string;
          office: NonNullable<Json>;
          routing: string;
          status: string;
          subject_user_id: string | null;
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          form_key: string;
          handled_by?: string | null;
          id?: string;
          office?: NonNullable<Json>;
          routing?: string;
          status?: string;
          subject_user_id?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          form_key?: string;
          handled_by?: string | null;
          id?: string;
          office?: NonNullable<Json>;
          routing?: string;
          status?: string;
          subject_user_id?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_key_fkey";
            columns: ["form_key"];
            isOneToOne: false;
            referencedRelation: "form_types";
            referencedColumns: ["key"];
          },
        ];
      };
      form_types: {
        Row: {
          acknowledge_days: number | null;
          anonymous_ok: boolean;
          answer_days: number | null;
          code: string;
          handle_permission: string;
          key: string;
          ongoing: boolean;
          sort: number;
          subject_reads: boolean;
          submit_rule: string;
        };
        Insert: {
          acknowledge_days?: number | null;
          anonymous_ok?: boolean;
          answer_days?: number | null;
          code: string;
          handle_permission: string;
          key: string;
          ongoing?: boolean;
          sort?: number;
          subject_reads?: boolean;
          submit_rule: string;
        };
        Update: {
          acknowledge_days?: number | null;
          anonymous_ok?: boolean;
          answer_days?: number | null;
          code?: string;
          handle_permission?: string;
          key?: string;
          ongoing?: boolean;
          sort?: number;
          subject_reads?: boolean;
          submit_rule?: string;
        };
        Relationships: [];
      };
      handbook_pages: {
        Row: {
          body_ar: string | null;
          body_en: string;
          created_at: string;
          id: string;
          section: string;
          slug: string;
          sort: number;
          summary_ar: string | null;
          summary_en: string | null;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          body_ar?: string | null;
          body_en?: string;
          created_at?: string;
          id?: string;
          section: string;
          slug: string;
          sort?: number;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body_ar?: string | null;
          body_en?: string;
          created_at?: string;
          id?: string;
          section?: string;
          slug?: string;
          sort?: number;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      library_documents: {
        Row: {
          audience: string;
          code: string | null;
          created_at: string;
          id: string;
          status: string;
          storage_path: string;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
          uploaded_by: string | null;
          version: string;
        };
        Insert: {
          audience: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          storage_path: string;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
          uploaded_by?: string | null;
          version?: string;
        };
        Update: {
          audience?: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          storage_path?: string;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
          uploaded_by?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      member_offers: {
        Row: {
          code: string | null;
          created_at: string;
          details_ar: string | null;
          details_en: string;
          ends_on: string | null;
          id: string;
          is_published: boolean;
          partner_id: string;
          starts_on: string;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          details_ar?: string | null;
          details_en: string;
          ends_on?: string | null;
          id?: string;
          is_published?: boolean;
          partner_id: string;
          starts_on?: string;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          details_ar?: string | null;
          details_en?: string;
          ends_on?: string | null;
          id?: string;
          is_published?: boolean;
          partner_id?: string;
          starts_on?: string;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_offers_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      minutes: {
        Row: {
          adopted_on: string | null;
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          meeting_on: string;
          status: string;
          text_ar: string | null;
          text_en: string;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          adopted_on?: string | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_on: string;
          status?: string;
          text_ar?: string | null;
          text_en?: string;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          adopted_on?: string | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_on?: string;
          status?: string;
          text_ar?: string | null;
          text_en?: string;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partner_affiliations: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          note: string | null;
          partner_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          note?: string | null;
          partner_id: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          note?: string | null;
          partner_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_affiliations_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_agreements: {
        Row: {
          branding: string | null;
          code: string | null;
          created_at: string;
          created_by: string | null;
          end_reason: string | null;
          ended_on: string | null;
          ends_on: string | null;
          grants: string[];
          id: string;
          money: string | null;
          partner_contact: string | null;
          partner_id: string;
          partner_signatory: string | null;
          partner_will: string | null;
          people_safety: string | null;
          purpose_ar: string | null;
          purpose_en: string;
          renew_by: string | null;
          sal_contact: string | null;
          sal_will: string | null;
          signed_at: string | null;
          signed_by: string | null;
          signed_document_path: string | null;
          starts_on: string;
          status: string;
          student_life_informed_on: string | null;
          updated_at: string;
        };
        Insert: {
          branding?: string | null;
          code?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_reason?: string | null;
          ended_on?: string | null;
          ends_on?: string | null;
          grants?: string[];
          id?: string;
          money?: string | null;
          partner_contact?: string | null;
          partner_id: string;
          partner_signatory?: string | null;
          partner_will?: string | null;
          people_safety?: string | null;
          purpose_ar?: string | null;
          purpose_en: string;
          renew_by?: string | null;
          sal_contact?: string | null;
          sal_will?: string | null;
          signed_at?: string | null;
          signed_by?: string | null;
          signed_document_path?: string | null;
          starts_on: string;
          status?: string;
          student_life_informed_on?: string | null;
          updated_at?: string;
        };
        Update: {
          branding?: string | null;
          code?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_reason?: string | null;
          ended_on?: string | null;
          ends_on?: string | null;
          grants?: string[];
          id?: string;
          money?: string | null;
          partner_contact?: string | null;
          partner_id?: string;
          partner_signatory?: string | null;
          partner_will?: string | null;
          people_safety?: string | null;
          purpose_ar?: string | null;
          purpose_en?: string;
          renew_by?: string | null;
          sal_contact?: string | null;
          sal_will?: string | null;
          signed_at?: string | null;
          signed_by?: string | null;
          signed_document_path?: string | null;
          starts_on?: string;
          status?: string;
          student_life_informed_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_agreements_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      partners: {
        Row: {
          contact_email: string | null;
          contact_name: string | null;
          contact_role: string | null;
          created_at: string;
          description_ar: string | null;
          description_en: string | null;
          id: string;
          is_listed: boolean;
          kind: string;
          lead_id: string | null;
          logo_path: string | null;
          name_ar: string | null;
          name_en: string;
          notes: string | null;
          reach: string;
          slug: string;
          status: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          contact_email?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          created_at?: string;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          is_listed?: boolean;
          kind: string;
          lead_id?: string | null;
          logo_path?: string | null;
          name_ar?: string | null;
          name_en: string;
          notes?: string | null;
          reach?: string;
          slug: string;
          status?: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          contact_email?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          created_at?: string;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          is_listed?: boolean;
          kind?: string;
          lead_id?: string | null;
          logo_path?: string | null;
          name_ar?: string | null;
          name_en?: string;
          notes?: string | null;
          reach?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      positions: {
        Row: {
          election_id: string;
          id: string;
          role_key: string;
          sort: number;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          election_id: string;
          id?: string;
          role_key: string;
          sort?: number;
          title_ar: string;
          title_en: string;
        };
        Update: {
          election_id?: string;
          id?: string;
          role_key?: string;
          sort?: number;
          title_ar?: string;
          title_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
        ];
      };
      resolutions: {
        Row: {
          adopted_on: string | null;
          body: string;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          minutes_id: string | null;
          status: string;
          text_ar: string | null;
          text_en: string;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
          votes_abstain: number | null;
          votes_against: number | null;
          votes_for: number | null;
        };
        Insert: {
          adopted_on?: string | null;
          body?: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          minutes_id?: string | null;
          status?: string;
          text_ar?: string | null;
          text_en: string;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
          votes_abstain?: number | null;
          votes_against?: number | null;
          votes_for?: number | null;
        };
        Update: {
          adopted_on?: string | null;
          body?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          minutes_id?: string | null;
          status?: string;
          text_ar?: string | null;
          text_en?: string;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
          votes_abstain?: number | null;
          votes_against?: number | null;
          votes_for?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "resolutions_minutes_id_fkey";
            columns: ["minutes_id"];
            isOneToOne: false;
            referencedRelation: "minutes";
            referencedColumns: ["id"];
          },
        ];
      };
      society_documents: {
        Row: {
          adopted_on: string | null;
          audience: string;
          body_ar: string | null;
          body_en: string;
          code: string;
          created_at: string;
          dated: string | null;
          id: string;
          ratification: string | null;
          slug: string;
          sort: number;
          status: string;
          summary_ar: string | null;
          summary_en: string | null;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
          updated_by: string | null;
          version: string | null;
        };
        Insert: {
          adopted_on?: string | null;
          audience?: string;
          body_ar?: string | null;
          body_en?: string;
          code: string;
          created_at?: string;
          dated?: string | null;
          id?: string;
          ratification?: string | null;
          slug: string;
          sort?: number;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: string | null;
        };
        Update: {
          adopted_on?: string | null;
          audience?: string;
          body_ar?: string | null;
          body_en?: string;
          code?: string;
          created_at?: string;
          dated?: string | null;
          id?: string;
          ratification?: string | null;
          slug?: string;
          sort?: number;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: string | null;
        };
        Relationships: [];
      };
      spending_approvals: {
        Row: {
          amount_iqd: number;
          approved_at: string | null;
          campaign_id: string | null;
          created_at: string;
          decision_note: string | null;
          id: string;
          lead_approver: string | null;
          lead_limit_iqd: number | null;
          programme_id: string | null;
          purpose_ar: string | null;
          purpose_en: string;
          requested_by: string | null;
          resolution_id: string | null;
          status: string;
          treasurer_approver: string | null;
        };
        Insert: {
          amount_iqd: number;
          approved_at?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          decision_note?: string | null;
          id?: string;
          lead_approver?: string | null;
          lead_limit_iqd?: number | null;
          programme_id?: string | null;
          purpose_ar?: string | null;
          purpose_en: string;
          requested_by?: string | null;
          resolution_id?: string | null;
          status?: string;
          treasurer_approver?: string | null;
        };
        Update: {
          amount_iqd?: number;
          approved_at?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          decision_note?: string | null;
          id?: string;
          lead_approver?: string | null;
          lead_limit_iqd?: number | null;
          programme_id?: string | null;
          purpose_ar?: string | null;
          purpose_en?: string;
          requested_by?: string | null;
          resolution_id?: string | null;
          status?: string;
          treasurer_approver?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "spending_approvals_resolution_id_fkey";
            columns: ["resolution_id"];
            isOneToOne: false;
            referencedRelation: "resolutions";
            referencedColumns: ["id"];
          },
        ];
      };
      voters: {
        Row: {
          election_id: string;
          user_id: string;
        };
        Insert: {
          election_id: string;
          user_id: string;
        };
        Update: {
          election_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voters_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_spending: { Args: { approval_id: string }; Returns: string };
      cast_ballot: {
        Args: { choices: Json; election_id: string };
        Returns: undefined;
      };
      council_roster: {
        Args: Record<PropertyKey, never>;
        Returns: {
          full_name_ar: string;
          full_name_en: string;
          role: string;
          role_name_ar: string;
          role_name_en: string;
          sort: number;
          title_ar: string;
          title_en: string;
        }[];
      };
      count_election: { Args: { election_id: string }; Returns: undefined };
      decide_candidate: {
        Args: { approve: boolean; candidate_id: string };
        Returns: undefined;
      };
      declarable_partners: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
        }[];
      };
      discard_form_draft: {
        Args: { submission_id: string };
        Returns: undefined;
      };
      form_queue: {
        Args: Record<PropertyKey, never>;
        Returns: {
          form_key: string;
          overdue: number;
          waiting: number;
        }[];
      };
      give_notice: { Args: { election_id: string }; Returns: number };
      handle_form: {
        Args: { office?: Json; status: string; submission_id: string };
        Returns: undefined;
      };
      joinable_partners: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
        }[];
      };
      nominate: {
        Args: {
          position_id: string;
          statement_ar?: string;
          statement_en: string;
        };
        Returns: string;
      };
      open_voting: { Args: { election_id: string }; Returns: number };
      public_partners: {
        Args: Record<PropertyKey, never>;
        Returns: {
          description_ar: string;
          description_en: string;
          kind: string;
          logo_path: string;
          name_ar: string;
          name_en: string;
          reach: string;
          slug: string;
          url: string;
        }[];
      };
      reject_spending: {
        Args: { approval_id: string; note: string };
        Returns: undefined;
      };
      request_spending: {
        Args: {
          amount_iqd: number;
          campaign_id?: string;
          programme_id?: string;
          purpose_ar?: string;
          purpose_en: string;
          resolution_id?: string;
        };
        Returns: string;
      };
      save_form: {
        Args: {
          anonymous?: boolean;
          data: Json;
          form_key: string;
          routing?: string;
          subject_id?: string;
          submission_id?: string;
          submit?: boolean;
        };
        Returns: string;
      };
      sign_partner_agreement: {
        Args: {
          agreement_id: string;
          partner_signatory: string;
          signed_document_path: string;
        };
        Returns: undefined;
      };
      turnout: {
        Args: { election_id: string };
        Returns: {
          eligible: number;
          voted: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  journal: {
    Tables: {
      agreements: {
        Row: {
          id: string;
          signed_at: string;
          signed_by: string;
          signer_name: string;
          submission_id: string;
          version: string;
        };
        Insert: {
          id?: string;
          signed_at?: string;
          signed_by?: string;
          signer_name: string;
          submission_id: string;
          version: string;
        };
        Update: {
          id?: string;
          signed_at?: string;
          signed_by?: string;
          signer_name?: string;
          submission_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agreements_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          blind_entry_id: string;
          id: string;
          read_number: number;
          reader_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          blind_entry_id: string;
          id?: string;
          read_number: number;
          reader_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          blind_entry_id?: string;
          id?: string;
          read_number?: number;
          reader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_blind_entry_id_fkey";
            columns: ["blind_entry_id"];
            isOneToOne: false;
            referencedRelation: "blind_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      blind_entries: {
        Row: {
          blind_id: string;
          body_html: string | null;
          call_id: string;
          category: Database["journal"]["Enums"]["category"];
          created_at: string;
          editor_notes: string | null;
          flag_note: string | null;
          flagged: boolean;
          id: string;
          issue_id: string;
          language: Database["journal"]["Enums"]["language"];
          source_text: string | null;
          status: Database["journal"]["Enums"]["submission_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          blind_id: string;
          body_html?: string | null;
          call_id: string;
          category: Database["journal"]["Enums"]["category"];
          created_at?: string;
          editor_notes?: string | null;
          flag_note?: string | null;
          flagged?: boolean;
          id?: string;
          issue_id: string;
          language: Database["journal"]["Enums"]["language"];
          source_text?: string | null;
          status?: Database["journal"]["Enums"]["submission_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          blind_id?: string;
          body_html?: string | null;
          call_id?: string;
          category?: Database["journal"]["Enums"]["category"];
          created_at?: string;
          editor_notes?: string | null;
          flag_note?: string | null;
          flagged?: boolean;
          id?: string;
          issue_id?: string;
          language?: Database["journal"]["Enums"]["language"];
          source_text?: string | null;
          status?: Database["journal"]["Enums"]["submission_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blind_entries_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blind_entries_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      blind_keys: {
        Row: {
          blind_entry_id: string;
          submission_id: string;
        };
        Insert: {
          blind_entry_id: string;
          submission_id: string;
        };
        Update: {
          blind_entry_id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blind_keys_blind_entry_id_fkey";
            columns: ["blind_entry_id"];
            isOneToOne: true;
            referencedRelation: "blind_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blind_keys_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      call_partners: {
        Row: {
          added_by: string | null;
          call_id: string;
          created_at: string;
          partner_id: string;
        };
        Insert: {
          added_by?: string | null;
          call_id: string;
          created_at?: string;
          partner_id: string;
        };
        Update: {
          added_by?: string | null;
          call_id?: string;
          created_at?: string;
          partner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_partners_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      calls: {
        Row: {
          closes_at: string;
          created_at: string;
          eligibility_ar: string | null;
          eligibility_en: string | null;
          id: string;
          is_published: boolean;
          issue_id: string;
          max_per_person: number;
          opens_at: string;
          theme_ar: string | null;
          theme_en: string | null;
          title_ar: string;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          closes_at: string;
          created_at?: string;
          eligibility_ar?: string | null;
          eligibility_en?: string | null;
          id?: string;
          is_published?: boolean;
          issue_id: string;
          max_per_person?: number;
          opens_at: string;
          theme_ar?: string | null;
          theme_en?: string | null;
          title_ar: string;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          closes_at?: string;
          created_at?: string;
          eligibility_ar?: string | null;
          eligibility_en?: string | null;
          id?: string;
          is_published?: boolean;
          issue_id?: string;
          max_per_person?: number;
          opens_at?: string;
          theme_ar?: string | null;
          theme_en?: string | null;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calls_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      contributors: {
        Row: {
          bio_ar: string | null;
          bio_en: string | null;
          created_at: string;
          id: string;
          name_ar: string | null;
          name_en: string;
          slug: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          bio_ar?: string | null;
          bio_en?: string | null;
          created_at?: string;
          id?: string;
          name_ar?: string | null;
          name_en: string;
          slug: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bio_ar?: string | null;
          bio_en?: string | null;
          created_at?: string;
          id?: string;
          name_ar?: string | null;
          name_en?: string;
          slug?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      decisions: {
        Row: {
          blind_entry_id: string;
          decided_at: string;
          decided_by: string | null;
          decision: string;
          id: string;
          notes: string | null;
        };
        Insert: {
          blind_entry_id: string;
          decided_at?: string;
          decided_by?: string | null;
          decision: string;
          id?: string;
          notes?: string | null;
        };
        Update: {
          blind_entry_id?: string;
          decided_at?: string;
          decided_by?: string | null;
          decision?: string;
          id?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "decisions_blind_entry_id_fkey";
            columns: ["blind_entry_id"];
            isOneToOne: true;
            referencedRelation: "blind_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      issues: {
        Row: {
          cover_path: string | null;
          created_at: string;
          editors_note_ar: string | null;
          editors_note_en: string | null;
          id: string;
          number: number;
          pdf_path: string | null;
          publish_at: string | null;
          published_at: string | null;
          slug: string;
          status: string;
          theme_ar: string | null;
          theme_en: string | null;
          title_ar: string;
          title_en: string;
          updated_at: string;
          volume: number;
        };
        Insert: {
          cover_path?: string | null;
          created_at?: string;
          editors_note_ar?: string | null;
          editors_note_en?: string | null;
          id?: string;
          number: number;
          pdf_path?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          slug: string;
          status?: string;
          theme_ar?: string | null;
          theme_en?: string | null;
          title_ar: string;
          title_en: string;
          updated_at?: string;
          volume: number;
        };
        Update: {
          cover_path?: string | null;
          created_at?: string;
          editors_note_ar?: string | null;
          editors_note_en?: string | null;
          id?: string;
          number?: number;
          pdf_path?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          slug?: string;
          status?: string;
          theme_ar?: string | null;
          theme_en?: string | null;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
          volume?: number;
        };
        Relationships: [];
      };
      piece_bodies: {
        Row: {
          body_ar: string | null;
          body_en: string | null;
          piece_id: string;
          updated_at: string;
        };
        Insert: {
          body_ar?: string | null;
          body_en?: string | null;
          piece_id: string;
          updated_at?: string;
        };
        Update: {
          body_ar?: string | null;
          body_en?: string | null;
          piece_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "piece_bodies_piece_id_fkey";
            columns: ["piece_id"];
            isOneToOne: true;
            referencedRelation: "pieces";
            referencedColumns: ["id"];
          },
        ];
      };
      pieces: {
        Row: {
          category: Database["journal"]["Enums"]["category"];
          contributor_id: string;
          created_at: string;
          credit_ar: string | null;
          credit_en: string | null;
          id: string;
          image_path: string | null;
          issue_id: string | null;
          language: Database["journal"]["Enums"]["language"];
          members_only: boolean;
          publish_at: string | null;
          published_at: string | null;
          search: unknown;
          slug: string;
          sort: number;
          status: string;
          submission_id: string | null;
          title_ar: string | null;
          title_en: string | null;
          updated_at: string;
        };
        Insert: {
          category: Database["journal"]["Enums"]["category"];
          contributor_id: string;
          created_at?: string;
          credit_ar?: string | null;
          credit_en?: string | null;
          id?: string;
          image_path?: string | null;
          issue_id?: string | null;
          language: Database["journal"]["Enums"]["language"];
          members_only?: boolean;
          publish_at?: string | null;
          published_at?: string | null;
          search?: never;
          slug: string;
          sort?: number;
          status?: string;
          submission_id?: string | null;
          title_ar?: string | null;
          title_en?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: Database["journal"]["Enums"]["category"];
          contributor_id?: string;
          created_at?: string;
          credit_ar?: string | null;
          credit_en?: string | null;
          id?: string;
          image_path?: string | null;
          issue_id?: string | null;
          language?: Database["journal"]["Enums"]["language"];
          members_only?: boolean;
          publish_at?: string | null;
          published_at?: string | null;
          search?: never;
          slug?: string;
          sort?: number;
          status?: string;
          submission_id?: string | null;
          title_ar?: string | null;
          title_en?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pieces_contributor_id_fkey";
            columns: ["contributor_id"];
            isOneToOne: false;
            referencedRelation: "contributors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pieces_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pieces_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      scores: {
        Row: {
          archive_factor: number;
          assignment_id: string;
          comment: string | null;
          craft: number;
          depth: number;
          id: string;
          submitted_at: string;
          total: number | null;
          updated_at: string;
          voice: number;
        };
        Insert: {
          archive_factor: number;
          assignment_id: string;
          comment?: string | null;
          craft: number;
          depth: number;
          id?: string;
          submitted_at?: string;
          total?: never;
          updated_at?: string;
          voice: number;
        };
        Update: {
          archive_factor?: number;
          assignment_id?: string;
          comment?: string | null;
          craft?: number;
          depth?: number;
          id?: string;
          submitted_at?: string;
          total?: never;
          updated_at?: string;
          voice?: number;
        };
        Relationships: [
          {
            foreignKeyName: "scores_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: true;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_status: Database["journal"]["Enums"]["submission_status"] | null;
          id: number;
          note: string | null;
          submission_id: string;
          to_status: Database["journal"]["Enums"]["submission_status"];
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?:
            | Database["journal"]["Enums"]["submission_status"]
            | null;
          id?: never;
          note?: string | null;
          submission_id: string;
          to_status: Database["journal"]["Enums"]["submission_status"];
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?:
            | Database["journal"]["Enums"]["submission_status"]
            | null;
          id?: never;
          note?: string | null;
          submission_id?: string;
          to_status?: Database["journal"]["Enums"]["submission_status"];
        };
        Relationships: [
          {
            foreignKeyName: "status_history_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      submission_files: {
        Row: {
          blind_path: string | null;
          created_at: string;
          id: string;
          kind: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          submission_id: string;
        };
        Insert: {
          blind_path?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          submission_id: string;
        };
        Update: {
          blind_path?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          author_id: string;
          body_html: string | null;
          call_id: string;
          category: Database["journal"]["Enums"]["category"];
          cover_note: string | null;
          created_at: string;
          human_authorship_confirmed: boolean;
          id: string;
          intake_note: string | null;
          intake_returned_at: string | null;
          language: Database["journal"]["Enums"]["language"];
          partner_id: string | null;
          rights_note: string | null;
          source_author: string | null;
          source_text: string | null;
          status: Database["journal"]["Enums"]["submission_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string;
          body_html?: string | null;
          call_id: string;
          category: Database["journal"]["Enums"]["category"];
          cover_note?: string | null;
          created_at?: string;
          human_authorship_confirmed: boolean;
          id?: string;
          intake_note?: string | null;
          intake_returned_at?: string | null;
          language: Database["journal"]["Enums"]["language"];
          partner_id?: string | null;
          rights_note?: string | null;
          source_author?: string | null;
          source_text?: string | null;
          status?: Database["journal"]["Enums"]["submission_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body_html?: string | null;
          call_id?: string;
          category?: Database["journal"]["Enums"]["category"];
          cover_note?: string | null;
          created_at?: string;
          human_authorship_confirmed?: boolean;
          id?: string;
          intake_note?: string | null;
          intake_returned_at?: string | null;
          language?: Database["journal"]["Enums"]["language"];
          partner_id?: string | null;
          rights_note?: string | null;
          source_author?: string | null;
          source_text?: string | null;
          status?: Database["journal"]["Enums"]["submission_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accepted_unplaced: {
        Args: Record<PropertyKey, never>;
        Returns: {
          agreement_signed: boolean;
          blind_entry_id: string;
          blind_id: string;
          category: Database["journal"]["Enums"]["category"];
          decided_at: string;
          decision: string;
          issue_id: string;
          language: Database["journal"]["Enums"]["language"];
          title: string;
        }[];
      };
      assign_reader: {
        Args: {
          blind_entry_id: string;
          read_number: number;
          reader_id: string;
        };
        Returns: string;
      };
      call_partner_names: {
        Args: { call_id: string };
        Returns: {
          name_ar: string;
          name_en: string;
        }[];
      };
      decide: {
        Args: { blind_entry_id: string; decision: string; notes?: string };
        Returns: string;
      };
      entry_author: {
        Args: { blind_entry_id: string };
        Returns: {
          author_name_ar: string;
          author_name_en: string;
        }[];
      };
      intake_queue: {
        Args: { issue_id: string };
        Returns: {
          author_name_ar: string;
          author_name_en: string;
          blind_entry_id: string;
          category: Database["journal"]["Enums"]["category"];
          created_at: string;
          file_count: number;
          intake_note: string;
          intake_returned_at: string;
          language: Database["journal"]["Enums"]["language"];
          status: Database["journal"]["Enums"]["submission_status"];
          submission_id: string;
          title: string;
          updated_at: string;
        }[];
      };
      my_call_pathways: {
        Args: Record<PropertyKey, never>;
        Returns: {
          call_id: string;
          name_ar: string;
          name_en: string;
          partner_id: string;
        }[];
      };
      piece_from_entry: { Args: { blind_entry_id: string }; Returns: string };
      pipeline_issues: {
        Args: Record<PropertyKey, never>;
        Returns: {
          can_advise: boolean;
          can_decide: boolean;
          can_identity: boolean;
          can_manage: boolean;
          can_review: boolean;
          id: string;
          number: number;
          status: string;
          title_ar: string;
          title_en: string;
          volume: number;
        }[];
      };
      return_for_formatting: {
        Args: { note: string; submission_id: string };
        Returns: undefined;
      };
      review_team: {
        Args: { issue_id: string };
        Returns: {
          full_name_ar: string;
          full_name_en: string;
          user_id: string;
        }[];
      };
      sign_agreement: {
        Args: { signer_name: string; submission_id: string };
        Returns: string;
      };
      submission_partners: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
        }[];
      };
      transition_submission: {
        Args: {
          id: string;
          note?: string;
          to_status: Database["journal"]["Enums"]["submission_status"];
        };
        Returns: Database["journal"]["Enums"]["submission_status"];
      };
    };
    Enums: {
      category:
        | "poetry"
        | "fiction"
        | "creative_nonfiction"
        | "short_drama"
        | "art_photography"
        | "translation"
        | "six_words";
      language: "en" | "ar" | "bilingual";
      submission_status:
        | "received"
        | "intake_check"
        | "in_review"
        | "third_read"
        | "selection"
        | "accepted"
        | "declined"
        | "withdrawn";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  membership: {
    Tables: {
      activity_records: {
        Row: {
          created_at: string;
          event_id: string | null;
          id: string;
          kind: string;
          note: string | null;
          occurred_at: string;
          recorded_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          kind: string;
          note?: string | null;
          occurred_at?: string;
          recorded_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          occurred_at?: string;
          recorded_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      calendar_tokens: {
        Row: {
          created_at: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          token?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          advisor_signed_at: string | null;
          advisor_signed_by: string | null;
          citation_ar: string | null;
          citation_en: string | null;
          created_at: string;
          hours: number | null;
          id: string;
          issued_at: string | null;
          kind: string;
          partner_id: string | null;
          period_from: string | null;
          period_to: string | null;
          prepared_by: string | null;
          president_signed_at: string | null;
          president_signed_by: string | null;
          production_id: string | null;
          resolution_id: string | null;
          revoke_reason: string | null;
          revoked_at: string | null;
          role_ar: string | null;
          role_en: string | null;
          serial: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          verification_code: string;
        };
        Insert: {
          advisor_signed_at?: string | null;
          advisor_signed_by?: string | null;
          citation_ar?: string | null;
          citation_en?: string | null;
          created_at?: string;
          hours?: number | null;
          id?: string;
          issued_at?: string | null;
          kind: string;
          partner_id?: string | null;
          period_from?: string | null;
          period_to?: string | null;
          prepared_by?: string | null;
          president_signed_at?: string | null;
          president_signed_by?: string | null;
          production_id?: string | null;
          resolution_id?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          role_ar?: string | null;
          role_en?: string | null;
          serial?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          verification_code?: string;
        };
        Update: {
          advisor_signed_at?: string | null;
          advisor_signed_by?: string | null;
          citation_ar?: string | null;
          citation_en?: string | null;
          created_at?: string;
          hours?: number | null;
          id?: string;
          issued_at?: string | null;
          kind?: string;
          partner_id?: string | null;
          period_from?: string | null;
          period_to?: string | null;
          prepared_by?: string | null;
          president_signed_at?: string | null;
          president_signed_by?: string | null;
          production_id?: string | null;
          resolution_id?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          role_ar?: string | null;
          role_en?: string | null;
          serial?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          verification_code?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          created_at: string;
          member_since: string;
          tier: Database["membership"]["Enums"]["tier"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          member_since?: string;
          tier?: Database["membership"]["Enums"]["tier"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          member_since?: string;
          tier?: Database["membership"]["Enums"]["tier"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pledges: {
        Row: {
          accepted_at: string;
          id: string;
          pledge_type: Database["membership"]["Enums"]["pledge_type"];
          user_id: string;
          version: string;
        };
        Insert: {
          accepted_at?: string;
          id?: string;
          pledge_type: Database["membership"]["Enums"]["pledge_type"];
          user_id?: string;
          version: string;
        };
        Update: {
          accepted_at?: string;
          id?: string;
          pledge_type?: Database["membership"]["Enums"]["pledge_type"];
          user_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      service_records: {
        Row: {
          activity: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          hours: number;
          id: string;
          occurred_on: string;
          programme_id: string | null;
          reject_reason: string | null;
          source: string;
          source_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          what: string | null;
        };
        Insert: {
          activity: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          hours: number;
          id?: string;
          occurred_on: string;
          programme_id?: string | null;
          reject_reason?: string | null;
          source?: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          what?: string | null;
        };
        Update: {
          activity?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          hours?: number;
          id?: string;
          occurred_on?: string;
          programme_id?: string | null;
          reject_reason?: string | null;
          source?: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          what?: string | null;
        };
        Relationships: [];
      };
      verification_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          email: string;
          id: string;
          statement: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          email: string;
          id?: string;
          statement?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          email?: string;
          id?: string;
          statement?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_pledge: {
        Args: {
          kind: Database["membership"]["Enums"]["pledge_type"];
          version: string;
        };
        Returns: undefined;
      };
      activity_count: { Args: { uid?: string }; Returns: number };
      add_manual_activity: {
        Args: { note: string; occurred_at?: string; target_user: string };
        Returns: string;
      };
      calendar_token: { Args: Record<PropertyKey, never>; Returns: string };
      certificate_signers: {
        Args: { certificate_id: string };
        Returns: {
          advisor_ar: string;
          advisor_en: string;
          president_ar: string;
          president_en: string;
        }[];
      };
      confirm_service: {
        Args: { approve: boolean; reason?: string; record_id: string };
        Returns: undefined;
      };
      current_pledge_version: {
        Args: { kind: Database["membership"]["Enums"]["pledge_type"] };
        Returns: string;
      };
      decide_verification: {
        Args: { approve: boolean; note?: string; request_id: string };
        Returns: undefined;
      };
      directory: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activities: number;
          created_at: string;
          email: string;
          full_name_ar: string;
          full_name_en: string;
          member_since: string;
          tier: Database["membership"]["Enums"]["tier"];
          user_id: string;
          verified_at: string;
          voting_member: boolean;
        }[];
      };
      has_current_pledges: { Args: { uid?: string }; Returns: boolean };
      is_member: { Args: { uid?: string }; Returns: boolean };
      is_voting_member: { Args: { uid?: string }; Returns: boolean };
      my_status: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activities: number;
          founding_until: string;
          founding_voter: boolean;
          is_member: boolean;
          member_since: string;
          pending_pledges: Database["membership"]["Enums"]["pledge_type"][];
          tier: Database["membership"]["Enums"]["tier"];
          verified: boolean;
          voting_member: boolean;
        }[];
      };
      record_event_service: {
        Args: { event_id: string; hours: number; member_id: string };
        Returns: string;
      };
      record_shift_service: {
        Args: { member_id: string; shift_id: string };
        Returns: string;
      };
      reset_calendar_token: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      revoke_certificate: {
        Args: { certificate_id: string; reason: string };
        Returns: undefined;
      };
      service_hours: {
        Args: { on_date?: string; uid?: string };
        Returns: number;
      };
      service_totals: {
        Args: Record<PropertyKey, never>;
        Returns: {
          fellowship_eligible: boolean;
          full_name_ar: string;
          full_name_en: string;
          hours: number;
          user_id: string;
        }[];
      };
      set_tier: {
        Args: {
          new_tier: Database["membership"]["Enums"]["tier"];
          target_user: string;
        };
        Returns: undefined;
      };
      sign_certificate: { Args: { certificate_id: string }; Returns: string };
      verify_certificate: {
        Args: { code: string };
        Returns: {
          citation_ar: string;
          citation_en: string;
          holder_ar: string;
          holder_en: string;
          hours: number;
          issued_at: string;
          kind: string;
          partner_ar: string;
          partner_en: string;
          period_from: string;
          period_to: string;
          revoked_at: string;
          role_ar: string;
          role_en: string;
          serial: string;
          status: string;
        }[];
      };
    };
    Enums: {
      pledge_type: "human_authorship" | "member";
      tier: "member" | "fellow" | "honorary" | "alumni";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  programmes: {
    Tables: {
      audition_notes: {
        Row: {
          audition_id: string;
          author_id: string;
          created_at: string;
          id: string;
          note: string;
          user_id: string;
        };
        Insert: {
          audition_id: string;
          author_id?: string;
          created_at?: string;
          id?: string;
          note: string;
          user_id: string;
        };
        Update: {
          audition_id?: string;
          author_id?: string;
          created_at?: string;
          id?: string;
          note?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audition_notes_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
        ];
      };
      audition_signups: {
        Row: {
          audition_id: string;
          created_at: string;
          interest: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          audition_id: string;
          created_at?: string;
          interest?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          audition_id?: string;
          created_at?: string;
          interest?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audition_signups_audition_id_fkey";
            columns: ["audition_id"];
            isOneToOne: false;
            referencedRelation: "auditions";
            referencedColumns: ["id"];
          },
        ];
      };
      auditions: {
        Row: {
          capacity: number;
          created_at: string;
          ends_at: string;
          id: string;
          location_ar: string | null;
          location_en: string | null;
          prepare_ar: string | null;
          prepare_en: string | null;
          production_id: string;
          starts_at: string;
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          ends_at: string;
          id?: string;
          location_ar?: string | null;
          location_en?: string | null;
          prepare_ar?: string | null;
          prepare_en?: string | null;
          production_id: string;
          starts_at: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          ends_at?: string;
          id?: string;
          location_ar?: string | null;
          location_en?: string | null;
          prepare_ar?: string | null;
          prepare_en?: string | null;
          production_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "auditions_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      episodes: {
        Row: {
          created_at: string;
          id: string;
          number: number | null;
          programme_id: string;
          published_at: string | null;
          season: number | null;
          segment: string | null;
          slug: string;
          summary_ar: string | null;
          summary_en: string | null;
          title_ar: string;
          title_en: string;
          updated_at: string;
          youtube_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          number?: number | null;
          programme_id: string;
          published_at?: string | null;
          season?: number | null;
          segment?: string | null;
          slug: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar: string;
          title_en: string;
          updated_at?: string;
          youtube_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          number?: number | null;
          programme_id?: string;
          published_at?: string | null;
          season?: number | null;
          segment?: string | null;
          slug?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
          youtube_id?: string;
        };
        Relationships: [];
      };
      production_credits: {
        Row: {
          created_at: string;
          department: string;
          id: string;
          partner_id: string | null;
          person_name: string | null;
          production_id: string;
          role_ar: string | null;
          role_en: string;
          show_publicly: boolean;
          sort: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          department: string;
          id?: string;
          partner_id?: string | null;
          person_name?: string | null;
          production_id: string;
          role_ar?: string | null;
          role_en: string;
          show_publicly?: boolean;
          sort?: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          department?: string;
          id?: string;
          partner_id?: string | null;
          person_name?: string | null;
          production_id?: string;
          role_ar?: string | null;
          role_en?: string;
          show_publicly?: boolean;
          sort?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "production_credits_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      production_events: {
        Row: {
          event_id: string;
          production_id: string;
        };
        Insert: {
          event_id: string;
          production_id: string;
        };
        Update: {
          event_id?: string;
          production_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_events_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      production_partners: {
        Row: {
          created_at: string;
          partner_id: string;
          production_id: string;
        };
        Insert: {
          created_at?: string;
          partner_id: string;
          production_id: string;
        };
        Update: {
          created_at?: string;
          partner_id?: string;
          production_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_partners_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      productions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_public: boolean;
          kind: string;
          playwright: string | null;
          poster_path: string | null;
          programme_id: string | null;
          report_lessons: string | null;
          report_money_in_iqd: number | null;
          report_money_out_iqd: number | null;
          report_people_reached: number | null;
          report_repeat: string | null;
          report_signed_at: string | null;
          report_signed_by: string | null;
          report_what_happened: string | null;
          rights_cleared_at: string | null;
          rights_cleared_by: string | null;
          rights_document_path: string | null;
          rights_note: string | null;
          rights_recorded_by: string | null;
          rights_status: string;
          script_origin: string;
          slug: string;
          stage: string;
          summary_ar: string | null;
          summary_en: string | null;
          title_ar: string;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_public?: boolean;
          kind?: string;
          playwright?: string | null;
          poster_path?: string | null;
          programme_id?: string | null;
          report_lessons?: string | null;
          report_money_in_iqd?: number | null;
          report_money_out_iqd?: number | null;
          report_people_reached?: number | null;
          report_repeat?: string | null;
          report_signed_at?: string | null;
          report_signed_by?: string | null;
          report_what_happened?: string | null;
          rights_cleared_at?: string | null;
          rights_cleared_by?: string | null;
          rights_document_path?: string | null;
          rights_note?: string | null;
          rights_recorded_by?: string | null;
          rights_status?: string;
          script_origin?: string;
          slug: string;
          stage?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar: string;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_public?: boolean;
          kind?: string;
          playwright?: string | null;
          poster_path?: string | null;
          programme_id?: string | null;
          report_lessons?: string | null;
          report_money_in_iqd?: number | null;
          report_money_out_iqd?: number | null;
          report_people_reached?: number | null;
          report_repeat?: string | null;
          report_signed_at?: string | null;
          report_signed_by?: string | null;
          report_what_happened?: string | null;
          rights_cleared_at?: string | null;
          rights_cleared_by?: string | null;
          rights_document_path?: string | null;
          rights_note?: string | null;
          rights_recorded_by?: string | null;
          rights_status?: string;
          script_origin?: string;
          slug?: string;
          stage?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title_ar?: string;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reels: {
        Row: {
          caption_ar: string | null;
          caption_en: string | null;
          created_at: string;
          episode_id: string | null;
          id: string;
          platform: string;
          programme_id: string;
          published_at: string | null;
          url: string;
        };
        Insert: {
          caption_ar?: string | null;
          caption_en?: string | null;
          created_at?: string;
          episode_id?: string | null;
          id?: string;
          platform: string;
          programme_id: string;
          published_at?: string | null;
          url: string;
        };
        Update: {
          caption_ar?: string | null;
          caption_en?: string | null;
          created_at?: string;
          episode_id?: string | null;
          id?: string;
          platform?: string;
          programme_id?: string;
          published_at?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reels_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      rehearsals: {
        Row: {
          called: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          location_ar: string | null;
          location_en: string | null;
          notes: string | null;
          production_id: string;
          starts_at: string;
        };
        Insert: {
          called?: string | null;
          created_at?: string;
          ends_at: string;
          id?: string;
          location_ar?: string | null;
          location_en?: string | null;
          notes?: string | null;
          production_id: string;
          starts_at: string;
        };
        Update: {
          called?: string | null;
          created_at?: string;
          ends_at?: string;
          id?: string;
          location_ar?: string | null;
          location_en?: string | null;
          notes?: string | null;
          production_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rehearsals_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      removal_requests: {
        Row: {
          action_taken: string | null;
          closed_at: string | null;
          content_url: string | null;
          created_at: string;
          details: string;
          due_at: string;
          handled_by: string | null;
          id: string;
          programme_id: string | null;
          requester_email: string;
          requester_name: string;
          status: string;
        };
        Insert: {
          action_taken?: string | null;
          closed_at?: string | null;
          content_url?: string | null;
          created_at?: string;
          details: string;
          due_at?: string;
          handled_by?: string | null;
          id?: string;
          programme_id?: string | null;
          requester_email: string;
          requester_name: string;
          status?: string;
        };
        Update: {
          action_taken?: string | null;
          closed_at?: string | null;
          content_url?: string | null;
          created_at?: string;
          details?: string;
          due_at?: string;
          handled_by?: string | null;
          id?: string;
          programme_id?: string | null;
          requester_email?: string;
          requester_name?: string;
          status?: string;
        };
        Relationships: [];
      };
      rotas: {
        Row: {
          created_at: string;
          ends_on: string | null;
          id: string;
          programme_id: string;
          starts_on: string | null;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          programme_id: string;
          starts_on?: string | null;
          title_ar: string;
          title_en: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          programme_id?: string;
          starts_on?: string | null;
          title_ar?: string;
          title_en?: string;
        };
        Relationships: [];
      };
      shift_signups: {
        Row: {
          created_at: string;
          shift_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          shift_id: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          shift_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shift_signups_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          capacity: number;
          created_at: string;
          ends_at: string;
          event_id: string | null;
          id: string;
          location_ar: string | null;
          location_en: string | null;
          role_ar: string;
          role_en: string;
          rota_id: string;
          starts_at: string;
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          ends_at: string;
          event_id?: string | null;
          id?: string;
          location_ar?: string | null;
          location_en?: string | null;
          role_ar: string;
          role_en: string;
          rota_id: string;
          starts_at: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          ends_at?: string;
          event_id?: string | null;
          id?: string;
          location_ar?: string | null;
          location_en?: string | null;
          role_ar?: string;
          role_en?: string;
          rota_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_rota_id_fkey";
            columns: ["rota_id"];
            isOneToOne: false;
            referencedRelation: "rotas";
            referencedColumns: ["id"];
          },
        ];
      };
      six_words: {
        Row: {
          created_at: string;
          id: string;
          language: string;
          moderated_at: string | null;
          moderated_by: string | null;
          show_name: boolean;
          status: string;
          text: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          language: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          show_name?: boolean;
          status?: string;
          text: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          language?: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          show_name?: boolean;
          status?: string;
          text?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_audition: { Args: { audition_id: string }; Returns: undefined };
      clear_production_rights: {
        Args: { production_id: string };
        Returns: undefined;
      };
      draft_production_certificates: {
        Args: { production_id: string };
        Returns: number;
      };
      member_productions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          kind: string;
          playwright: string;
          poster_path: string;
          slug: string;
          stage: string;
          summary_ar: string;
          summary_en: string;
          title_ar: string;
          title_en: string;
        }[];
      };
      moderate_six_words: {
        Args: { approve: boolean; entry_id: string };
        Returns: undefined;
      };
      production_partner_choices: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
        }[];
      };
      public_production_credits: {
        Args: { production_id: string };
        Returns: {
          department: string;
          name_ar: string;
          name_en: string;
          role_ar: string;
          role_en: string;
          sort: number;
        }[];
      };
      public_production_events: {
        Args: { production_id: string };
        Returns: {
          slug: string;
          starts_at: string;
          title_ar: string;
          title_en: string;
          venue_ar: string;
          venue_en: string;
        }[];
      };
      public_production_partners: {
        Args: { production_id: string };
        Returns: {
          name_ar: string;
          name_en: string;
          url: string;
        }[];
      };
      public_productions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          first_performance: string;
          id: string;
          kind: string;
          playwright: string;
          poster_path: string;
          slug: string;
          stage: string;
          summary_ar: string;
          summary_en: string;
          title_ar: string;
          title_en: string;
        }[];
      };
      record_production_service: {
        Args: { hours: number; member_id: string; production_id: string };
        Returns: string;
      };
      set_credit_visibility: {
        Args: { credit_id: string; visible: boolean };
        Returns: undefined;
      };
      shift_places: {
        Args: Record<PropertyKey, never>;
        Returns: {
          shift_id: string;
          taken: number;
        }[];
      };
      sign_production_report: {
        Args: { production_id: string };
        Returns: undefined;
      };
      sign_up_for_audition: {
        Args: { audition_id: string; interest?: string };
        Returns: undefined;
      };
      sign_up_for_shift: { Args: { shift_id: string }; Returns: undefined };
      six_words_wall: {
        Args: { max_results?: number };
        Returns: {
          author_ar: string;
          author_en: string;
          created_at: string;
          id: string;
          language: string;
          text: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  access: {
    Enums: {},
  },
  charity: {
    Enums: {
      source: [
        "table_cash",
        "stickers",
        "blind_date",
        "fill_a_bag",
        "book_sales",
        "donation",
        "other",
      ],
    },
  },
  content: {
    Enums: {},
  },
  core: {
    Enums: {},
  },
  events: {
    Enums: {},
  },
  governance: {
    Enums: {},
  },
  journal: {
    Enums: {
      category: [
        "poetry",
        "fiction",
        "creative_nonfiction",
        "short_drama",
        "art_photography",
        "translation",
        "six_words",
      ],
      language: ["en", "ar", "bilingual"],
      submission_status: [
        "received",
        "intake_check",
        "in_review",
        "third_read",
        "selection",
        "accepted",
        "declined",
        "withdrawn",
      ],
    },
  },
  membership: {
    Enums: {
      pledge_type: ["human_authorship", "member"],
      tier: ["member", "fellow", "honorary", "alumni"],
    },
  },
  programmes: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
