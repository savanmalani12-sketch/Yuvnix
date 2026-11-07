/**
 * Supabase Database Schema Definitions for Yuvnix
 * Typed representation of PostgreSQL public schema with full RLS and relation metadata
 */

import type {
  ResidentialType,
  UserRole,
  CommunityRequestStatus,
  GroupCartStatus,
  SharedRideStatus,
} from './domain';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone_number: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          phone_number?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone_number?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
        Relationships: [];
      };
      communities: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          type: ResidentialType;
          college_affiliation: string | null;
          address: string;
          city: string;
          state: string | null;
          delivery_pickup_point: string;
          taxi_pickup_point: string;
          is_verified: boolean;
          active_member_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          type: ResidentialType;
          college_affiliation?: string | null;
          address: string;
          city: string;
          state?: string | null;
          delivery_pickup_point: string;
          taxi_pickup_point: string;
          is_verified?: boolean;
          active_member_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          type?: ResidentialType;
          college_affiliation?: string | null;
          address?: string;
          city?: string;
          state?: string | null;
          delivery_pickup_point?: string;
          taxi_pickup_point?: string;
          is_verified?: boolean;
          active_member_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_memberships: {
        Row: {
          id: string;
          community_id: string;
          user_id: string;
          joined_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          community_id: string;
          user_id: string;
          joined_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          community_id?: string;
          user_id?: string;
          joined_at?: string;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'community_memberships_community_id_fkey';
            columns: ['community_id'];
            isOneToOne: false;
            referencedRelation: 'communities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      community_requests: {
        Row: {
          id: string;
          requested_by_user_id: string;
          proposed_name: string;
          proposed_type: ResidentialType;
          college_affiliation: string | null;
          address: string;
          proposed_delivery_pickup_point: string;
          proposed_taxi_pickup_point: string;
          status: CommunityRequestStatus;
          reviewed_by_staff_id: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requested_by_user_id: string;
          proposed_name: string;
          proposed_type: ResidentialType;
          college_affiliation?: string | null;
          address: string;
          proposed_delivery_pickup_point: string;
          proposed_taxi_pickup_point: string;
          status?: CommunityRequestStatus;
          reviewed_by_staff_id?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: CommunityRequestStatus;
          reviewed_by_staff_id?: string | null;
          review_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_requests_requested_by_user_id_fkey';
            columns: ['requested_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_carts: {
        Row: {
          id: string;
          community_id: string;
          created_by_user_id: string;
          title: string;
          store_name: string | null;
          status: GroupCartStatus;
          lock_at: string;
          pickup_instructions: string | null;
          total_estimated_amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          created_by_user_id: string;
          title: string;
          store_name?: string | null;
          status?: GroupCartStatus;
          lock_at: string;
          pickup_instructions?: string | null;
          total_estimated_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          store_name?: string | null;
          status?: GroupCartStatus;
          lock_at?: string;
          pickup_instructions?: string | null;
          total_estimated_amount?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          added_by_user_id: string;
          item_name: string;
          quantity: number;
          unit_price_estimate: number | null;
          notes: string | null;
          is_fulfilled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          added_by_user_id: string;
          item_name: string;
          quantity?: number;
          unit_price_estimate?: number | null;
          notes?: string | null;
          is_fulfilled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_name?: string;
          quantity?: number;
          unit_price_estimate?: number | null;
          notes?: string | null;
          is_fulfilled?: boolean;
        };
        Relationships: [];
      };
      shared_rides: {
        Row: {
          id: string;
          community_id: string;
          created_by_user_id: string;
          pickup_point: string;
          destination: string;
          departure_time: string;
          total_seats: number;
          available_seats: number;
          estimated_cost_per_seat: number | null;
          status: SharedRideStatus;
          luggage_details: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          created_by_user_id: string;
          pickup_point: string;
          destination: string;
          departure_time: string;
          total_seats?: number;
          available_seats?: number;
          estimated_cost_per_seat?: number | null;
          status?: SharedRideStatus;
          luggage_details?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pickup_point?: string;
          destination?: string;
          departure_time?: string;
          total_seats?: number;
          available_seats?: number;
          estimated_cost_per_seat?: number | null;
          status?: SharedRideStatus;
          luggage_details?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ride_participants: {
        Row: {
          id: string;
          ride_id: string;
          user_id: string;
          seats_reserved: number;
          joined_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          ride_id: string;
          user_id: string;
          seats_reserved?: number;
          joined_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          seats_reserved?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_type: 'cart' | 'ride';
          context_id: string;
          sender_user_id: string;
          message_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_type: 'cart' | 'ride';
          context_id: string;
          sender_user_id: string;
          message_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_text?: string;
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
      residential_type: ResidentialType;
      user_role: UserRole;
      community_request_status: CommunityRequestStatus;
      group_cart_status: GroupCartStatus;
      shared_ride_status: SharedRideStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
