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
      bike_library_labour: {
        Row: {
          created_at: string
          hours: number | null
          id: string
          is_archived: boolean
          model_id: string
          notes: string | null
          parts_cost: number | null
          parts_required: string | null
          sort_order: number
          source: Database["public"]["Enums"]["garage_source"]
          special_tools: string | null
          task: string
          updated_at: string
          updated_by: string | null
          verification: Database["public"]["Enums"]["garage_verification"]
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          hours?: number | null
          id?: string
          is_archived?: boolean
          model_id: string
          notes?: string | null
          parts_cost?: number | null
          parts_required?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          special_tools?: string | null
          task: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          hours?: number | null
          id?: string
          is_archived?: boolean
          model_id?: string
          notes?: string | null
          parts_cost?: number | null
          parts_required?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          special_tools?: string | null
          task?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_library_labour_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_library_model_aliases: {
        Row: {
          alias: string
          alias_norm: string
          created_at: string
          created_by: string | null
          id: string
          model_id: string
        }
        Insert: {
          alias: string
          alias_norm: string
          created_at?: string
          created_by?: string | null
          id?: string
          model_id: string
        }
        Update: {
          alias?: string
          alias_norm?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_library_model_aliases_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_library_models: {
        Row: {
          air_filter: string | null
          battery: string | null
          brake_fluid: string | null
          category: string | null
          chain_spec: string | null
          coolant_qty_l: number | null
          coolant_type: string | null
          created_at: string
          created_by: string | null
          cylinders: number
          engine: string | null
          engine_cc: number | null
          engine_oil_qty_l: number | null
          engine_oil_type: string | null
          fork_oil: string | null
          front_sprocket: string | null
          front_tyre: string | null
          generation: string | null
          id: string
          is_archived: boolean
          make: string
          market_status: string | null
          model: string
          model_family: string | null
          notes: string | null
          oil_filter: string | null
          photo_url: string | null
          platform: string | null
          priority: number
          rear_sprocket: string | null
          rear_tyre: string | null
          service_interval_km: number | null
          spark_plug: string | null
          spark_plug_qty: number | null
          updated_at: string
          updated_by: string | null
          valve_exhaust_max: number | null
          valve_exhaust_min: number | null
          valve_intake_max: number | null
          valve_intake_min: number | null
          variant: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          air_filter?: string | null
          battery?: string | null
          brake_fluid?: string | null
          category?: string | null
          chain_spec?: string | null
          coolant_qty_l?: number | null
          coolant_type?: string | null
          created_at?: string
          created_by?: string | null
          cylinders?: number
          engine?: string | null
          engine_cc?: number | null
          engine_oil_qty_l?: number | null
          engine_oil_type?: string | null
          fork_oil?: string | null
          front_sprocket?: string | null
          front_tyre?: string | null
          generation?: string | null
          id?: string
          is_archived?: boolean
          make: string
          market_status?: string | null
          model: string
          model_family?: string | null
          notes?: string | null
          oil_filter?: string | null
          photo_url?: string | null
          platform?: string | null
          priority?: number
          rear_sprocket?: string | null
          rear_tyre?: string | null
          service_interval_km?: number | null
          spark_plug?: string | null
          spark_plug_qty?: number | null
          updated_at?: string
          updated_by?: string | null
          valve_exhaust_max?: number | null
          valve_exhaust_min?: number | null
          valve_intake_max?: number | null
          valve_intake_min?: number | null
          variant?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          air_filter?: string | null
          battery?: string | null
          brake_fluid?: string | null
          category?: string | null
          chain_spec?: string | null
          coolant_qty_l?: number | null
          coolant_type?: string | null
          created_at?: string
          created_by?: string | null
          cylinders?: number
          engine?: string | null
          engine_cc?: number | null
          engine_oil_qty_l?: number | null
          engine_oil_type?: string | null
          fork_oil?: string | null
          front_sprocket?: string | null
          front_tyre?: string | null
          generation?: string | null
          id?: string
          is_archived?: boolean
          make?: string
          market_status?: string | null
          model?: string
          model_family?: string | null
          notes?: string | null
          oil_filter?: string | null
          photo_url?: string | null
          platform?: string | null
          priority?: number
          rear_sprocket?: string | null
          rear_tyre?: string | null
          service_interval_km?: number | null
          spark_plug?: string | null
          spark_plug_qty?: number | null
          updated_at?: string
          updated_by?: string | null
          valve_exhaust_max?: number | null
          valve_exhaust_min?: number | null
          valve_intake_max?: number | null
          valve_intake_min?: number | null
          variant?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
      }
      bike_library_parts: {
        Row: {
          alt_part_number: string | null
          brand: string | null
          category: string | null
          created_at: string
          id: string
          is_archived: boolean
          model_id: string
          name: string
          notes: string | null
          part_number: string | null
          price: number | null
          qty: number
          retail_price: number | null
          sort_order: number
          source: Database["public"]["Enums"]["garage_source"]
          supplier: string | null
          updated_at: string
          updated_by: string | null
          verification: Database["public"]["Enums"]["garage_verification"]
          verified_by: string | null
        }
        Insert: {
          alt_part_number?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          model_id: string
          name: string
          notes?: string | null
          part_number?: string | null
          price?: number | null
          qty?: number
          retail_price?: number | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          supplier?: string | null
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Update: {
          alt_part_number?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          model_id?: string
          name?: string
          notes?: string | null
          part_number?: string | null
          price?: number | null
          qty?: number
          retail_price?: number | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          supplier?: string | null
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_library_parts_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_library_platforms: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          make: string
          name: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          make: string
          name?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          make?: string
          name?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bike_library_torque: {
        Row: {
          created_at: string
          fastener: string
          id: string
          is_archived: boolean
          model_id: string
          notes: string | null
          sort_order: number
          source: Database["public"]["Enums"]["garage_source"]
          torque_nm: number | null
          unit: string
          updated_at: string
          updated_by: string | null
          verification: Database["public"]["Enums"]["garage_verification"]
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          fastener: string
          id?: string
          is_archived?: boolean
          model_id: string
          notes?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          torque_nm?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          fastener?: string
          id?: string
          is_archived?: boolean
          model_id?: string
          notes?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          torque_nm?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bike_library_torque_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          arrival_photos: Json
          assigned_tech_id: string | null
          bike_arrived: boolean
          bike_arrived_at: string | null
          branch: string | null
          color: string | null
          complaints: string | null
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          damage_photos: Json
          delivery_required: boolean
          drop_off_time: string | null
          estimated_hours: number | null
          google_uid: string | null
          id: string
          instructions: string | null
          job_id: string | null
          loan_bike: boolean
          loan_bike_end_km: number | null
          loan_bike_expected_return: string | null
          loan_bike_id: string | null
          loan_bike_returned_at: string | null
          loan_bike_start_km: number | null
          mileage: number | null
          motorcycle_id: string | null
          notes: string | null
          pickup_required: boolean
          priority: string
          rego: string | null
          reminder_sent_at: string | null
          scheduled_date: string
          scheduled_end_time: string | null
          service_template_id: string | null
          service_type: string
          service_type_other: string | null
          status: string
          transport_address: string | null
          transport_notes: string | null
          updated_at: string
          vin: string | null
          wof_expiry: string | null
        }
        Insert: {
          arrival_photos?: Json
          assigned_tech_id?: string | null
          bike_arrived?: boolean
          bike_arrived_at?: string | null
          branch?: string | null
          color?: string | null
          complaints?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          damage_photos?: Json
          delivery_required?: boolean
          drop_off_time?: string | null
          estimated_hours?: number | null
          google_uid?: string | null
          id?: string
          instructions?: string | null
          job_id?: string | null
          loan_bike?: boolean
          loan_bike_end_km?: number | null
          loan_bike_expected_return?: string | null
          loan_bike_id?: string | null
          loan_bike_returned_at?: string | null
          loan_bike_start_km?: number | null
          mileage?: number | null
          motorcycle_id?: string | null
          notes?: string | null
          pickup_required?: boolean
          priority?: string
          rego?: string | null
          reminder_sent_at?: string | null
          scheduled_date: string
          scheduled_end_time?: string | null
          service_template_id?: string | null
          service_type: string
          service_type_other?: string | null
          status?: string
          transport_address?: string | null
          transport_notes?: string | null
          updated_at?: string
          vin?: string | null
          wof_expiry?: string | null
        }
        Update: {
          arrival_photos?: Json
          assigned_tech_id?: string | null
          bike_arrived?: boolean
          bike_arrived_at?: string | null
          branch?: string | null
          color?: string | null
          complaints?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          damage_photos?: Json
          delivery_required?: boolean
          drop_off_time?: string | null
          estimated_hours?: number | null
          google_uid?: string | null
          id?: string
          instructions?: string | null
          job_id?: string | null
          loan_bike?: boolean
          loan_bike_end_km?: number | null
          loan_bike_expected_return?: string | null
          loan_bike_id?: string | null
          loan_bike_returned_at?: string | null
          loan_bike_start_km?: number | null
          mileage?: number | null
          motorcycle_id?: string | null
          notes?: string | null
          pickup_required?: boolean
          priority?: string
          rego?: string | null
          reminder_sent_at?: string | null
          scheduled_date?: string
          scheduled_end_time?: string | null
          service_template_id?: string | null
          service_type?: string
          service_type_other?: string | null
          status?: string
          transport_address?: string | null
          transport_notes?: string | null
          updated_at?: string
          vin?: string | null
          wof_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_loan_bike_id_fkey"
            columns: ["loan_bike_id"]
            isOneToOne: false
            referencedRelation: "loan_bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_template_id_fkey"
            columns: ["service_template_id"]
            isOneToOne: false
            referencedRelation: "service_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_events: {
        Row: {
          event_type: Database["public"]["Enums"]["clock_event_type"]
          id: string
          job_id: string | null
          note: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          event_type: Database["public"]["Enums"]["clock_event_type"]
          id?: string
          job_id?: string | null
          note?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          event_type?: Database["public"]["Enums"]["clock_event_type"]
          id?: string
          job_id?: string | null
          note?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          is_archived: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_notes: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          note_date: string
          note_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note_date: string
          note_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
          note_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dyno_results: {
        Row: {
          after_url: string | null
          before_url: string | null
          created_at: string
          created_by: string | null
          graph_url: string | null
          id: string
          job_id: string | null
          max_power: number | null
          max_power_rpm: number | null
          max_torque: number | null
          max_torque_rpm: number | null
          motorcycle_id: string
          notes: string | null
          run_date: string
          run_type: string
        }
        Insert: {
          after_url?: string | null
          before_url?: string | null
          created_at?: string
          created_by?: string | null
          graph_url?: string | null
          id?: string
          job_id?: string | null
          max_power?: number | null
          max_power_rpm?: number | null
          max_torque?: number | null
          max_torque_rpm?: number | null
          motorcycle_id: string
          notes?: string | null
          run_date?: string
          run_type?: string
        }
        Update: {
          after_url?: string | null
          before_url?: string | null
          created_at?: string
          created_by?: string | null
          graph_url?: string | null
          id?: string
          job_id?: string | null
          max_power?: number | null
          max_power_rpm?: number | null
          max_torque?: number | null
          max_torque_rpm?: number | null
          motorcycle_id?: string
          notes?: string | null
          run_date?: string
          run_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dyno_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dyno_results_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_answer_feedback: {
        Row: {
          created_at: string
          created_by: string | null
          helpful: boolean
          id: string
          note: string | null
          query_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          helpful: boolean
          id?: string
          note?: string | null
          query_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          helpful?: boolean
          id?: string
          note?: string | null
          query_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_answer_feedback_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "garage_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_bike_overrides: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          field: string
          id: string
          is_archived: boolean
          model_id: string | null
          motorcycle_id: string
          notes: string | null
          reason: string | null
          source_name: string | null
          source_type: string
          subject: string
          unit: string | null
          updated_at: string
          value_num: number | null
          value_text: string | null
          verification: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          field: string
          id?: string
          is_archived?: boolean
          model_id?: string | null
          motorcycle_id: string
          notes?: string | null
          reason?: string | null
          source_name?: string | null
          source_type?: string
          subject?: string
          unit?: string | null
          updated_at?: string
          value_num?: number | null
          value_text?: string | null
          verification?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          is_archived?: boolean
          model_id?: string | null
          motorcycle_id?: string
          notes?: string | null
          reason?: string | null
          source_name?: string | null
          source_type?: string
          subject?: string
          unit?: string | null
          updated_at?: string
          value_num?: number | null
          value_text?: string | null
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_bike_overrides_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_bike_overrides_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          id: string
          label: string
          note: string | null
          sort_order: number
          torque_ref: string | null
        }
        Insert: {
          checklist_id: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          sort_order?: number
          torque_ref?: string | null
        }
        Update: {
          checklist_id?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          sort_order?: number
          torque_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "garage_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_checklists: {
        Row: {
          base_checklist_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_archived: boolean
          model_id: string | null
          operation_key: string
          title: string
          updated_at: string
        }
        Insert: {
          base_checklist_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_archived?: boolean
          model_id?: string | null
          operation_key: string
          title: string
          updated_at?: string
        }
        Update: {
          base_checklist_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_archived?: boolean
          model_id?: string | null
          operation_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_checklists_base_checklist_id_fkey"
            columns: ["base_checklist_id"]
            isOneToOne: false
            referencedRelation: "garage_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_checklists_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          heading: string | null
          id: string
          page_from: number | null
          page_to: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          heading?: string | null
          id?: string
          page_from?: number | null
          page_to?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          heading?: string | null
          id?: string
          page_from?: number | null
          page_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "garage_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_documents: {
        Row: {
          authorised: boolean
          created_at: string
          doc_type: Database["public"]["Enums"]["garage_doc_type"]
          engine_platform: string | null
          external_url: string | null
          generation: string | null
          id: string
          is_archived: boolean
          language: string
          manufacturer: string
          model: string | null
          model_id: string | null
          notes: string | null
          page_count: number | null
          source: Database["public"]["Enums"]["garage_source"]
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          verification: Database["public"]["Enums"]["garage_verification"]
          verified_at: string | null
          verified_by: string | null
          version: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          authorised?: boolean
          created_at?: string
          doc_type?: Database["public"]["Enums"]["garage_doc_type"]
          engine_platform?: string | null
          external_url?: string | null
          generation?: string | null
          id?: string
          is_archived?: boolean
          language?: string
          manufacturer: string
          model?: string | null
          model_id?: string | null
          notes?: string | null
          page_count?: number | null
          source?: Database["public"]["Enums"]["garage_source"]
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_at?: string | null
          verified_by?: string | null
          version?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          authorised?: boolean
          created_at?: string
          doc_type?: Database["public"]["Enums"]["garage_doc_type"]
          engine_platform?: string | null
          external_url?: string | null
          generation?: string | null
          id?: string
          is_archived?: boolean
          language?: string
          manufacturer?: string
          model?: string | null
          model_id?: string | null
          notes?: string | null
          page_count?: number | null
          source?: Database["public"]["Enums"]["garage_source"]
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_at?: string | null
          verified_by?: string | null
          version?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_documents_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_fluid_specs: {
        Row: {
          created_at: string
          filter_part_number: string | null
          fluid_type: string
          id: string
          is_archived: boolean
          model_id: string
          notes: string | null
          preferred_product: string | null
          qty_with_filter: number | null
          qty_without_filter: number | null
          sort_order: number
          source: Database["public"]["Enums"]["garage_source"]
          spec: string | null
          standard: string | null
          unit: string
          updated_at: string
          updated_by: string | null
          verification: Database["public"]["Enums"]["garage_verification"]
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          filter_part_number?: string | null
          fluid_type: string
          id?: string
          is_archived?: boolean
          model_id: string
          notes?: string | null
          preferred_product?: string | null
          qty_with_filter?: number | null
          qty_without_filter?: number | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          spec?: string | null
          standard?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          filter_part_number?: string | null
          fluid_type?: string
          id?: string
          is_archived?: boolean
          model_id?: string
          notes?: string | null
          preferred_product?: string | null
          qty_with_filter?: number | null
          qty_without_filter?: number | null
          sort_order?: number
          source?: Database["public"]["Enums"]["garage_source"]
          spec?: string | null
          standard?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_fluid_specs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          model_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          model_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          model_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_notes_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_observations: {
        Row: {
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          invoice_id: string | null
          job_id: string | null
          key_norm: string
          kind: string
          label: string
          model_id: string | null
          motorcycle_id: string | null
          source: string
          unit: string | null
          value_num: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          key_norm: string
          kind: string
          label: string
          model_id?: string | null
          motorcycle_id?: string | null
          source?: string
          unit?: string | null
          value_num?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          key_norm?: string
          kind?: string
          label?: string
          model_id?: string | null
          motorcycle_id?: string | null
          source?: string
          unit?: string | null
          value_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_observations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_observations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_observations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_observations_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_queries: {
        Row: {
          answer_source: Database["public"]["Enums"]["garage_answer_source"]
          answer_summary: string | null
          answered: boolean
          asked_by: string | null
          cache_hit: boolean
          created_at: string
          document_id: string | null
          id: string
          job_id: string | null
          model_id: string | null
          motorcycle_id: string | null
          needs_verification: boolean
          question: string
          question_norm: string
          topic: string | null
          used_external_ai: boolean
        }
        Insert: {
          answer_source?: Database["public"]["Enums"]["garage_answer_source"]
          answer_summary?: string | null
          answered?: boolean
          asked_by?: string | null
          cache_hit?: boolean
          created_at?: string
          document_id?: string | null
          id?: string
          job_id?: string | null
          model_id?: string | null
          motorcycle_id?: string | null
          needs_verification?: boolean
          question: string
          question_norm: string
          topic?: string | null
          used_external_ai?: boolean
        }
        Update: {
          answer_source?: Database["public"]["Enums"]["garage_answer_source"]
          answer_summary?: string | null
          answered?: boolean
          asked_by?: string | null
          cache_hit?: boolean
          created_at?: string
          document_id?: string | null
          id?: string
          job_id?: string | null
          model_id?: string | null
          motorcycle_id?: string | null
          needs_verification?: boolean
          question?: string
          question_norm?: string
          topic?: string | null
          used_external_ai?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "garage_queries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "garage_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_queries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_queries_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_queries_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_research_requests: {
        Row: {
          category: string
          created_at: string
          field: string
          id: string
          label: string
          model_id: string
          note: string | null
          priority: number
          requested_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          field: string
          id?: string
          label: string
          model_id: string
          note?: string | null
          priority?: number
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          field?: string
          id?: string
          label?: string
          model_id?: string
          note?: string | null
          priority?: number
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_research_requests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_research_results: {
        Row: {
          accessed_at: string
          applied_spec_id: string | null
          category: string
          confidence: string
          conflict_spec_id: string | null
          created_at: string
          decision_note: string | null
          field: string
          id: string
          import_batch: string | null
          model_id: string
          model_match: string
          notes: string | null
          origin: string
          request_id: string | null
          researched_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_date: string | null
          source_name: string | null
          source_ref: string | null
          source_type: string
          source_url: string | null
          status: string
          subject: string
          unit: string | null
          updated_at: string
          value_num: number | null
          value_text: string | null
          warnings: Json
        }
        Insert: {
          accessed_at?: string
          applied_spec_id?: string | null
          category: string
          confidence?: string
          conflict_spec_id?: string | null
          created_at?: string
          decision_note?: string | null
          field: string
          id?: string
          import_batch?: string | null
          model_id: string
          model_match?: string
          notes?: string | null
          origin?: string
          request_id?: string | null
          researched_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_date?: string | null
          source_name?: string | null
          source_ref?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          subject?: string
          unit?: string | null
          updated_at?: string
          value_num?: number | null
          value_text?: string | null
          warnings?: Json
        }
        Update: {
          accessed_at?: string
          applied_spec_id?: string | null
          category?: string
          confidence?: string
          conflict_spec_id?: string | null
          created_at?: string
          decision_note?: string | null
          field?: string
          id?: string
          import_batch?: string | null
          model_id?: string
          model_match?: string
          notes?: string | null
          origin?: string
          request_id?: string | null
          researched_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_date?: string | null
          source_name?: string | null
          source_ref?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          subject?: string
          unit?: string | null
          updated_at?: string
          value_num?: number | null
          value_text?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "garage_research_results_applied_spec_id_fkey"
            columns: ["applied_spec_id"]
            isOneToOne: false
            referencedRelation: "garage_tech_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_research_results_conflict_spec_id_fkey"
            columns: ["conflict_spec_id"]
            isOneToOne: false
            referencedRelation: "garage_tech_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_research_results_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_research_results_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "garage_research_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_revisions: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_table: string
          field: string | null
          id: string
          label: string
          model_id: string | null
          new_value: string | null
          note: string | null
          old_value: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_table: string
          field?: string | null
          id?: string
          label: string
          model_id?: string | null
          new_value?: string | null
          note?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_table?: string
          field?: string | null
          id?: string
          label?: string
          model_id?: string | null
          new_value?: string | null
          note?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_revisions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_tech_specs: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          field: string
          id: string
          import_batch: string | null
          is_alternative: boolean
          is_archived: boolean
          model_id: string
          notes: string | null
          review_status: string
          source_date: string | null
          source_name: string | null
          source_ref: string | null
          source_type: string
          subject: string
          unit: string | null
          updated_at: string
          updated_by: string | null
          value_num: number | null
          value_text: string | null
          verification: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          field: string
          id?: string
          import_batch?: string | null
          is_alternative?: boolean
          is_archived?: boolean
          model_id: string
          notes?: string | null
          review_status?: string
          source_date?: string | null
          source_name?: string | null
          source_ref?: string | null
          source_type?: string
          subject?: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          value_num?: number | null
          value_text?: string | null
          verification?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          import_batch?: string | null
          is_alternative?: boolean
          is_archived?: boolean
          model_id?: string
          notes?: string | null
          review_status?: string
          source_date?: string | null
          source_name?: string | null
          source_ref?: string | null
          source_type?: string
          subject?: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          value_num?: number | null
          value_text?: string | null
          verification?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_tech_specs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_update_proposals: {
        Row: {
          category: string
          created_at: string
          current_value: string | null
          entity_id: string | null
          entity_table: string
          evidence: Json
          evidence_count: number
          field: string | null
          id: string
          job_id: string | null
          label: string
          model_id: string
          note: string | null
          proposed_by: string | null
          proposed_value: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: Database["public"]["Enums"]["garage_source"]
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          current_value?: string | null
          entity_id?: string | null
          entity_table: string
          evidence?: Json
          evidence_count?: number
          field?: string | null
          id?: string
          job_id?: string | null
          label: string
          model_id: string
          note?: string | null
          proposed_by?: string | null
          proposed_value?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: Database["public"]["Enums"]["garage_source"]
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          current_value?: string | null
          entity_id?: string | null
          entity_table?: string
          evidence?: Json
          evidence_count?: number
          field?: string | null
          id?: string
          job_id?: string | null
          label?: string
          model_id?: string
          note?: string | null
          proposed_by?: string | null
          proposed_value?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: Database["public"]["Enums"]["garage_source"]
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_update_proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_update_proposals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_valve_specs: {
        Row: {
          adjustment_hours: number | null
          created_at: string
          exhaust_max: number | null
          exhaust_min: number | null
          id: string
          inspection_hours: number | null
          inspection_interval_km: number | null
          intake_max: number | null
          intake_min: number | null
          is_archived: boolean
          measurement_notes: string | null
          model_id: string
          notes: string | null
          parts_required: string | null
          source: Database["public"]["Enums"]["garage_source"]
          special_tools: string | null
          unit: string
          updated_at: string
          updated_by: string | null
          verification: Database["public"]["Enums"]["garage_verification"]
          verified_by: string | null
        }
        Insert: {
          adjustment_hours?: number | null
          created_at?: string
          exhaust_max?: number | null
          exhaust_min?: number | null
          id?: string
          inspection_hours?: number | null
          inspection_interval_km?: number | null
          intake_max?: number | null
          intake_min?: number | null
          is_archived?: boolean
          measurement_notes?: string | null
          model_id: string
          notes?: string | null
          parts_required?: string | null
          source?: Database["public"]["Enums"]["garage_source"]
          special_tools?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Update: {
          adjustment_hours?: number | null
          created_at?: string
          exhaust_max?: number | null
          exhaust_min?: number | null
          id?: string
          inspection_hours?: number | null
          inspection_interval_km?: number | null
          intake_max?: number | null
          intake_min?: number | null
          is_archived?: boolean
          measurement_notes?: string | null
          model_id?: string
          notes?: string | null
          parts_required?: string | null
          source?: Database["public"]["Enums"]["garage_source"]
          special_tools?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          verification?: Database["public"]["Enums"]["garage_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_valve_specs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claim_events: {
        Row: {
          claim_id: string
          created_at: string
          created_by: string | null
          event_type: string
          from_status:
            | Database["public"]["Enums"]["insurance_claim_status"]
            | null
          id: string
          note: string | null
          to_status:
            | Database["public"]["Enums"]["insurance_claim_status"]
            | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["insurance_claim_status"]
            | null
          id?: string
          note?: string | null
          to_status?:
            | Database["public"]["Enums"]["insurance_claim_status"]
            | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["insurance_claim_status"]
            | null
          id?: string
          note?: string | null
          to_status?:
            | Database["public"]["Enums"]["insurance_claim_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insurance_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claims: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          bike_with_customer: boolean
          claim_number: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          damage_marks: Json
          date_received: string
          declined_at: string | null
          expected_return_date: string | null
          id: string
          insurer_claim_ref: string | null
          insurer_name: string | null
          job_id: string | null
          motorcycle_id: string | null
          notes: string | null
          parts_ordered_at: string | null
          parts_received_at: string | null
          quote_amount: number | null
          quote_items: Json
          quote_labour_rate: number | null
          quote_sent_at: string | null
          quote_started_at: string | null
          ready_for_pickup_at: string | null
          repair_started_at: string | null
          status: Database["public"]["Enums"]["insurance_claim_status"]
          updated_at: string
          workshop_entry_date: string | null
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          bike_with_customer?: boolean
          claim_number?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          damage_marks?: Json
          date_received?: string
          declined_at?: string | null
          expected_return_date?: string | null
          id?: string
          insurer_claim_ref?: string | null
          insurer_name?: string | null
          job_id?: string | null
          motorcycle_id?: string | null
          notes?: string | null
          parts_ordered_at?: string | null
          parts_received_at?: string | null
          quote_amount?: number | null
          quote_items?: Json
          quote_labour_rate?: number | null
          quote_sent_at?: string | null
          quote_started_at?: string | null
          ready_for_pickup_at?: string | null
          repair_started_at?: string | null
          status?: Database["public"]["Enums"]["insurance_claim_status"]
          updated_at?: string
          workshop_entry_date?: string | null
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          bike_with_customer?: boolean
          claim_number?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          damage_marks?: Json
          date_received?: string
          declined_at?: string | null
          expected_return_date?: string | null
          id?: string
          insurer_claim_ref?: string | null
          insurer_name?: string | null
          job_id?: string | null
          motorcycle_id?: string | null
          notes?: string | null
          parts_ordered_at?: string | null
          parts_received_at?: string | null
          quote_amount?: number | null
          quote_items?: Json
          quote_labour_rate?: number | null
          quote_sent_at?: string | null
          quote_started_at?: string | null
          ready_for_pickup_at?: string | null
          repair_started_at?: string | null
          status?: Database["public"]["Enums"]["insurance_claim_status"]
          updated_at?: string
          workshop_entry_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          id: string
          min_stock: number
          name: string
          notes: string | null
          sku: string | null
          stock_qty: number
          type: string | null
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          notes?: string | null
          sku?: string | null
          stock_qty?: number
          type?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          notes?: string | null
          sku?: string | null
          stock_qty?: number
          type?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: string
          note: string | null
          paid_on: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string
          note?: string | null
          paid_on?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string
          note?: string | null
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bike_snapshot: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          due_date: string | null
          gst: number
          id: string
          invoice_date: string
          invoice_number: string
          job_id: string | null
          labour_total: number
          motorcycle_id: string | null
          notes: string | null
          paid_amount: number
          paid_on: string | null
          parts_total: number
          snapshot: Json | null
          status: string
          subtotal_excl_gst: number
          total: number
          updated_at: string
          xero_synced_at: string | null
        }
        Insert: {
          bike_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          due_date?: string | null
          gst?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          job_id?: string | null
          labour_total?: number
          motorcycle_id?: string | null
          notes?: string | null
          paid_amount?: number
          paid_on?: string | null
          parts_total?: number
          snapshot?: Json | null
          status?: string
          subtotal_excl_gst?: number
          total?: number
          updated_at?: string
          xero_synced_at?: string | null
        }
        Update: {
          bike_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          due_date?: string | null
          gst?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          job_id?: string | null
          labour_total?: number
          motorcycle_id?: string | null
          notes?: string | null
          paid_amount?: number
          paid_on?: string | null
          parts_total?: number
          snapshot?: Json | null
          status?: string
          subtotal_excl_gst?: number
          total?: number
          updated_at?: string
          xero_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_approval_requests: {
        Row: {
          created_at: string
          customer_contact_method: string | null
          decision: string | null
          id: string
          job_id: string
          requested_at: string
          requested_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_contact_method?: string | null
          decision?: string | null
          id?: string
          job_id: string
          requested_at?: string
          requested_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_contact_method?: string | null
          decision?: string | null
          id?: string
          job_id?: string
          requested_at?: string
          requested_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_approval_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          created_at: string
          created_by: string | null
          detail: Json
          event_type: string
          id: string
          job_id: string
          summary: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: Json
          event_type: string
          id?: string
          job_id: string
          summary: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: Json
          event_type?: string
          id?: string
          job_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_inspection_findings: {
        Row: {
          approval_request_id: string | null
          category: string
          created_at: string
          created_by: string | null
          decision_note: string | null
          description: string | null
          estimated_labour: number | null
          estimated_parts_cost: number | null
          id: string
          job_id: string
          photo_path: string | null
          recommended_action: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_request_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          description?: string | null
          estimated_labour?: number | null
          estimated_parts_cost?: number | null
          id?: string
          job_id: string
          photo_path?: string | null
          recommended_action?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_request_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          description?: string | null
          estimated_labour?: number | null
          estimated_parts_cost?: number | null
          id?: string
          job_id?: string
          photo_path?: string | null
          recommended_action?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_inspection_findings_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "job_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inspection_findings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_invoice_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          customer_report: string | null
          id: string
          job_id: string
          lines: Json
          notes: string | null
          report_generated_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_report?: string | null
          id?: string
          job_id: string
          lines?: Json
          notes?: string | null
          report_generated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_report?: string | null
          id?: string
          job_id?: string
          lines?: Json
          notes?: string | null
          report_generated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_invoice_drafts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          job_id: string | null
          sort_order: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          sort_order?: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          sort_order?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_tasks: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          job_id: string
          label: string
          note: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          job_id: string
          label: string
          note?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          job_id?: string
          label?: string
          note?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_tech_id: string | null
          color: string | null
          complaint: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_report: string | null
          customer_report_at: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          job_number: number
          motorcycle_id: string
          odometer: number | null
          scheduled_at: string | null
          scheduled_for: string | null
          service_data: Json
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          technician_id: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_tech_id?: string | null
          color?: string | null
          complaint?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_report?: string | null
          customer_report_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          job_number?: number
          motorcycle_id: string
          odometer?: number | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          service_data?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_id?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_tech_id?: string | null
          color?: string | null
          complaint?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_report?: string | null
          customer_report_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          job_number?: number
          motorcycle_id?: string
          odometer?: number | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          service_data?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_bike_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          loan_bike_id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          loan_bike_id: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          loan_bike_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_bike_notes_loan_bike_id_fkey"
            columns: ["loan_bike_id"]
            isOneToOne: false
            referencedRelation: "loan_bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_bike_service_logs: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          km: number | null
          loan_bike_id: string
          service_date: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          km?: number | null
          loan_bike_id: string
          service_date?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          km?: number | null
          loan_bike_id?: string
          service_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_bike_service_logs_loan_bike_id_fkey"
            columns: ["loan_bike_id"]
            isOneToOne: false
            referencedRelation: "loan_bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_bikes: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          current_km: number
          id: string
          last_service_date: string | null
          last_service_km: number | null
          make: string | null
          model: string | null
          name: string
          next_service_due_km: number | null
          notes: string | null
          rego: string | null
          rego_expiry: string | null
          service_interval_km: number
          updated_at: string
          wof_expiry: string | null
          year: number | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          current_km?: number
          id?: string
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          name: string
          next_service_due_km?: number | null
          notes?: string | null
          rego?: string | null
          rego_expiry?: string | null
          service_interval_km?: number
          updated_at?: string
          wof_expiry?: string | null
          year?: number | null
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          current_km?: number
          id?: string
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          name?: string
          next_service_due_km?: number | null
          notes?: string | null
          rego?: string | null
          rego_expiry?: string | null
          service_interval_km?: number
          updated_at?: string
          wof_expiry?: string | null
          year?: number | null
        }
        Relationships: []
      }
      mcd_tech_conversations: {
        Row: {
          context_label: string | null
          created_at: string
          id: string
          job_id: string | null
          model_id: string | null
          motorcycle_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_label?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          model_id?: string | null
          motorcycle_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_label?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          model_id?: string | null
          motorcycle_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcd_tech_conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcd_tech_conversations_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcd_tech_messages: {
        Row: {
          answer_source: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          payload: Json | null
          role: string
          used_external_ai: boolean
        }
        Insert: {
          answer_source?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          role: string
          used_external_ai?: boolean
        }
        Update: {
          answer_source?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          role?: string
          used_external_ai?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mcd_tech_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mcd_tech_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcd_tech_settings: {
        Row: {
          ai_enabled: boolean
          allow_customer_reports: boolean
          allow_library_proposals: boolean
          allow_technician_access: boolean
          external_ai_enabled: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_enabled?: boolean
          allow_customer_reports?: boolean
          allow_library_proposals?: boolean
          allow_technician_access?: boolean
          external_ai_enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_enabled?: boolean
          allow_customer_reports?: boolean
          allow_library_proposals?: boolean
          allow_technician_access?: boolean
          external_ai_enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      motorcycle_knowledge: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          label: string
          motorcycle_id: string
          notes: string | null
          unit: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          label: string
          motorcycle_id: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          label?: string
          motorcycle_id?: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_knowledge_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_knowledge_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_model_links: {
        Row: {
          confidence: string
          confirmed_by: string | null
          created_at: string
          id: string
          model_id: string
          motorcycle_id: string
          updated_at: string
        }
        Insert: {
          confidence?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          model_id: string
          motorcycle_id: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          model_id?: string
          motorcycle_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_model_links_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bike_library_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_model_links_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycles: {
        Row: {
          brake_condition: string | null
          chain_condition: string | null
          created_at: string
          customer_id: string
          cylinders: number
          ecu_info: string | null
          id: string
          is_archived: boolean
          make: string
          mileage: number | null
          model: string
          modifications: string | null
          notes: string | null
          photos: Json
          rego: string | null
          rego_expiry: string | null
          tyre_condition: string | null
          updated_at: string
          vin: string | null
          wof_expiry: string | null
          year: number | null
        }
        Insert: {
          brake_condition?: string | null
          chain_condition?: string | null
          created_at?: string
          customer_id: string
          cylinders?: number
          ecu_info?: string | null
          id?: string
          is_archived?: boolean
          make: string
          mileage?: number | null
          model: string
          modifications?: string | null
          notes?: string | null
          photos?: Json
          rego?: string | null
          rego_expiry?: string | null
          tyre_condition?: string | null
          updated_at?: string
          vin?: string | null
          wof_expiry?: string | null
          year?: number | null
        }
        Update: {
          brake_condition?: string | null
          chain_condition?: string | null
          created_at?: string
          customer_id?: string
          cylinders?: number
          ecu_info?: string | null
          id?: string
          is_archived?: boolean
          make?: string
          mileage?: number | null
          model?: string
          modifications?: string | null
          notes?: string | null
          photos?: Json
          rego?: string | null
          rego_expiry?: string | null
          tyre_condition?: string | null
          updated_at?: string
          vin?: string | null
          wof_expiry?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          approval_request_id: string | null
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          kind: string
          link: string | null
          requires_action: boolean
          resolved_at: string | null
          resolved_by: string | null
          target_role: string | null
          title: string
        }
        Insert: {
          approval_request_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          kind: string
          link?: string | null
          requires_action?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          target_role?: string | null
          title: string
        }
        Update: {
          approval_request_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          kind?: string
          link?: string | null
          requires_action?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          target_role?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "job_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          added_by: string | null
          cost: number | null
          created_at: string
          discount_pct: number
          id: string
          job_id: string
          name: string
          on_invoice: boolean
          quantity: number
          retail: number | null
          sort_order: number
          supplier: string | null
        }
        Insert: {
          added_by?: string | null
          cost?: number | null
          created_at?: string
          discount_pct?: number
          id?: string
          job_id: string
          name: string
          on_invoice?: boolean
          quantity?: number
          retail?: number | null
          sort_order?: number
          supplier?: string | null
        }
        Update: {
          added_by?: string | null
          cost?: number | null
          created_at?: string
          discount_pct?: number
          id?: string
          job_id?: string
          name?: string
          on_invoice?: boolean
          quantity?: number
          retail?: number | null
          sort_order?: number
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      post_bike_branches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      post_bike_services: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          km: number | null
          notes: string | null
          performed_by: string | null
          post_bike_id: string
          service_date: string
          service_type: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          km?: number | null
          notes?: string | null
          performed_by?: string | null
          post_bike_id: string
          service_date?: string
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          km?: number | null
          notes?: string | null
          performed_by?: string | null
          post_bike_id?: string
          service_date?: string
          service_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_bike_services_post_bike_id_fkey"
            columns: ["post_bike_id"]
            isOneToOne: false
            referencedRelation: "post_bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      post_bikes: {
        Row: {
          branch_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          current_km: number | null
          id: string
          is_active: boolean
          last_service_date: string | null
          last_service_km: number | null
          make: string | null
          model: string | null
          name: string | null
          notes: string | null
          rego: string | null
          service_interval_km: number
          sort_order: number
          updated_at: string
          year: number | null
        }
        Insert: {
          branch_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_km?: number | null
          id?: string
          is_active?: boolean
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          name?: string | null
          notes?: string | null
          rego?: string | null
          service_interval_km?: number
          sort_order?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          branch_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_km?: number | null
          id?: string
          is_active?: boolean
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          name?: string | null
          notes?: string | null
          rego?: string | null
          service_interval_km?: number
          sort_order?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_bikes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "post_bike_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_templates: {
        Row: {
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tasks: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tasks?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tasks?: Json
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          job_id: string
          minutes: number | null
          note: string | null
          started_at: string
          technician_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id: string
          minutes?: number | null
          note?: string | null
          started_at?: string
          technician_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id?: string
          minutes?: number | null
          note?: string | null
          started_at?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      valve_clearance_specs: {
        Row: {
          created_at: string
          created_by: string | null
          cylinders: number
          exhaust_max: number
          exhaust_min: number
          id: string
          intake_max: number
          intake_min: number
          intake_on_top: boolean
          make: string
          model: string
          note: string | null
          updated_at: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cylinders?: number
          exhaust_max?: number
          exhaust_min?: number
          id?: string
          intake_max?: number
          intake_min?: number
          intake_on_top?: boolean
          make: string
          model: string
          note?: string | null
          updated_at?: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cylinders?: number
          exhaust_max?: number
          exhaust_min?: number
          id?: string
          intake_max?: number
          intake_min?: number
          intake_on_top?: boolean
          make?: string
          model?: string
          note?: string | null
          updated_at?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
      }
      workshop_capacity: {
        Row: {
          max_bookins: number
          updated_at: string
          weekday: number
        }
        Insert: {
          max_bookins?: number
          updated_at?: string
          weekday: number
        }
        Update: {
          max_bookins?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      customer_reference_counts: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      delete_customer_safe: { Args: { p_customer_id: string }; Returns: Json }
      delete_motorcycle_safe: {
        Args: { p_motorcycle_id: string }
        Returns: Json
      }
      find_booking_conflicts: {
        Args: {
          p_date: string
          p_end: string
          p_exclude_booking_id?: string
          p_start: string
          p_technician_id: string
        }
        Returns: {
          assigned_tech_id: string
          drop_off_time: string
          id: string
          scheduled_date: string
          scheduled_end_time: string
          service_type: string
          status: string
        }[]
      }
      garage_ai_usage: { Args: { p_days?: number }; Returns: Json }
      garage_knowledge_coverage: { Args: { p_model_id: string }; Returns: Json }
      garage_match_model: {
        Args: { p_make: string; p_model: string; p_year?: number }
        Returns: string
      }
      garage_missing_knowledge: {
        Args: { p_limit?: number }
        Returns: {
          asks: number
          last_asked: string
          model_id: string
          question_norm: string
          sample: string
        }[]
      }
      garage_model_experience: { Args: { p_model_id: string }; Returns: Json }
      garage_model_jobs: {
        Args: { p_limit?: number; p_model_id: string }
        Returns: {
          bike: string
          completed_at: string
          estimated_hours: number
          job_id: string
          job_number: number
          title: string
          tracked_minutes: number
        }[]
      }
      garage_norm: { Args: { p: string }; Returns: string }
      garage_observation_summary: {
        Args: { p_model_id: string }
        Returns: Json
      }
      garage_part_usage: {
        Args: { p_model_id: string }
        Returns: {
          detail: string
          jobs: number
          key_norm: string
          label: string
          last_used: string
          verified: boolean
        }[]
      }
      garage_research_analytics: { Args: never; Returns: Json }
      garage_search_chunks: {
        Args: {
          p_embedding?: string
          p_limit?: number
          p_make?: string
          p_model?: string
          p_model_id?: string
          p_query?: string
          p_year?: number
        }
        Returns: {
          chunk_id: string
          content: string
          doc_model: string
          doc_type: Database["public"]["Enums"]["garage_doc_type"]
          document_id: string
          generation: string
          heading: string
          manufacturer: string
          page_from: number
          page_to: number
          score: number
          title: string
          verification: Database["public"]["Enums"]["garage_verification"]
          version: string
          year_from: number
          year_to: number
        }[]
      }
      garage_suggest_models: {
        Args: { p_make: string; p_model: string; p_year?: number }
        Returns: {
          confidence: string
          generation: string
          make: string
          model: string
          model_id: string
          platform: string
          score: number
          year_from: number
          year_to: number
        }[]
      }
      garage_tech_coverage: { Args: { p_model_id: string }; Returns: Json }
      merge_customers: {
        Args: { p_keep_id: string; p_merge_id: string }
        Returns: Json
      }
      merge_motorcycles: {
        Args: { p_keep_id: string; p_merge_id: string }
        Returns: Json
      }
      motorcycle_reference_counts: {
        Args: { p_motorcycle_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "technician"
      clock_event_type: "clock_in" | "clock_out" | "break_start" | "break_end"
      garage_answer_source:
        | "structured"
        | "document"
        | "history"
        | "external_ai"
        | "none"
      garage_doc_type:
        | "workshop_manual"
        | "service_manual"
        | "owner_manual"
        | "parts_catalogue"
        | "technical_bulletin"
        | "workshop_procedure"
        | "dyno_document"
        | "supplier_document"
        | "other"
      garage_source:
        | "workshop_verified"
        | "manufacturer_manual"
        | "parts_supplier"
        | "previous_job"
        | "technician_entry"
        | "other"
      garage_verification:
        | "unverified"
        | "workshop_verified"
        | "manufacturer_verified"
      insurance_claim_status:
        | "intake"
        | "assessing"
        | "quote_in_progress"
        | "quote_sent"
        | "approved"
        | "declined"
        | "waiting_parts"
        | "in_repair"
        | "ready_for_pickup"
        | "closed"
      job_status:
        | "new"
        | "assigned"
        | "in_progress"
        | "waiting_parts"
        | "ready_for_pickup"
        | "completed"
        | "waiting_approval"
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
      app_role: ["admin", "technician"],
      clock_event_type: ["clock_in", "clock_out", "break_start", "break_end"],
      garage_answer_source: [
        "structured",
        "document",
        "history",
        "external_ai",
        "none",
      ],
      garage_doc_type: [
        "workshop_manual",
        "service_manual",
        "owner_manual",
        "parts_catalogue",
        "technical_bulletin",
        "workshop_procedure",
        "dyno_document",
        "supplier_document",
        "other",
      ],
      garage_source: [
        "workshop_verified",
        "manufacturer_manual",
        "parts_supplier",
        "previous_job",
        "technician_entry",
        "other",
      ],
      garage_verification: [
        "unverified",
        "workshop_verified",
        "manufacturer_verified",
      ],
      insurance_claim_status: [
        "intake",
        "assessing",
        "quote_in_progress",
        "quote_sent",
        "approved",
        "declined",
        "waiting_parts",
        "in_repair",
        "ready_for_pickup",
        "closed",
      ],
      job_status: [
        "new",
        "assigned",
        "in_progress",
        "waiting_parts",
        "ready_for_pickup",
        "completed",
        "waiting_approval",
      ],
    },
  },
} as const
