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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          session_token: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          session_token: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          account_locked_until: string | null
          created_at: string | null
          email: string
          failed_login_attempts: number | null
          id: string
          last_login: string | null
          password_hash: string
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          account_locked_until?: string | null
          created_at?: string | null
          email: string
          failed_login_attempts?: number | null
          id?: string
          last_login?: string | null
          password_hash: string
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          account_locked_until?: string | null
          created_at?: string | null
          email?: string
          failed_login_attempts?: number | null
          id?: string
          last_login?: string | null
          password_hash?: string
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      ai_tools: {
        Row: {
          category: string
          complexity: string | null
          created_at: string | null
          description: string
          features: string[] | null
          github_link: string | null
          id: string
          image_url: string | null
          link: string | null
          metrics: Json | null
          pricing: string | null
          sort_order: number | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          complexity?: string | null
          created_at?: string | null
          description: string
          features?: string[] | null
          github_link?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          metrics?: Json | null
          pricing?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          complexity?: string | null
          created_at?: string | null
          description?: string
          features?: string[] | null
          github_link?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          metrics?: Json | null
          pricing?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      amazon_api_throttle: {
        Row: {
          day_key: string
          id: number
          last_call_at: string | null
          used_today: number
        }
        Insert: {
          day_key?: string
          id: number
          last_call_at?: string | null
          used_today?: number
        }
        Update: {
          day_key?: string
          id?: number
          last_call_at?: string | null
          used_today?: number
        }
        Relationships: []
      }
      amazon_pipeline_logs: {
        Row: {
          created_at: string
          ctx: Json | null
          id: string
          level: string
          message: string
          run_id: string
        }
        Insert: {
          created_at?: string
          ctx?: Json | null
          id?: string
          level: string
          message: string
          run_id: string
        }
        Update: {
          created_at?: string
          ctx?: Json | null
          id?: string
          level?: string
          message?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_pipeline_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "amazon_pipeline_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_pipeline_runs: {
        Row: {
          errors: Json | null
          finished_at: string | null
          id: string
          note: string | null
          posts_created: number | null
          posts_published: number | null
          started_at: string
          status: string
        }
        Insert: {
          errors?: Json | null
          finished_at?: string | null
          id?: string
          note?: string | null
          posts_created?: number | null
          posts_published?: number | null
          started_at?: string
          status: string
        }
        Update: {
          errors?: Json | null
          finished_at?: string | null
          id?: string
          note?: string | null
          posts_created?: number | null
          posts_published?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      amazon_pipeline_settings: {
        Row: {
          amazon_tag: string
          cache_only_mode: boolean
          created_at: string
          daily_post_count: number
          id: string
          last_run_at: string | null
          min_rating: number
          niches: Json
          price_max: number | null
          price_min: number | null
          review_required: boolean
          updated_at: string
          word_count_target: number
        }
        Insert: {
          amazon_tag?: string
          cache_only_mode?: boolean
          created_at?: string
          daily_post_count?: number
          id?: string
          last_run_at?: string | null
          min_rating?: number
          niches?: Json
          price_max?: number | null
          price_min?: number | null
          review_required?: boolean
          updated_at?: string
          word_count_target?: number
        }
        Update: {
          amazon_tag?: string
          cache_only_mode?: boolean
          created_at?: string
          daily_post_count?: number
          id?: string
          last_run_at?: string | null
          min_rating?: number
          niches?: Json
          price_max?: number | null
          price_min?: number | null
          review_required?: boolean
          updated_at?: string
          word_count_target?: number
        }
        Relationships: []
      }
      amazon_products: {
        Row: {
          asin: string
          brand: string | null
          bullet_points: Json | null
          created_at: string
          id: string
          image_url: string | null
          last_seen_at: string
          niche: string | null
          price: number | null
          rating: number | null
          rating_count: number | null
          title: string
        }
        Insert: {
          asin: string
          brand?: string | null
          bullet_points?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          last_seen_at?: string
          niche?: string | null
          price?: number | null
          rating?: number | null
          rating_count?: number | null
          title: string
        }
        Update: {
          asin?: string
          brand?: string | null
          bullet_points?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          last_seen_at?: string
          niche?: string | null
          price?: number | null
          rating?: number | null
          rating_count?: number | null
          title?: string
        }
        Relationships: []
      }
      amazon_search_terms: {
        Row: {
          article_id: string | null
          category: string
          created_at: string
          id: string
          product_count: number | null
          search_term: string
          used_at: string | null
        }
        Insert: {
          article_id?: string | null
          category: string
          created_at?: string
          id?: string
          product_count?: number | null
          search_term: string
          used_at?: string | null
        }
        Update: {
          article_id?: string | null
          category?: string
          created_at?: string
          id?: string
          product_count?: number | null
          search_term?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amazon_search_terms_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_data: {
        Row: {
          created_at: string
          date: string
          dimensions: Json | null
          id: string
          metric_name: string
          metric_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      analytics_settings: {
        Row: {
          created_at: string
          enabled: boolean
          google_analytics_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          google_analytics_id?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          google_analytics_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      article_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      article_products: {
        Row: {
          affiliate_url: string
          article_id: string
          asin: string
          best_for: string | null
          cons: Json | null
          created_at: string
          id: string
          pros: Json | null
          specs: Json | null
          summary: string | null
        }
        Insert: {
          affiliate_url: string
          article_id: string
          asin: string
          best_for?: string | null
          cons?: Json | null
          created_at?: string
          id?: string
          pros?: Json | null
          specs?: Json | null
          summary?: string | null
        }
        Update: {
          affiliate_url?: string
          article_id?: string
          asin?: string
          best_for?: string | null
          cons?: Json | null
          created_at?: string
          id?: string
          pros?: Json | null
          specs?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_products_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_products_asin_fkey"
            columns: ["asin"]
            isOneToOne: false
            referencedRelation: "amazon_products"
            referencedColumns: ["asin"]
          },
        ]
      }
      articles: {
        Row: {
          author: string | null
          category: string
          content: string | null
          created_at: string | null
          excerpt: string
          featured: boolean | null
          id: string
          image_url: string | null
          published: boolean | null
          read_time: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          tags: string[] | null
          target_keyword: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author?: string | null
          category: string
          content?: string | null
          created_at?: string | null
          excerpt: string
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published?: boolean | null
          read_time?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          tags?: string[] | null
          target_keyword?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author?: string | null
          category?: string
          content?: string | null
          created_at?: string | null
          excerpt?: string
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published?: boolean | null
          read_time?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          tags?: string[] | null
          target_keyword?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string | null
          status: string
          subject?: string | null
          type: string
        }
        Update: {
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          subscribed_at: string
          updated_at: string
          welcome_email_sent: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          subscribed_at?: string
          updated_at?: string
          welcome_email_sent?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          subscribed_at?: string
          updated_at?: string
          welcome_email_sent?: boolean
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string
          featured: boolean | null
          github_link: string | null
          id: string
          image_url: string | null
          live_link: string | null
          sort_order: number | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          featured?: boolean | null
          github_link?: string | null
          id?: string
          image_url?: string | null
          live_link?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          featured?: boolean | null
          github_link?: string | null
          id?: string
          image_url?: string | null
          live_link?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          created_at: string | null
          from_email: string
          from_name: string
          host: string
          id: string
          password: string
          port: number
          require_auth: boolean | null
          reset_subject: string | null
          reset_template: string | null
          secure: boolean | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          from_email: string
          from_name?: string
          host: string
          id?: string
          password: string
          port?: number
          require_auth?: boolean | null
          reset_subject?: string | null
          reset_template?: string | null
          secure?: boolean | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          password?: string
          port?: number
          require_auth?: boolean | null
          reset_subject?: string | null
          reset_template?: string | null
          secure?: boolean | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_amazon_throttle: {
        Args: { min_interval_ms?: number }
        Returns: {
          day_key: string
          used_today: number
          wait_ms: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
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
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
