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
      accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_subtype: string | null
          account_type: string
          created_at: string | null
          currency_id: string | null
          current_balance: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_group: boolean | null
          opening_balance: number | null
          parent_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_subtype?: string | null
          account_type: string
          created_at?: string | null
          currency_id?: string | null
          current_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          opening_balance?: number | null
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_subtype?: string | null
          account_type?: string
          created_at?: string | null
          currency_id?: string | null
          current_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          opening_balance?: number | null
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_log: {
        Row: {
          action: string
          action_category: string | null
          admin_email: string
          admin_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_title: string | null
          resource_type: string | null
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          action: string
          action_category?: string | null
          admin_email: string
          admin_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_title?: string | null
          resource_type?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_category?: string | null
          admin_email?: string
          admin_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_title?: string | null
          resource_type?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: []
      }
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
      admin_whitelist: {
        Row: {
          added_at: string
          added_by: string | null
          deactivated_at: string | null
          email: string
          id: string
          is_active: boolean
          notes: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          deactivated_at?: string | null
          email: string
          id?: string
          is_active?: boolean
          notes?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          deactivated_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      ai_model_configs: {
        Row: {
          api_key_secret_name: string
          configuration: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_test_status: string | null
          last_tested_at: string | null
          model_name: string
          priority: number
          provider: string
          updated_at: string | null
          use_case: string | null
        }
        Insert: {
          api_key_secret_name: string
          configuration?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_test_status?: string | null
          last_tested_at?: string | null
          model_name: string
          priority?: number
          provider: string
          updated_at?: string | null
          use_case?: string | null
        }
        Update: {
          api_key_secret_name?: string
          configuration?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_test_status?: string | null
          last_tested_at?: string | null
          model_name?: string
          priority?: number
          provider?: string
          updated_at?: string | null
          use_case?: string | null
        }
        Relationships: []
      }
      ai_tool_submissions: {
        Row: {
          description: string
          email: string
          github_link: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          tool_name: string
        }
        Insert: {
          description: string
          email: string
          github_link?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          tool_name: string
        }
        Update: {
          description?: string
          email?: string
          github_link?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          tool_name?: string
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
      alert_rules: {
        Row: {
          alert_name: string
          alert_type: string
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          last_triggered_at: string | null
          metric_type: string
          notification_channels: string[] | null
          severity: string
          threshold_operator: string
          threshold_value: number
          time_window_minutes: number | null
          updated_at: string
        }
        Insert: {
          alert_name: string
          alert_type: string
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered_at?: string | null
          metric_type: string
          notification_channels?: string[] | null
          severity?: string
          threshold_operator?: string
          threshold_value: number
          time_window_minutes?: number | null
          updated_at?: string
        }
        Update: {
          alert_name?: string
          alert_type?: string
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered_at?: string | null
          metric_type?: string
          notification_channels?: string[] | null
          severity?: string
          threshold_operator?: string
          threshold_value?: number
          time_window_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      amazon_affiliate_clicks: {
        Row: {
          article_id: string | null
          asin: string
          clicked_at: string
          created_at: string
          id: string
          ip_address: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          article_id?: string | null
          asin: string
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          article_id?: string | null
          asin?: string
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amazon_affiliate_clicks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_affiliate_stats: {
        Row: {
          article_id: string | null
          asin: string
          clicks: number
          commission: number
          created_at: string
          date: string
          id: string
          orders: number
          revenue: number
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          asin: string
          clicks?: number
          commission?: number
          created_at?: string
          date?: string
          id?: string
          orders?: number
          revenue?: number
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          asin?: string
          clicks?: number
          commission?: number
          created_at?: string
          date?: string
          id?: string
          orders?: number
          revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_affiliate_stats_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
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
          social_image_url: string | null
          social_long_form: string | null
          social_short_form: string | null
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
          social_image_url?: string | null
          social_long_form?: string | null
          social_short_form?: string | null
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
          social_image_url?: string | null
          social_long_form?: string | null
          social_short_form?: string | null
          tags?: string[] | null
          target_keyword?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      automated_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_rule_id: string | null
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          message: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_rule_id?: string | null
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          title: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_rule_id?: string | null
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "automated_alerts_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          account_id: string | null
          actual_amount: number | null
          alert_enabled: boolean | null
          alert_threshold: number | null
          budget_amount: number
          budget_type: string
          created_at: string | null
          end_date: string
          expense_category_id: string | null
          id: string
          notes: string | null
          period_type: string
          platform_id: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          actual_amount?: number | null
          alert_enabled?: boolean | null
          alert_threshold?: number | null
          budget_amount: number
          budget_type: string
          created_at?: string | null
          end_date: string
          expense_category_id?: string | null
          id?: string
          notes?: string | null
          period_type: string
          platform_id?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          actual_amount?: number | null
          alert_enabled?: boolean | null
          alert_threshold?: number | null
          budget_amount?: number
          budget_type?: string
          created_at?: string | null
          end_date?: string
          expense_category_id?: string | null
          id?: string
          notes?: string | null
          period_type?: string
          platform_id?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          applies_to_categories: string[] | null
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          shortcut: string | null
          title: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          applies_to_categories?: string[] | null
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          shortcut?: string | null
          title: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          applies_to_categories?: string[] | null
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          shortcut?: string | null
          title?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          email: string
          id: string
          message: string
          name: string
          referrer_url: string | null
          status: string
          subject: string | null
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          email: string
          id?: string
          message: string
          name: string
          referrer_url?: string | null
          status?: string
          subject?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          email?: string
          id?: string
          message?: string
          name?: string
          referrer_url?: string | null
          status?: string
          subject?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          contact_name: string
          contact_type: string
          country: string | null
          created_at: string | null
          currency_id: string | null
          email: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          contact_name: string
          contact_type: string
          country?: string | null
          created_at?: string | null
          currency_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          contact_name?: string
          contact_type?: string
          country?: string | null
          created_at?: string | null
          currency_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          exchange_rate: number | null
          id: string
          is_base: boolean | null
          name: string
          symbol: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          exchange_rate?: number | null
          id?: string
          is_base?: boolean | null
          name: string
          symbol: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          exchange_rate?: number | null
          id?: string
          is_base?: boolean | null
          name?: string
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_stats_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          stat_key: string
          stat_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          stat_key: string
          stat_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          stat_key?: string
          stat_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      db_optimization_log: {
        Row: {
          details: Json | null
          duration: number | null
          executed_at: string
          id: string
          operation_type: string
          rows_affected: number | null
          space_freed_bytes: number | null
          table_name: string | null
        }
        Insert: {
          details?: Json | null
          duration?: number | null
          executed_at?: string
          id?: string
          operation_type: string
          rows_affected?: number | null
          space_freed_bytes?: number | null
          table_name?: string | null
        }
        Update: {
          details?: Json | null
          duration?: number | null
          executed_at?: string
          id?: string
          operation_type?: string
          rows_affected?: number | null
          space_freed_bytes?: number | null
          table_name?: string | null
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
      email_mailboxes: {
        Row: {
          created_at: string
          description: string | null
          email_address: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          signature: string | null
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_use_tls: boolean
          smtp_username: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          email_address: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          signature?: string | null
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_use_tls?: boolean
          smtp_username: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          email_address?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          signature?: string | null
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_use_tls?: boolean
          smtp_username?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          created_at: string
          direction: string
          email_references: string[] | null
          from_email: string
          id: string
          in_reply_to: string | null
          is_read: boolean
          mailbox_id: string
          message_id: string | null
          received_at: string | null
          sent_at: string | null
          subject: string
          ticket_id: string
          to_email: string
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string
          direction: string
          email_references?: string[] | null
          from_email: string
          id?: string
          in_reply_to?: string | null
          is_read?: boolean
          mailbox_id: string
          message_id?: string | null
          received_at?: string | null
          sent_at?: string | null
          subject: string
          ticket_id: string
          to_email: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string
          direction?: string
          email_references?: string[] | null
          from_email?: string
          id?: string
          in_reply_to?: string | null
          is_read?: boolean
          mailbox_id?: string
          message_id?: string | null
          received_at?: string | null
          sent_at?: string | null
          subject?: string
          ticket_id?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "email_mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      email_webhook_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_received_at: string | null
          updated_at: string
          webhook_secret: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_received_at?: string | null
          updated_at?: string
          webhook_secret: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_received_at?: string | null
          updated_at?: string
          webhook_secret?: string
          webhook_url?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          account_id: string | null
          category_code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_category_id: string | null
          tax_deductible: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          category_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_category_id?: string | null
          tax_deductible?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          category_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_category_id?: string | null
          tax_deductible?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          import_data: Json | null
          import_source_id: string | null
          import_type: string
          records_failed: number | null
          records_imported: number | null
          records_skipped: number | null
          records_total: number | null
          result_data: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_data?: Json | null
          import_source_id?: string | null
          import_type: string
          records_failed?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          records_total?: number | null
          result_data?: Json | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_data?: Json | null
          import_source_id?: string | null
          import_type?: string
          records_failed?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          records_total?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_import_source_id_fkey"
            columns: ["import_source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sources: {
        Row: {
          api_key: string | null
          api_secret: string | null
          configuration: Json | null
          created_at: string | null
          default_bank_account_id: string | null
          default_expense_account_id: string | null
          default_income_account_id: string | null
          id: string
          is_active: boolean | null
          last_import_at: string | null
          source_name: string
          source_type: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          configuration?: Json | null
          created_at?: string | null
          default_bank_account_id?: string | null
          default_expense_account_id?: string | null
          default_income_account_id?: string | null
          id?: string
          is_active?: boolean | null
          last_import_at?: string | null
          source_name: string
          source_type: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          configuration?: Json | null
          created_at?: string | null
          default_bank_account_id?: string | null
          default_expense_account_id?: string | null
          default_income_account_id?: string | null
          id?: string
          is_active?: boolean | null
          last_import_at?: string | null
          source_name?: string
          source_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_sources_default_bank_account_id_fkey"
            columns: ["default_bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sources_default_expense_account_id_fkey"
            columns: ["default_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sources_default_income_account_id_fkey"
            columns: ["default_income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          account_id: string | null
          created_at: string | null
          description: string
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          invoice_id: string
          line_number: number
          line_total: number
          metadata: Json | null
          quantity: number | null
          tax_amount: number | null
          tax_rate_id: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          description: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          invoice_id: string
          line_number: number
          line_total: number
          metadata?: Json | null
          quantity?: number | null
          tax_amount?: number | null
          tax_rate_id?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          description?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          invoice_id?: string
          line_number?: number
          line_total?: number
          metadata?: Json | null
          quantity?: number | null
          tax_amount?: number | null
          tax_rate_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          attachments: Json | null
          contact_id: string | null
          created_at: string | null
          currency_id: string | null
          discount_amount: number | null
          due_date: string | null
          exchange_rate: number | null
          external_id: string | null
          external_url: string | null
          id: string
          import_source: string | null
          imported_at: string | null
          invoice_date: string
          invoice_number: string
          invoice_type: string
          metadata: Json | null
          notes: string | null
          reference_number: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          terms: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          attachments?: Json | null
          contact_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          exchange_rate?: number | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_source?: string | null
          imported_at?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type: string
          metadata?: Json | null
          notes?: string | null
          reference_number?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          attachments?: Json | null
          contact_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          exchange_rate?: number | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_source?: string | null
          imported_at?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          metadata?: Json | null
          notes?: string | null
          reference_number?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string | null
          created_by: string | null
          entry_date: string
          entry_number: string
          id: string
          notes: string | null
          posted_at: string | null
          reference_number: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entry_date?: string
          entry_number: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string | null
          credit: number | null
          debit: number | null
          description: string | null
          id: string
          journal_entry_id: string
          line_number: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
          line_number: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string | null
          category: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured: boolean | null
          helpful_count: number | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          meta_title: string | null
          not_helpful_count: number | null
          published: boolean | null
          published_at: string | null
          related_articles: string[] | null
          search_rank: number | null
          slug: string
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content: string
          created_at?: string
          excerpt?: string | null
          featured?: boolean | null
          helpful_count?: number | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          meta_title?: string | null
          not_helpful_count?: number | null
          published?: boolean | null
          published_at?: string | null
          related_articles?: string[] | null
          search_rank?: number | null
          slug: string
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured?: boolean | null
          helpful_count?: number | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          meta_title?: string | null
          not_helpful_count?: number | null
          published?: boolean | null
          published_at?: string | null
          related_articles?: string[] | null
          search_rank?: number | null
          slug?: string
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      link_health: {
        Row: {
          article_id: string | null
          consecutive_failures: number | null
          created_at: string
          first_broken_at: string | null
          fix_applied_at: string | null
          fix_attempted: boolean | null
          fix_method: string | null
          id: string
          is_broken: boolean | null
          is_redirect: boolean | null
          kb_article_id: string | null
          last_checked_at: string | null
          redirect_url: string | null
          response_time: number | null
          status_code: number | null
          updated_at: string
          url: string
        }
        Insert: {
          article_id?: string | null
          consecutive_failures?: number | null
          created_at?: string
          first_broken_at?: string | null
          fix_applied_at?: string | null
          fix_attempted?: boolean | null
          fix_method?: string | null
          id?: string
          is_broken?: boolean | null
          is_redirect?: boolean | null
          kb_article_id?: string | null
          last_checked_at?: string | null
          redirect_url?: string | null
          response_time?: number | null
          status_code?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          article_id?: string | null
          consecutive_failures?: number | null
          created_at?: string
          first_broken_at?: string | null
          fix_applied_at?: string | null
          fix_attempted?: boolean | null
          fix_method?: string | null
          id?: string
          is_broken?: boolean | null
          is_redirect?: boolean | null
          kb_article_id?: string | null
          last_checked_at?: string | null
          redirect_url?: string | null
          response_time?: number | null
          status_code?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_health_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_health_kb_article_id_fkey"
            columns: ["kb_article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_results: {
        Row: {
          alerts_created: number | null
          created_at: string
          details: Json | null
          duration: number | null
          error_message: string | null
          id: string
          issues_fixed: number | null
          issues_found: number | null
          items_processed: number | null
          run_at: string
          status: string
          task_id: string | null
          task_name: string
        }
        Insert: {
          alerts_created?: number | null
          created_at?: string
          details?: Json | null
          duration?: number | null
          error_message?: string | null
          id?: string
          issues_fixed?: number | null
          issues_found?: number | null
          items_processed?: number | null
          run_at?: string
          status: string
          task_id?: string | null
          task_name: string
        }
        Update: {
          alerts_created?: number | null
          created_at?: string
          details?: Json | null
          duration?: number | null
          error_message?: string | null
          id?: string
          issues_fixed?: number | null
          issues_found?: number | null
          items_processed?: number | null
          run_at?: string
          status?: string
          task_id?: string | null
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_results_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean | null
          id: string
          last_run_at: string | null
          last_run_duration: number | null
          last_run_output: Json | null
          last_run_status: string | null
          next_run_at: string | null
          schedule_cron: string
          task_name: string
          task_type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_run_at?: string | null
          last_run_duration?: number | null
          last_run_output?: Json | null
          last_run_status?: string | null
          next_run_at?: string | null
          schedule_cron: string
          task_name: string
          task_type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_run_at?: string | null
          last_run_duration?: number | null
          last_run_output?: Json | null
          last_run_status?: string | null
          next_run_at?: string | null
          schedule_cron?: string
          task_name?: string
          task_type?: string
          updated_at?: string
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
      notification_settings: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          notification_emails: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          notification_emails?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          notification_emails?: string[]
          updated_at?: string | null
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
      payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contact_id: string | null
          created_at: string | null
          currency_id: string | null
          external_id: string | null
          external_url: string | null
          from_account_id: string | null
          id: string
          import_source: string | null
          imported_at: string | null
          metadata: Json | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_number: string
          payment_type: string
          reference_number: string | null
          to_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          contact_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          external_id?: string | null
          external_url?: string | null
          from_account_id?: string | null
          id?: string
          import_source?: string | null
          imported_at?: string | null
          metadata?: Json | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_number: string
          payment_type: string
          reference_number?: string | null
          to_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          contact_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          external_id?: string | null
          external_url?: string | null
          from_account_id?: string | null
          id?: string
          import_source?: string | null
          imported_at?: string | null
          metadata?: Json | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_number?: string
          payment_type?: string
          reference_number?: string | null
          to_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_history: {
        Row: {
          connection_type: string | null
          created_at: string
          device_type: string | null
          id: string
          is_good: boolean | null
          metric_name: string
          metric_unit: string | null
          metric_value: number
          page_url: string | null
          recorded_at: string
          threshold_good: number | null
          threshold_needs_improvement: number | null
          user_agent: string | null
        }
        Insert: {
          connection_type?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          is_good?: boolean | null
          metric_name: string
          metric_unit?: string | null
          metric_value: number
          page_url?: string | null
          recorded_at?: string
          threshold_good?: number | null
          threshold_needs_improvement?: number | null
          user_agent?: string | null
        }
        Update: {
          connection_type?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          is_good?: boolean | null
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number
          page_url?: string | null
          recorded_at?: string
          threshold_good?: number | null
          threshold_needs_improvement?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      platform_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          expense_category_id: string | null
          external_id: string | null
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          metadata: Json | null
          payment_id: string | null
          platform_id: string
          reference_number: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          expense_category_id?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          metadata?: Json | null
          payment_id?: string | null
          platform_id: string
          reference_number?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          expense_category_id?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          metadata?: Json | null
          payment_id?: string | null
          platform_id?: string
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_transactions_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_transactions_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          api_config: Json | null
          api_enabled: boolean | null
          category: string | null
          created_at: string | null
          default_expense_account_id: string | null
          default_income_account_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          monthly_budget: number | null
          name: string
          notes: string | null
          platform_type: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          api_config?: Json | null
          api_enabled?: boolean | null
          category?: string | null
          created_at?: string | null
          default_expense_account_id?: string | null
          default_income_account_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_budget?: number | null
          name: string
          notes?: string | null
          platform_type: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          api_config?: Json | null
          api_enabled?: boolean | null
          category?: string | null
          created_at?: string | null
          default_expense_account_id?: string | null
          default_income_account_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          monthly_budget?: number | null
          name?: string
          notes?: string | null
          platform_type?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platforms_default_expense_account_id_fkey"
            columns: ["default_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platforms_default_income_account_id_fkey"
            columns: ["default_income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_settings: {
        Row: {
          availability_status: string | null
          availability_text: string | null
          bio_headline: string | null
          bio_subheadline: string | null
          calendly_url: string | null
          created_at: string | null
          email: string | null
          github_url: string | null
          hero_tagline: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          phone: string | null
          profile_photo_url: string | null
          resume_url: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          availability_status?: string | null
          availability_text?: string | null
          bio_headline?: string | null
          bio_subheadline?: string | null
          calendly_url?: string | null
          created_at?: string | null
          email?: string | null
          github_url?: string | null
          hero_tagline?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          resume_url?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          availability_status?: string | null
          availability_text?: string | null
          bio_headline?: string | null
          bio_subheadline?: string | null
          calendly_url?: string | null
          created_at?: string | null
          email?: string | null
          github_url?: string | null
          hero_tagline?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          resume_url?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: []
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
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          auto_create: boolean | null
          auto_post: boolean | null
          contact_id: string | null
          created_at: string | null
          currency_id: string | null
          days_in_advance: number | null
          description: string | null
          end_date: string | null
          expense_category_id: string | null
          frequency: string
          id: string
          interval_count: number | null
          is_active: boolean | null
          last_created_date: string | null
          name: string
          next_due_date: string | null
          notes: string | null
          payment_method: string | null
          platform_id: string | null
          reference_number: string | null
          start_date: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          auto_create?: boolean | null
          auto_post?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          days_in_advance?: number | null
          description?: string | null
          end_date?: string | null
          expense_category_id?: string | null
          frequency: string
          id?: string
          interval_count?: number | null
          is_active?: boolean | null
          last_created_date?: string | null
          name: string
          next_due_date?: string | null
          notes?: string | null
          payment_method?: string | null
          platform_id?: string | null
          reference_number?: string | null
          start_date: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          auto_create?: boolean | null
          auto_post?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          days_in_advance?: number | null
          description?: string | null
          end_date?: string | null
          expense_category_id?: string | null
          frequency?: string
          id?: string
          interval_count?: number | null
          is_active?: boolean | null
          last_created_date?: string | null
          name?: string
          next_due_date?: string | null
          notes?: string | null
          payment_method?: string | null
          platform_id?: string | null
          reference_number?: string | null
          start_date?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_vault_access_log: {
        Row: {
          accessed_at: string | null
          action: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          vault_item_id: string | null
        }
        Insert: {
          accessed_at?: string | null
          action: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          vault_item_id?: string | null
        }
        Update: {
          accessed_at?: string | null
          action?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          vault_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secure_vault_access_log_vault_item_id_fkey"
            columns: ["vault_item_id"]
            isOneToOne: false
            referencedRelation: "secure_vault_items"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_vault_items: {
        Row: {
          created_at: string | null
          encrypted_value: string
          id: string
          last_accessed_at: string | null
          name: string
          notes: string | null
          project_id: string | null
          type_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_value: string
          id?: string
          last_accessed_at?: string | null
          name: string
          notes?: string | null
          project_id?: string | null
          type_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_value?: string
          id?: string
          last_accessed_at?: string | null
          name?: string
          notes?: string | null
          project_id?: string | null
          type_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_vault_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "task_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secure_vault_items_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "secure_vault_types"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_vault_types: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
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
      subtasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks_full_view"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_category_confidence: number | null
          ai_sentiment_score: number | null
          ai_similar_tickets: string[] | null
          ai_suggested_kb_articles: string[] | null
          ai_suggested_responses: Json | null
          assigned_to: string | null
          browser_info: Json | null
          category: string | null
          closed_at: string | null
          created_at: string
          email_in_reply_to: string | null
          email_message_id: string | null
          email_thread_id: string | null
          error_context: Json | null
          first_response_at: string | null
          id: string
          internal_notes: string | null
          last_activity_at: string | null
          mailbox_id: string | null
          message: string
          metadata: Json | null
          page_url: string | null
          priority: number | null
          referrer_url: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          satisfaction_submitted_at: string | null
          session_id: string | null
          status: string | null
          subject: string
          tags: string[] | null
          ticket_number: string
          user_agent: string | null
          user_email: string | null
          user_history: Json | null
          user_name: string | null
        }
        Insert: {
          ai_category_confidence?: number | null
          ai_sentiment_score?: number | null
          ai_similar_tickets?: string[] | null
          ai_suggested_kb_articles?: string[] | null
          ai_suggested_responses?: Json | null
          assigned_to?: string | null
          browser_info?: Json | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          email_in_reply_to?: string | null
          email_message_id?: string | null
          email_thread_id?: string | null
          error_context?: Json | null
          first_response_at?: string | null
          id?: string
          internal_notes?: string | null
          last_activity_at?: string | null
          mailbox_id?: string | null
          message: string
          metadata?: Json | null
          page_url?: string | null
          priority?: number | null
          referrer_url?: string | null
          resolved_at?: string | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          satisfaction_submitted_at?: string | null
          session_id?: string | null
          status?: string | null
          subject: string
          tags?: string[] | null
          ticket_number: string
          user_agent?: string | null
          user_email?: string | null
          user_history?: Json | null
          user_name?: string | null
        }
        Update: {
          ai_category_confidence?: number | null
          ai_sentiment_score?: number | null
          ai_similar_tickets?: string[] | null
          ai_suggested_kb_articles?: string[] | null
          ai_suggested_responses?: Json | null
          assigned_to?: string | null
          browser_info?: Json | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          email_in_reply_to?: string | null
          email_message_id?: string | null
          email_thread_id?: string | null
          error_context?: Json | null
          first_response_at?: string | null
          id?: string
          internal_notes?: string | null
          last_activity_at?: string | null
          mailbox_id?: string | null
          message?: string
          metadata?: Json | null
          page_url?: string | null
          priority?: number | null
          referrer_url?: string | null
          resolved_at?: string | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          satisfaction_submitted_at?: string | null
          session_id?: string | null
          status?: string | null
          subject?: string
          tags?: string[] | null
          ticket_number?: string
          user_agent?: string | null
          user_email?: string | null
          user_history?: Json | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "email_mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          page_url: string | null
          recorded_at: string
          unit: string | null
          user_agent: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          page_url?: string | null
          recorded_at?: string
          unit?: string | null
          user_agent?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          page_url?: string | null
          recorded_at?: string
          unit?: string | null
          user_agent?: string | null
          value?: number
        }
        Relationships: []
      }
      task_projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          domain: string | null
          id: string
          metadata: Json | null
          name: string
          platform: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          metadata?: Json | null
          name: string
          platform?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          platform?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category: string | null
          comments: string | null
          completed_at: string | null
          created_at: string
          dependencies: string | null
          description: string | null
          due_date: string | null
          effort: string | null
          id: string
          links: Json | null
          metadata: Json | null
          original_priority: string | null
          priority: string | null
          project_id: string | null
          source: string | null
          start_date: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          comments?: string | null
          completed_at?: string | null
          created_at?: string
          dependencies?: string | null
          description?: string | null
          due_date?: string | null
          effort?: string | null
          id?: string
          links?: Json | null
          metadata?: Json | null
          original_priority?: string | null
          priority?: string | null
          project_id?: string | null
          source?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          comments?: string | null
          completed_at?: string | null
          created_at?: string
          dependencies?: string | null
          description?: string | null
          due_date?: string | null
          effort?: string | null
          id?: string
          links?: Json | null
          metadata?: Json | null
          original_priority?: string | null
          priority?: string | null
          project_id?: string | null
          source?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "task_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          account_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          client_company: string | null
          client_name: string
          client_photo_url: string | null
          client_title: string | null
          created_at: string | null
          display_order: number | null
          featured: boolean | null
          id: string
          project_type: string | null
          project_url: string | null
          rating: number | null
          status: string | null
          testimonial_text: string
          updated_at: string | null
        }
        Insert: {
          client_company?: string | null
          client_name: string
          client_photo_url?: string | null
          client_title?: string | null
          created_at?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          project_type?: string | null
          project_url?: string | null
          rating?: number | null
          status?: string | null
          testimonial_text: string
          updated_at?: string | null
        }
        Update: {
          client_company?: string | null
          client_name?: string
          client_photo_url?: string | null
          client_title?: string | null
          created_at?: string | null
          display_order?: number | null
          featured?: boolean | null
          id?: string
          project_type?: string | null
          project_url?: string | null
          rating?: number | null
          status?: string | null
          testimonial_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_activity_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_responses: {
        Row: {
          attachments: Json | null
          author_email: string
          author_id: string | null
          author_name: string
          author_type: string
          created_at: string
          id: string
          is_ai_generated: boolean | null
          is_internal: boolean | null
          message: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          author_email: string
          author_id?: string | null
          author_name: string
          author_type: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          message: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          author_email?: string
          author_id?: string | null
          author_name?: string
          author_type?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          message?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
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
      ventures: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          featured: boolean | null
          github_url: string | null
          id: string
          launch_date: string | null
          live_url: string | null
          logo_url: string | null
          metrics: Json | null
          name: string
          screenshot_url: string | null
          status: string | null
          tagline: string | null
          tech_stack: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          github_url?: string | null
          id?: string
          launch_date?: string | null
          live_url?: string | null
          logo_url?: string | null
          metrics?: Json | null
          name: string
          screenshot_url?: string | null
          status?: string | null
          tagline?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          github_url?: string | null
          id?: string
          launch_date?: string | null
          live_url?: string | null
          logo_url?: string | null
          metrics?: Json | null
          name?: string
          screenshot_url?: string | null
          status?: string | null
          tagline?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      tasks_full_view: {
        Row: {
          assigned_to: string | null
          category: string | null
          comments: string | null
          completed_at: string | null
          completed_subtasks: number | null
          created_at: string | null
          dependencies: string | null
          description: string | null
          due_date: string | null
          effort: string | null
          id: string | null
          links: Json | null
          metadata: Json | null
          original_priority: string | null
          priority: string | null
          project_color: string | null
          project_domain: string | null
          project_id: string | null
          project_name: string | null
          project_platform: string | null
          source: string | null
          start_date: string | null
          status: string | null
          subtask_count: number | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "task_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_next_due_date: {
        Args: {
          p_frequency: string
          p_interval_count: number
          p_last_date: string
        }
        Returns: string
      }
      calculate_next_run: {
        Args: { cron_expr: string; from_time?: string }
        Returns: string
      }
      check_alert_rules: { Args: never; Returns: undefined }
      claim_amazon_throttle: {
        Args: { min_interval_ms?: number }
        Returns: {
          day_key: string
          used_today: number
          wait_ms: number
        }[]
      }
      generate_ticket_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_canned_response_usage: {
        Args: { response_id: string }
        Returns: undefined
      }
      increment_kb_helpful: {
        Args: { article_id: string; helpful: boolean }
        Returns: undefined
      }
      log_admin_activity: {
        Args: {
          p_action: string
          p_action_category?: string
          p_admin_email: string
          p_metadata?: Json
          p_resource_id?: string
          p_resource_title?: string
          p_resource_type?: string
        }
        Returns: string
      }
      log_ticket_activity: {
        Args: {
          p_action: string
          p_actor_email: string
          p_metadata?: Json
          p_new_value?: string
          p_old_value?: string
          p_ticket_id: string
        }
        Returns: string
      }
      map_priority: { Args: { original_priority: string }; Returns: string }
      map_status: { Args: { original_status: string }; Returns: string }
      record_maintenance_run: {
        Args: {
          p_details?: Json
          p_duration: number
          p_error_message?: string
          p_issues_fixed?: number
          p_issues_found?: number
          p_status: string
          p_task_id: string
        }
        Returns: string
      }
      record_metric: {
        Args: {
          p_metadata?: Json
          p_metric_name: string
          p_metric_type: string
          p_unit?: string
          p_value: number
        }
        Returns: string
      }
      update_link_health: {
        Args: {
          p_article_id: string
          p_redirect_url?: string
          p_response_time: number
          p_status_code: number
          p_url: string
        }
        Returns: undefined
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
