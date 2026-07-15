export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bookings: {
        Row: {
          arrival_photos: Json;
          assigned_tech_id: string | null;
          color: string | null;
          complaints: string | null;
          confirmed: boolean;
          confirmed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          damage_photos: Json;
          drop_off_time: string | null;
          estimated_hours: number | null;
          google_uid: string | null;
          id: string;
          instructions: string | null;
          job_id: string | null;
          loan_bike: boolean;
          loan_bike_end_km: number | null;
          loan_bike_expected_return: string | null;
          loan_bike_id: string | null;
          loan_bike_returned_at: string | null;
          loan_bike_start_km: number | null;
          mileage: number | null;
          motorcycle_id: string | null;
          notes: string | null;
          priority: string;
          rego: string | null;
          scheduled_date: string;
          service_template_id: string | null;
          service_type: string;
          service_type_other: string | null;
          status: string;
          updated_at: string;
          vin: string | null;
          wof_expiry: string | null;
        };
        Insert: {
          arrival_photos?: Json;
          assigned_tech_id?: string | null;
          color?: string | null;
          complaints?: string | null;
          confirmed?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          damage_photos?: Json;
          drop_off_time?: string | null;
          estimated_hours?: number | null;
          google_uid?: string | null;
          id?: string;
          instructions?: string | null;
          job_id?: string | null;
          loan_bike?: boolean;
          loan_bike_end_km?: number | null;
          loan_bike_expected_return?: string | null;
          loan_bike_id?: string | null;
          loan_bike_returned_at?: string | null;
          loan_bike_start_km?: number | null;
          mileage?: number | null;
          motorcycle_id?: string | null;
          notes?: string | null;
          priority?: string;
          rego?: string | null;
          scheduled_date: string;
          service_template_id?: string | null;
          service_type: string;
          service_type_other?: string | null;
          status?: string;
          updated_at?: string;
          vin?: string | null;
          wof_expiry?: string | null;
        };
        Update: {
          arrival_photos?: Json;
          assigned_tech_id?: string | null;
          color?: string | null;
          complaints?: string | null;
          confirmed?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          damage_photos?: Json;
          drop_off_time?: string | null;
          estimated_hours?: number | null;
          google_uid?: string | null;
          id?: string;
          instructions?: string | null;
          job_id?: string | null;
          loan_bike?: boolean;
          loan_bike_end_km?: number | null;
          loan_bike_expected_return?: string | null;
          loan_bike_id?: string | null;
          loan_bike_returned_at?: string | null;
          loan_bike_start_km?: number | null;
          mileage?: number | null;
          motorcycle_id?: string | null;
          notes?: string | null;
          priority?: string;
          rego?: string | null;
          scheduled_date?: string;
          service_template_id?: string | null;
          service_type?: string;
          service_type_other?: string | null;
          status?: string;
          updated_at?: string;
          vin?: string | null;
          wof_expiry?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_loan_bike_id_fkey";
            columns: ["loan_bike_id"];
            isOneToOne: false;
            referencedRelation: "loan_bikes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_template_id_fkey";
            columns: ["service_template_id"];
            isOneToOne: false;
            referencedRelation: "service_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      clock_events: {
        Row: {
          event_type: Database["public"]["Enums"]["clock_event_type"];
          id: string;
          job_id: string | null;
          note: string | null;
          occurred_at: string;
          user_id: string;
        };
        Insert: {
          event_type: Database["public"]["Enums"]["clock_event_type"];
          id?: string;
          job_id?: string | null;
          note?: string | null;
          occurred_at?: string;
          user_id: string;
        };
        Update: {
          event_type?: Database["public"]["Enums"]["clock_event_type"];
          id?: string;
          job_id?: string | null;
          note?: string | null;
          occurred_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clock_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          first_name: string;
          id: string;
          last_name: string | null;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          first_name: string;
          id?: string;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          first_name?: string;
          id?: string;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      dyno_results: {
        Row: {
          after_url: string | null;
          before_url: string | null;
          created_at: string;
          created_by: string | null;
          graph_url: string | null;
          id: string;
          job_id: string | null;
          max_power: number | null;
          max_power_rpm: number | null;
          max_torque: number | null;
          max_torque_rpm: number | null;
          motorcycle_id: string;
          notes: string | null;
          run_date: string;
          run_type: string;
        };
        Insert: {
          after_url?: string | null;
          before_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          graph_url?: string | null;
          id?: string;
          job_id?: string | null;
          max_power?: number | null;
          max_power_rpm?: number | null;
          max_torque?: number | null;
          max_torque_rpm?: number | null;
          motorcycle_id: string;
          notes?: string | null;
          run_date?: string;
          run_type?: string;
        };
        Update: {
          after_url?: string | null;
          before_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          graph_url?: string | null;
          id?: string;
          job_id?: string | null;
          max_power?: number | null;
          max_power_rpm?: number | null;
          max_torque?: number | null;
          max_torque_rpm?: number | null;
          motorcycle_id?: string;
          notes?: string | null;
          run_date?: string;
          run_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dyno_results_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dyno_results_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          },
        ];
      };
      insurance_claim_events: {
        Row: {
          claim_id: string;
          created_at: string;
          created_by: string | null;
          event_type: string;
          from_status: Database["public"]["Enums"]["insurance_claim_status"] | null;
          id: string;
          note: string | null;
          to_status: Database["public"]["Enums"]["insurance_claim_status"] | null;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          created_by?: string | null;
          event_type: string;
          from_status?: Database["public"]["Enums"]["insurance_claim_status"] | null;
          id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["insurance_claim_status"] | null;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          created_by?: string | null;
          event_type?: string;
          from_status?: Database["public"]["Enums"]["insurance_claim_status"] | null;
          id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["insurance_claim_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "insurance_claim_events_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "insurance_claims";
            referencedColumns: ["id"];
          },
        ];
      };
      insurance_claims: {
        Row: {
          approved_amount: number | null;
          approved_at: string | null;
          bike_with_customer: boolean;
          claim_number: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          damage_marks: Json;
          date_received: string;
          declined_at: string | null;
          expected_return_date: string | null;
          id: string;
          insurer_claim_ref: string | null;
          insurer_name: string | null;
          job_id: string | null;
          motorcycle_id: string | null;
          notes: string | null;
          parts_ordered_at: string | null;
          parts_received_at: string | null;
          quote_amount: number | null;
          quote_items: Json;
          quote_labour_rate: number | null;
          quote_sent_at: string | null;
          quote_started_at: string | null;
          ready_for_pickup_at: string | null;
          repair_started_at: string | null;
          status: Database["public"]["Enums"]["insurance_claim_status"];
          updated_at: string;
          workshop_entry_date: string | null;
        };
        Insert: {
          approved_amount?: number | null;
          approved_at?: string | null;
          bike_with_customer?: boolean;
          claim_number?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          damage_marks?: Json;
          date_received?: string;
          declined_at?: string | null;
          expected_return_date?: string | null;
          id?: string;
          insurer_claim_ref?: string | null;
          insurer_name?: string | null;
          job_id?: string | null;
          motorcycle_id?: string | null;
          notes?: string | null;
          parts_ordered_at?: string | null;
          parts_received_at?: string | null;
          quote_amount?: number | null;
          quote_items?: Json;
          quote_labour_rate?: number | null;
          quote_sent_at?: string | null;
          quote_started_at?: string | null;
          ready_for_pickup_at?: string | null;
          repair_started_at?: string | null;
          status?: Database["public"]["Enums"]["insurance_claim_status"];
          updated_at?: string;
          workshop_entry_date?: string | null;
        };
        Update: {
          approved_amount?: number | null;
          approved_at?: string | null;
          bike_with_customer?: boolean;
          claim_number?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          damage_marks?: Json;
          date_received?: string;
          declined_at?: string | null;
          expected_return_date?: string | null;
          id?: string;
          insurer_claim_ref?: string | null;
          insurer_name?: string | null;
          job_id?: string | null;
          motorcycle_id?: string | null;
          notes?: string | null;
          parts_ordered_at?: string | null;
          parts_received_at?: string | null;
          quote_amount?: number | null;
          quote_items?: Json;
          quote_labour_rate?: number | null;
          quote_sent_at?: string | null;
          quote_started_at?: string | null;
          ready_for_pickup_at?: string | null;
          repair_started_at?: string | null;
          status?: Database["public"]["Enums"]["insurance_claim_status"];
          updated_at?: string;
          workshop_entry_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "insurance_claims_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "insurance_claims_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "insurance_claims_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          brand: string | null;
          category: string;
          created_at: string;
          id: string;
          min_stock: number;
          name: string;
          notes: string | null;
          sku: string | null;
          stock_qty: number;
          type: string | null;
          unit: string;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          category: string;
          created_at?: string;
          id?: string;
          min_stock?: number;
          name: string;
          notes?: string | null;
          sku?: string | null;
          stock_qty?: number;
          type?: string | null;
          unit?: string;
          unit_price?: number;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          min_stock?: number;
          name?: string;
          notes?: string | null;
          sku?: string | null;
          stock_qty?: number;
          type?: string | null;
          unit?: string;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          bike_snapshot: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name_snapshot: string | null;
          due_date: string | null;
          gst: number;
          id: string;
          invoice_date: string;
          invoice_number: string;
          job_id: string | null;
          labour_total: number;
          motorcycle_id: string | null;
          notes: string | null;
          paid_amount: number;
          paid_on: string | null;
          parts_total: number;
          snapshot: Json | null;
          status: string;
          subtotal_excl_gst: number;
          total: number;
          updated_at: string;
          xero_synced_at: string | null;
        };
        Insert: {
          bike_snapshot?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name_snapshot?: string | null;
          due_date?: string | null;
          gst?: number;
          id?: string;
          invoice_date?: string;
          invoice_number: string;
          job_id?: string | null;
          labour_total?: number;
          motorcycle_id?: string | null;
          notes?: string | null;
          paid_amount?: number;
          paid_on?: string | null;
          parts_total?: number;
          snapshot?: Json | null;
          status?: string;
          subtotal_excl_gst?: number;
          total?: number;
          updated_at?: string;
          xero_synced_at?: string | null;
        };
        Update: {
          bike_snapshot?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name_snapshot?: string | null;
          due_date?: string | null;
          gst?: number;
          id?: string;
          invoice_date?: string;
          invoice_number?: string;
          job_id?: string | null;
          labour_total?: number;
          motorcycle_id?: string | null;
          notes?: string | null;
          paid_amount?: number;
          paid_on?: string | null;
          parts_total?: number;
          snapshot?: Json | null;
          status?: string;
          subtotal_excl_gst?: number;
          total?: number;
          updated_at?: string;
          xero_synced_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_notes: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          job_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          job_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_photos: {
        Row: {
          caption: string | null;
          created_at: string;
          id: string;
          job_id: string | null;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          storage_path: string;
          uploaded_by: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_tasks: {
        Row: {
          created_at: string;
          done_at: string | null;
          done_by: string | null;
          id: string;
          is_done: boolean;
          job_id: string;
          label: string;
          note: string | null;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          job_id: string;
          label: string;
          note?: string | null;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          job_id?: string;
          label?: string;
          note?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_tasks_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          assigned_tech_id: string | null;
          color: string | null;
          complaint: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          description: string | null;
          estimated_hours: number | null;
          id: string;
          job_number: number;
          motorcycle_id: string;
          odometer: number | null;
          scheduled_at: string | null;
          scheduled_for: string | null;
          service_data: Json;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          technician_id: string | null;
          template_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_tech_id?: string | null;
          color?: string | null;
          complaint?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          description?: string | null;
          estimated_hours?: number | null;
          id?: string;
          job_number?: number;
          motorcycle_id: string;
          odometer?: number | null;
          scheduled_at?: string | null;
          scheduled_for?: string | null;
          service_data?: Json;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          technician_id?: string | null;
          template_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_tech_id?: string | null;
          color?: string | null;
          complaint?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          description?: string | null;
          estimated_hours?: number | null;
          id?: string;
          job_number?: number;
          motorcycle_id?: string;
          odometer?: number | null;
          scheduled_at?: string | null;
          scheduled_for?: string | null;
          service_data?: Json;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          technician_id?: string | null;
          template_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "service_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_bike_notes: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          loan_bike_id: string;
          note: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          loan_bike_id: string;
          note: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          loan_bike_id?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loan_bike_notes_loan_bike_id_fkey";
            columns: ["loan_bike_id"];
            isOneToOne: false;
            referencedRelation: "loan_bikes";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_bike_service_logs: {
        Row: {
          cost: number | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          km: number | null;
          loan_bike_id: string;
          service_date: string;
        };
        Insert: {
          cost?: number | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          km?: number | null;
          loan_bike_id: string;
          service_date?: string;
        };
        Update: {
          cost?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          km?: number | null;
          loan_bike_id?: string;
          service_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loan_bike_service_logs_loan_bike_id_fkey";
            columns: ["loan_bike_id"];
            isOneToOne: false;
            referencedRelation: "loan_bikes";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_bikes: {
        Row: {
          active: boolean;
          color: string | null;
          created_at: string;
          current_km: number;
          id: string;
          last_service_date: string | null;
          last_service_km: number | null;
          make: string | null;
          model: string | null;
          name: string;
          next_service_due_km: number | null;
          notes: string | null;
          rego: string | null;
          service_interval_km: number;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          active?: boolean;
          color?: string | null;
          created_at?: string;
          current_km?: number;
          id?: string;
          last_service_date?: string | null;
          last_service_km?: number | null;
          make?: string | null;
          model?: string | null;
          name: string;
          next_service_due_km?: number | null;
          notes?: string | null;
          rego?: string | null;
          service_interval_km?: number;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          active?: boolean;
          color?: string | null;
          created_at?: string;
          current_km?: number;
          id?: string;
          last_service_date?: string | null;
          last_service_km?: number | null;
          make?: string | null;
          model?: string | null;
          name?: string;
          next_service_due_km?: number | null;
          notes?: string | null;
          rego?: string | null;
          service_interval_km?: number;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      motorcycles: {
        Row: {
          brake_condition: string | null;
          chain_condition: string | null;
          created_at: string;
          customer_id: string;
          cylinders: number;
          ecu_info: string | null;
          id: string;
          make: string;
          mileage: number | null;
          model: string;
          modifications: string | null;
          notes: string | null;
          photos: Json;
          rego: string | null;
          rego_expiry: string | null;
          tyre_condition: string | null;
          updated_at: string;
          vin: string | null;
          wof_expiry: string | null;
          year: number | null;
        };
        Insert: {
          brake_condition?: string | null;
          chain_condition?: string | null;
          created_at?: string;
          customer_id: string;
          cylinders?: number;
          ecu_info?: string | null;
          id?: string;
          make: string;
          mileage?: number | null;
          model: string;
          modifications?: string | null;
          notes?: string | null;
          photos?: Json;
          rego?: string | null;
          rego_expiry?: string | null;
          tyre_condition?: string | null;
          updated_at?: string;
          vin?: string | null;
          wof_expiry?: string | null;
          year?: number | null;
        };
        Update: {
          brake_condition?: string | null;
          chain_condition?: string | null;
          created_at?: string;
          customer_id?: string;
          cylinders?: number;
          ecu_info?: string | null;
          id?: string;
          make?: string;
          mileage?: number | null;
          model?: string;
          modifications?: string | null;
          notes?: string | null;
          photos?: Json;
          rego?: string | null;
          rego_expiry?: string | null;
          tyre_condition?: string | null;
          updated_at?: string;
          vin?: string | null;
          wof_expiry?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "motorcycles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_reads: {
        Row: {
          notification_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          notification_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          notification_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          link: string | null;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          link?: string | null;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      parts: {
        Row: {
          added_by: string | null;
          cost: number | null;
          created_at: string;
          discount_pct: number;
          id: string;
          job_id: string;
          name: string;
          on_invoice: boolean;
          quantity: number;
          retail: number | null;
          supplier: string | null;
        };
        Insert: {
          added_by?: string | null;
          cost?: number | null;
          created_at?: string;
          discount_pct?: number;
          id?: string;
          job_id: string;
          name: string;
          on_invoice?: boolean;
          quantity?: number;
          retail?: number | null;
          supplier?: string | null;
        };
        Update: {
          added_by?: string | null;
          cost?: number | null;
          created_at?: string;
          discount_pct?: number;
          id?: string;
          job_id?: string;
          name?: string;
          on_invoice?: boolean;
          quantity?: number;
          retail?: number | null;
          supplier?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "parts_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_templates: {
        Row: {
          created_at: string;
          description: string | null;
          estimated_hours: number | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          tasks: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          estimated_hours?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          tasks?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          estimated_hours?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          tasks?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          created_at: string;
          ended_at: string | null;
          id: string;
          job_id: string;
          minutes: number | null;
          note: string | null;
          started_at: string;
          technician_id: string;
        };
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          job_id: string;
          minutes?: number | null;
          note?: string | null;
          started_at?: string;
          technician_id: string;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          job_id?: string;
          minutes?: number | null;
          note?: string | null;
          started_at?: string;
          technician_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "admin" | "technician";
      clock_event_type: "clock_in" | "clock_out" | "break_start" | "break_end";
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
        | "closed";
      job_status:
        | "new"
        | "assigned"
        | "in_progress"
        | "waiting_parts"
        | "ready_for_pickup"
        | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
  public: {
    Enums: {
      app_role: ["admin", "technician"],
      clock_event_type: ["clock_in", "clock_out", "break_start", "break_end"],
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
      ],
    },
  },
} as const;
