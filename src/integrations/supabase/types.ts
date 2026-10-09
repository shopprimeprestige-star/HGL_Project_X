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
      /*  ── ⚠️ GENERATE DALLO SCHEMA VERO, NON SCRITTE A MANO ──────────────
          Otto tabelle mancavano del tutto (app_config, quote_requests,
          discount_codes, shop_orders e i quattro `webinar_*`) e altre avevano
          colonne aggiunte dopo l'ultima generazione. Conseguenza, in tutto il
          repo: ogni lettura e ogni scrittura passava da un cast —
          `from("app_config" as never)`, `as unknown as {...}` — e con il cast
          TypeScript smette di controllare i NOMI DELLE COLONNE. Un refuso non
          dava errore: falliva a runtime, spesso dentro un `catch` muto. Erano
          213 errori di compilazione dichiarati «rumore noto», e nascondevano
          un buco vero (il primo trovato rigenerandole: una query sulla tabella
          `quotes`, che non esiste — si chiama `quote_requests`).
          Ricavate dallo schema esposto da PostgREST: l'elenco `required` dice
          quali colonne sono NOT NULL, `default` quali si possono omettere
          scrivendo. Combaciano con la produzione al giorno in cui sono state
          scritte.
          ⚠️ Da rifare quando si aggiunge una colonna: `supabase gen types` se
           si ha il token, oppure dallo stesso schema OpenAPI. */
      ad_score_history: {
        Row: {
          id: string
          user_id: string
          ad_id: string
          snapshot_date: string
          score: number
          sub_scores: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ad_id: string
          snapshot_date: string
          score?: number
          sub_scores: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ad_id?: string
          snapshot_date?: string
          score?: number
          sub_scores?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consultant_applications: {
        Row: {
          id: string
          nome: string
          email: string
          telefono: string | null
          citta: string | null
          esperienza: string | null
          motivazione: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          consultant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          email: string
          telefono?: string | null
          citta?: string | null
          esperienza?: string | null
          motivazione?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          consultant_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          telefono?: string | null
          citta?: string | null
          esperienza?: string | null
          motivazione?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          consultant_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultant_google_tokens: {
        Row: {
          id: string
          consultant_id: string
          access_token: string | null
          refresh_token: string | null
          token_expiry: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          consultant_id: string
          access_token?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          consultant_id?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultant_pins: {
        Row: {
          id: string
          admin_user_id: string
          consultant_id: string
          pin: string
          permissions: Json
          commission_percentage: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id: string
          consultant_id: string
          pin: string
          permissions: Json
          commission_percentage?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string
          consultant_id?: string
          pin?: string
          permissions?: Json
          commission_percentage?: number
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      crm_ad_spending: {
        Row: {
          id: string
          user_id: string
          data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          data: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_consultants: {
        Row: {
          id: string
          user_id: string
          data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          data: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          id: string
          user_id: string
          data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          data: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          id: string
          created_at: string
          code: string
          label: string | null
          discount_eur: number
          stock_total: number | null
          stock_left: number | null
          active: boolean
          auto_apply: boolean
          apply_message: string | null
          scarcity_title: string | null
          scarcity_text: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          code: string
          label?: string | null
          discount_eur?: number
          stock_total?: number | null
          stock_left?: number | null
          active?: boolean
          auto_apply?: boolean
          apply_message?: string | null
          scarcity_title?: string | null
          scarcity_text?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          code?: string
          label?: string | null
          discount_eur?: number
          stock_total?: number | null
          stock_left?: number | null
          active?: boolean
          auto_apply?: boolean
          apply_message?: string | null
          scarcity_title?: string | null
          scarcity_text?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          id: string
          rate_date: string
          currency: string
          rate_vs_eur: number
          fetched_at: string
        }
        Insert: {
          id?: string
          rate_date: string
          currency: string
          rate_vs_eur: number
          fetched_at?: string
        }
        Update: {
          id?: string
          rate_date?: string
          currency?: string
          rate_vs_eur?: number
          fetched_at?: string
        }
        Relationships: []
      }
      funnel_settings: {
        Row: {
          id: string
          user_id: string
          time_slots: string[]
          blocked_weekdays: number[]
          blocked_dates: string[]
          blocked_slots: Json
          created_at: string
          updated_at: string
          slots_mode: string
          weekly_slots: Json
        }
        Insert: {
          id?: string
          user_id: string
          time_slots: string[]
          blocked_weekdays: number[]
          blocked_dates: string[]
          blocked_slots: Json
          created_at?: string
          updated_at?: string
          slots_mode?: string
          weekly_slots: Json
        }
        Update: {
          id?: string
          user_id?: string
          time_slots?: string[]
          blocked_weekdays?: number[]
          blocked_dates?: string[]
          blocked_slots?: Json
          created_at?: string
          updated_at?: string
          slots_mode?: string
          weekly_slots?: Json
        }
        Relationships: []
      }
      landing_content: {
        Row: {
          id: string
          data: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          data: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lead_google_events: {
        Row: {
          id: string
          lead_id: string
          consultant_id: string
          google_event_id: string
          meet_link: string | null
          event_start: string | null
          event_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          consultant_id: string
          google_event_id: string
          meet_link?: string | null
          event_start?: string | null
          event_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          consultant_id?: string
          google_event_id?: string
          meet_link?: string | null
          event_start?: string | null
          event_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lp_events: {
        Row: {
          id: string
          created_at: string
          event_name: string
          session_id: string
          step: number | null
          payload: Json
          utm_source: string | null
          ip_hash: string | null
          city: string | null
          device: string | null
          is_bot: boolean
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          ad_name: string | null
          creative_name: string | null
          external_id: string | null
          fbclid: string | null
          fbc: string | null
          fbp: string | null
          utm_id: string | null
          utm_content: string | null
          utm_term: string | null
          utm_medium: string | null
          utm_campaign: string | null
          time_on_page: number | null
          max_scroll: number | null
          capi_sent: boolean
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          event_name: string
          session_id: string
          step?: number | null
          payload: Json
          utm_source?: string | null
          ip_hash?: string | null
          city?: string | null
          device?: string | null
          is_bot?: boolean
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          creative_name?: string | null
          external_id?: string | null
          fbclid?: string | null
          fbc?: string | null
          fbp?: string | null
          utm_id?: string | null
          utm_content?: string | null
          utm_term?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          time_on_page?: number | null
          max_scroll?: number | null
          capi_sent?: boolean
          user_agent?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          event_name?: string
          session_id?: string
          step?: number | null
          payload?: Json
          utm_source?: string | null
          ip_hash?: string | null
          city?: string | null
          device?: string | null
          is_bot?: boolean
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          creative_name?: string | null
          external_id?: string | null
          fbclid?: string | null
          fbc?: string | null
          fbp?: string | null
          utm_id?: string | null
          utm_content?: string | null
          utm_term?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          time_on_page?: number | null
          max_scroll?: number | null
          capi_sent?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      meta_ad_spend: {
        Row: {
          id: string
          user_id: string
          spend_date: string
          ad_id: string
          adset_id: string | null
          campaign_id: string | null
          ad_name: string | null
          campaign_name: string | null
          spend: number
          impressions: number
          clicks: number
          currency: string | null
          fetched_at: string
          video_plays: number
          video_p25_watched: number
          video_p50_watched: number
          video_p75_watched: number
          video_p100_watched: number
          video_thruplays: number
          outbound_clicks: number
          link_clicks: number
          post_engagement: number
          landing_page_views: number
          reach: number
          frequency: number
          video_3_sec_watched: number
          video_15_sec_watched: number
          video_avg_time_watched: number
          video_continuous_2_sec_watched: number
        }
        Insert: {
          id?: string
          user_id: string
          spend_date: string
          ad_id: string
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          campaign_name?: string | null
          spend?: number
          impressions?: number
          clicks?: number
          currency?: string | null
          fetched_at?: string
          video_plays?: number
          video_p25_watched?: number
          video_p50_watched?: number
          video_p75_watched?: number
          video_p100_watched?: number
          video_thruplays?: number
          outbound_clicks?: number
          link_clicks?: number
          post_engagement?: number
          landing_page_views?: number
          reach?: number
          frequency?: number
          video_3_sec_watched?: number
          video_15_sec_watched?: number
          video_avg_time_watched?: number
          video_continuous_2_sec_watched?: number
        }
        Update: {
          id?: string
          user_id?: string
          spend_date?: string
          ad_id?: string
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          campaign_name?: string | null
          spend?: number
          impressions?: number
          clicks?: number
          currency?: string | null
          fetched_at?: string
          video_plays?: number
          video_p25_watched?: number
          video_p50_watched?: number
          video_p75_watched?: number
          video_p100_watched?: number
          video_thruplays?: number
          outbound_clicks?: number
          link_clicks?: number
          post_engagement?: number
          landing_page_views?: number
          reach?: number
          frequency?: number
          video_3_sec_watched?: number
          video_15_sec_watched?: number
          video_avg_time_watched?: number
          video_continuous_2_sec_watched?: number
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          user_id: string
          muted_kinds: string[]
          lps_min_threshold: number
          cpl_over_budget_pct: number
          no_lead_hours: number
          email_target: string | null
          email_critical_enabled: boolean
          updated_at: string
          created_at: string
        }
        Insert: {
          user_id: string
          muted_kinds: string[]
          lps_min_threshold?: number
          cpl_over_budget_pct?: number
          no_lead_hours?: number
          email_target?: string | null
          email_critical_enabled?: boolean
          updated_at?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          muted_kinds?: string[]
          lps_min_threshold?: number
          cpl_over_budget_pct?: number
          no_lead_hours?: number
          email_target?: string | null
          email_critical_enabled?: boolean
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          kind: string
          severity: string
          title: string
          body: string | null
          link: string | null
          dedupe_key: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          severity?: string
          title: string
          body?: string | null
          link?: string | null
          dedupe_key: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          severity?: string
          title?: string
          body?: string | null
          link?: string | null
          dedupe_key?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      public_leads: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          nome: string
          cognome: string
          email: string
          telefono: string
          citta: string
          data_slot: string | null
          ora_slot: string | null
          disagio_score: number | null
          pain_points: string[]
          urgenza: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          fbp: string | null
          fbc: string | null
          ttclid: string | null
          ip_hash: string | null
          user_agent: string | null
          event_id: string | null
          status: string
          assigned_to_user_id: string | null
          assigned_consultant_id: string | null
          meet_link: string | null
          notes: string | null
          slot_released: boolean
          slot_pending: boolean
          portatore: boolean | null
          accepted_at: string | null
          accepted_by_consultant_id: string | null
          reminder_sent_at: string | null
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          ad_name: string | null
          creative_name: string | null
          external_id: string | null
          fbclid: string | null
          utm_id: string | null
          utm_content: string | null
          utm_term: string | null
          capi_sent: boolean
          capi_sent_at: string | null
          touch_history: Json
          touch_count: number
          first_channel: string | null
          last_channel: string | null
          journey_type: string | null
          days_to_convert: number | null
          hours_to_convert: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          nome: string
          cognome: string
          email: string
          telefono: string
          citta: string
          data_slot?: string | null
          ora_slot?: string | null
          disagio_score?: number | null
          pain_points: string[]
          urgenza?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          fbp?: string | null
          fbc?: string | null
          ttclid?: string | null
          ip_hash?: string | null
          user_agent?: string | null
          event_id?: string | null
          status?: string
          assigned_to_user_id?: string | null
          assigned_consultant_id?: string | null
          meet_link?: string | null
          notes?: string | null
          slot_released?: boolean
          slot_pending?: boolean
          portatore?: boolean | null
          accepted_at?: string | null
          accepted_by_consultant_id?: string | null
          reminder_sent_at?: string | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          creative_name?: string | null
          external_id?: string | null
          fbclid?: string | null
          utm_id?: string | null
          utm_content?: string | null
          utm_term?: string | null
          capi_sent?: boolean
          capi_sent_at?: string | null
          touch_history: Json
          touch_count?: number
          first_channel?: string | null
          last_channel?: string | null
          journey_type?: string | null
          days_to_convert?: number | null
          hours_to_convert?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          nome?: string
          cognome?: string
          email?: string
          telefono?: string
          citta?: string
          data_slot?: string | null
          ora_slot?: string | null
          disagio_score?: number | null
          pain_points?: string[]
          urgenza?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          fbp?: string | null
          fbc?: string | null
          ttclid?: string | null
          ip_hash?: string | null
          user_agent?: string | null
          event_id?: string | null
          status?: string
          assigned_to_user_id?: string | null
          assigned_consultant_id?: string | null
          meet_link?: string | null
          notes?: string | null
          slot_released?: boolean
          slot_pending?: boolean
          portatore?: boolean | null
          accepted_at?: string | null
          accepted_by_consultant_id?: string | null
          reminder_sent_at?: string | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          creative_name?: string | null
          external_id?: string | null
          fbclid?: string | null
          utm_id?: string | null
          utm_content?: string | null
          utm_term?: string | null
          capi_sent?: boolean
          capi_sent_at?: string | null
          touch_history?: Json
          touch_count?: number
          first_channel?: string | null
          last_channel?: string | null
          journey_type?: string | null
          days_to_convert?: number | null
          hours_to_convert?: number | null
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          id: string
          created_at: string
          quote_ref: string
          nome: string
          email: string
          telefono: string
          eta: number | null
          grey_pct: number | null
          color_code: string | null
          problemi: string | null
          note: string | null
          base_choice: string | null
          base_system: Json | null
          upsells: Json
          discount_code: string | null
          discount_eur: number
          total: number
          status: string
          cognome: string | null
          qty: number
          fitting_mode: string
          timeline_start: string | null
          timeline_steps: Json
        }
        Insert: {
          id?: string
          created_at?: string
          quote_ref: string
          nome: string
          email: string
          telefono: string
          eta?: number | null
          grey_pct?: number | null
          color_code?: string | null
          problemi?: string | null
          note?: string | null
          base_choice?: string | null
          base_system?: Json | null
          upsells: Json
          discount_code?: string | null
          discount_eur?: number
          total?: number
          status?: string
          cognome?: string | null
          qty?: number
          fitting_mode?: string
          timeline_start?: string | null
          timeline_steps: Json
        }
        Update: {
          id?: string
          created_at?: string
          quote_ref?: string
          nome?: string
          email?: string
          telefono?: string
          eta?: number | null
          grey_pct?: number | null
          color_code?: string | null
          problemi?: string | null
          note?: string | null
          base_choice?: string | null
          base_system?: Json | null
          upsells?: Json
          discount_code?: string | null
          discount_eur?: number
          total?: number
          status?: string
          cognome?: string | null
          qty?: number
          fitting_mode?: string
          timeline_start?: string | null
          timeline_steps?: Json
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          id: string
          created_at: string
          order_ref: string
          nome: string
          cognome: string
          email: string
          telefono: string
          indirizzo: string
          citta: string
          cap: string
          note: string | null
          items: Json
          subtotal: number
          shipping: number
          total: number
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          order_ref: string
          nome: string
          cognome: string
          email: string
          telefono: string
          indirizzo: string
          citta: string
          cap: string
          note?: string | null
          items: Json
          subtotal?: number
          shipping?: number
          total?: number
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          order_ref?: string
          nome?: string
          cognome?: string
          email?: string
          telefono?: string
          indirizzo?: string
          citta?: string
          cap?: string
          note?: string | null
          items?: Json
          subtotal?: number
          shipping?: number
          total?: number
          status?: string
        }
        Relationships: []
      }
      tiktok_ad_spend: {
        Row: {
          id: string
          user_id: string
          spend_date: string
          ad_id: string
          adset_id: string | null
          campaign_id: string | null
          ad_name: string | null
          campaign_name: string | null
          spend: number
          impressions: number
          clicks: number
          reach: number
          frequency: number
          currency: string | null
          video_views: number
          video_views_p25: number
          video_views_p50: number
          video_views_p75: number
          video_views_p100: number
          video_play_actions: number
          video_watched_2s: number
          video_watched_6s: number
          average_video_play: number
          likes: number
          comments: number
          shares: number
          follows: number
          profile_visits: number
          conversions: number
          cost_per_conversion: number
          conversion_rate: number
          fetched_at: string
        }
        Insert: {
          id?: string
          user_id: string
          spend_date: string
          ad_id: string
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          campaign_name?: string | null
          spend?: number
          impressions?: number
          clicks?: number
          reach?: number
          frequency?: number
          currency?: string | null
          video_views?: number
          video_views_p25?: number
          video_views_p50?: number
          video_views_p75?: number
          video_views_p100?: number
          video_play_actions?: number
          video_watched_2s?: number
          video_watched_6s?: number
          average_video_play?: number
          likes?: number
          comments?: number
          shares?: number
          follows?: number
          profile_visits?: number
          conversions?: number
          cost_per_conversion?: number
          conversion_rate?: number
          fetched_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          spend_date?: string
          ad_id?: string
          adset_id?: string | null
          campaign_id?: string | null
          ad_name?: string | null
          campaign_name?: string | null
          spend?: number
          impressions?: number
          clicks?: number
          reach?: number
          frequency?: number
          currency?: string | null
          video_views?: number
          video_views_p25?: number
          video_views_p50?: number
          video_views_p75?: number
          video_views_p100?: number
          video_play_actions?: number
          video_watched_2s?: number
          video_watched_6s?: number
          average_video_play?: number
          likes?: number
          comments?: number
          shares?: number
          follows?: number
          profile_visits?: number
          conversions?: number
          cost_per_conversion?: number
          conversion_rate?: number
          fetched_at?: string
        }
        Relationships: []
      }
      tracking_config: {
        Row: {
          user_id: string
          meta_pixel_id: string | null
          meta_access_token: string | null
          meta_test_event_code: string | null
          tiktok_pixel_id: string | null
          tiktok_access_token: string | null
          daily_spend_meta: number
          daily_spend_tiktok: number
          iva_included: boolean
          created_at: string
          updated_at: string
          meta_ad_account_id: string | null
          margine_profitto_pct: number
          costo_prodotto: number
          ads_history_start: string | null
          fatigue_freq_threshold: number
          fatigue_scroll_threshold: number
          fatigue_time_threshold: number
          fatigue_alerts_enabled: boolean
          daily_spend_organico: number
          tiktok_advertiser_id: string | null
          tiktok_test_event_code: string | null
          tiktok_ads_history_start: string | null
          meta_page_id: string | null
          meta_page_access_token: string | null
          meta_leadgen_verify_token: string | null
          meta_app_secret: string | null
        }
        Insert: {
          user_id: string
          meta_pixel_id?: string | null
          meta_access_token?: string | null
          meta_test_event_code?: string | null
          tiktok_pixel_id?: string | null
          tiktok_access_token?: string | null
          daily_spend_meta?: number
          daily_spend_tiktok?: number
          iva_included?: boolean
          created_at?: string
          updated_at?: string
          meta_ad_account_id?: string | null
          margine_profitto_pct?: number
          costo_prodotto?: number
          ads_history_start?: string | null
          fatigue_freq_threshold?: number
          fatigue_scroll_threshold?: number
          fatigue_time_threshold?: number
          fatigue_alerts_enabled?: boolean
          daily_spend_organico?: number
          tiktok_advertiser_id?: string | null
          tiktok_test_event_code?: string | null
          tiktok_ads_history_start?: string | null
          meta_page_id?: string | null
          meta_page_access_token?: string | null
          meta_leadgen_verify_token?: string | null
          meta_app_secret?: string | null
        }
        Update: {
          user_id?: string
          meta_pixel_id?: string | null
          meta_access_token?: string | null
          meta_test_event_code?: string | null
          tiktok_pixel_id?: string | null
          tiktok_access_token?: string | null
          daily_spend_meta?: number
          daily_spend_tiktok?: number
          iva_included?: boolean
          created_at?: string
          updated_at?: string
          meta_ad_account_id?: string | null
          margine_profitto_pct?: number
          costo_prodotto?: number
          ads_history_start?: string | null
          fatigue_freq_threshold?: number
          fatigue_scroll_threshold?: number
          fatigue_time_threshold?: number
          fatigue_alerts_enabled?: boolean
          daily_spend_organico?: number
          tiktok_advertiser_id?: string | null
          tiktok_test_event_code?: string | null
          tiktok_ads_history_start?: string | null
          meta_page_id?: string | null
          meta_page_access_token?: string | null
          meta_leadgen_verify_token?: string | null
          meta_app_secret?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          is_admin: boolean
          scheme_access: string[]
          display_name: string | null
          created_at: string
          updated_at: string
          can_accept_leads: boolean
        }
        Insert: {
          user_id: string
          is_admin?: boolean
          scheme_access: string[]
          display_name?: string | null
          created_at?: string
          updated_at?: string
          can_accept_leads?: boolean
        }
        Update: {
          user_id?: string
          is_admin?: boolean
          scheme_access?: string[]
          display_name?: string | null
          created_at?: string
          updated_at?: string
          can_accept_leads?: boolean
        }
        Relationships: []
      }
      webinar_messaggi: {
        Row: {
          id: string
          codice: string
          spettatore: string | null
          autore: string
          ruolo: string
          testo: string
          fissato: boolean
          creato_il: string
        }
        Insert: {
          id?: string
          codice: string
          spettatore?: string | null
          autore: string
          ruolo?: string
          testo: string
          fissato?: boolean
          creato_il?: string
        }
        Update: {
          id?: string
          codice?: string
          spettatore?: string | null
          autore?: string
          ruolo?: string
          testo?: string
          fissato?: boolean
          creato_il?: string
        }
        Relationships: []
      }
      webinar_palco: {
        Row: {
          codice: string
          spettatore: string
          nome: string
          stato: string
          microfono: boolean
          parla: boolean
          pass: string | null
          session_id: string | null
          traccia_audio: string | null
          traccia_video: string | null
          salito_il: string
        }
        Insert: {
          codice: string
          spettatore: string
          nome?: string
          stato?: string
          microfono?: boolean
          parla?: boolean
          pass?: string | null
          session_id?: string | null
          traccia_audio?: string | null
          traccia_video?: string | null
          salito_il?: string
        }
        Update: {
          codice?: string
          spettatore?: string
          nome?: string
          stato?: string
          microfono?: boolean
          parla?: boolean
          pass?: string | null
          session_id?: string | null
          traccia_audio?: string | null
          traccia_video?: string | null
          salito_il?: string
        }
        Relationships: []
      }
      webinar_presenze: {
        Row: {
          codice: string
          spettatore: string
          nome: string | null
          visto_il: string
          larghezza: number | null
          altezza: number | null
        }
        Insert: {
          codice: string
          spettatore: string
          nome?: string | null
          visto_il?: string
          larghezza?: number | null
          altezza?: number | null
        }
        Update: {
          codice?: string
          spettatore?: string
          nome?: string | null
          visto_il?: string
          larghezza?: number | null
          altezza?: number | null
        }
        Relationships: []
      }
      webinar_programmati: {
        Row: {
          id: string
          codice: string
          minuto: number
          testo: string
          fissa: boolean
          inviato_il: string | null
          creato_il: string
        }
        Insert: {
          id?: string
          codice: string
          minuto?: number
          testo: string
          fissa?: boolean
          inviato_il?: string | null
          creato_il?: string
        }
        Update: {
          id?: string
          codice?: string
          minuto?: number
          testo?: string
          fissa?: boolean
          inviato_il?: string | null
          creato_il?: string
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          id: string
          user_id: string
          phone_e164: string
          lead_id: string | null
          display_name: string | null
          last_message_at: string | null
          unread_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phone_e164: string
          lead_id?: string | null
          display_name?: string | null
          last_message_at?: string | null
          unread_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          phone_e164?: string
          lead_id?: string | null
          display_name?: string | null
          last_message_at?: string | null
          unread_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          id: string
          user_id: string
          lead_id: string | null
          wa_message_id: string | null
          direction: string
          from_number: string
          to_number: string
          body: string | null
          media_url: string | null
          media_type: string | null
          status: string
          error_message: string | null
          created_at: string
          delivered_at: string | null
          read_at: string | null
          raw_payload: Json
        }
        Insert: {
          id?: string
          user_id: string
          lead_id?: string | null
          wa_message_id?: string | null
          direction: string
          from_number: string
          to_number: string
          body?: string | null
          media_url?: string | null
          media_type?: string | null
          status?: string
          error_message?: string | null
          created_at?: string
          delivered_at?: string | null
          read_at?: string | null
          raw_payload: Json
        }
        Update: {
          id?: string
          user_id?: string
          lead_id?: string | null
          wa_message_id?: string | null
          direction?: string
          from_number?: string
          to_number?: string
          body?: string | null
          media_url?: string | null
          media_type?: string | null
          status?: string
          error_message?: string | null
          created_at?: string
          delivered_at?: string | null
          read_at?: string | null
          raw_payload?: Json
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          user_id: string
          phone_number_id: string | null
          business_account_id: string | null
          access_token: string | null
          webhook_verify_token: string | null
          app_secret: string | null
          created_at: string
          updated_at: string
          mode: string
          status_template_map: Json
          default_values: Json
          disabled_template_statuses: string[]
        }
        Insert: {
          user_id: string
          phone_number_id?: string | null
          business_account_id?: string | null
          access_token?: string | null
          webhook_verify_token?: string | null
          app_secret?: string | null
          created_at?: string
          updated_at?: string
          mode?: string
          status_template_map: Json
          default_values: Json
          disabled_template_statuses: string[]
        }
        Update: {
          user_id?: string
          phone_number_id?: string | null
          business_account_id?: string | null
          access_token?: string | null
          webhook_verify_token?: string | null
          app_secret?: string | null
          created_at?: string
          updated_at?: string
          mode?: string
          status_template_map?: Json
          default_values?: Json
          disabled_template_statuses?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_meta_sync_cron_history: {
        Args: never
        Returns: {
          end_time: string
          jobid: number
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      is_app_admin: { Args: { _user: string }; Returns: boolean }
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
