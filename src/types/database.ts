
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "cart_items": {
                  Row: {
                    "added_by_user_id": string,"cart_id": string,"created_at": string,"id": string,"is_fulfilled": boolean,"item_name": string,"notes": string | null,"quantity": number,"unit_price_estimate": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by_user_id": string,"cart_id": string,"created_at"?: string,"id"?: string,"is_fulfilled"?: boolean,"item_name": string,"notes"?: string | null,"quantity"?: number,"unit_price_estimate"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "added_by_user_id"?: string,"cart_id"?: string,"created_at"?: string,"id"?: string,"is_fulfilled"?: boolean,"item_name"?: string,"notes"?: string | null,"quantity"?: number,"unit_price_estimate"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_added_by_user_id_fkey"
      columns: ["added_by_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "group_carts"
      referencedColumns: ["id"]
    }
                  ]
                },"cart_messages": {
                  Row: {
                    "cart_id": string,"created_at": string,"id": string,"message_text": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cart_id": string,"created_at"?: string,"id"?: string,"message_text": string,"sender_id": string
                  }
                  Update: {
                    "cart_id"?: string,"created_at"?: string,"id"?: string,"message_text"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_messages_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "group_carts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cart_participants": {
                  Row: {
                    "cart_id": string,"id": string,"joined_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cart_id": string,"id"?: string,"joined_at"?: string,"user_id": string
                  }
                  Update: {
                    "cart_id"?: string,"id"?: string,"joined_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_participants_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "group_carts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"communities": {
                  Row: {
                    "active_member_count": number,"city": string,"college_affiliation": string | null,"created_at": string,"description": string | null,"general_area": string | null,"id": string,"is_verified": boolean,"latitude": number | null,"longitude": number | null,"name": string,"slug": string,"state": string | null,"type": Database["public"]['Enums']["residential_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_member_count"?: number,"city": string,"college_affiliation"?: string | null,"created_at"?: string,"description"?: string | null,"general_area"?: string | null,"id"?: string,"is_verified"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name": string,"slug": string,"state"?: string | null,"type": Database["public"]['Enums']["residential_type"],"updated_at"?: string
                  }
                  Update: {
                    "active_member_count"?: number,"city"?: string,"college_affiliation"?: string | null,"created_at"?: string,"description"?: string | null,"general_area"?: string | null,"id"?: string,"is_verified"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"slug"?: string,"state"?: string | null,"type"?: Database["public"]['Enums']["residential_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"community_memberships": {
                  Row: {
                    "community_id": string,"id": string,"is_active": boolean,"joined_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "community_id": string,"id"?: string,"is_active"?: boolean,"joined_at"?: string,"user_id": string
                  }
                  Update: {
                    "community_id"?: string,"id"?: string,"is_active"?: boolean,"joined_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_memberships_community_id_fkey"
      columns: ["community_id"]
isOneToOne: false
      referencedRelation: "communities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_pickup_points": {
                  Row: {
                    "community_id": string,"created_at": string,"delivery_pickup_point": string,"gate_instructions": string | null,"id": string,"physical_address": string,"taxi_pickup_point": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "community_id": string,"created_at"?: string,"delivery_pickup_point": string,"gate_instructions"?: string | null,"id"?: string,"physical_address": string,"taxi_pickup_point": string,"updated_at"?: string
                  }
                  Update: {
                    "community_id"?: string,"created_at"?: string,"delivery_pickup_point"?: string,"gate_instructions"?: string | null,"id"?: string,"physical_address"?: string,"taxi_pickup_point"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_pickup_points_community_id_fkey"
      columns: ["community_id"]
isOneToOne: true
      referencedRelation: "communities"
      referencedColumns: ["id"]
    }
                  ]
                },"community_requests": {
                  Row: {
                    "college_affiliation": string | null,"created_at": string,"created_community_id": string | null,"id": string,"latitude": number | null,"longitude": number | null,"proposed_address": string,"proposed_delivery_pickup_point": string,"proposed_name": string,"proposed_taxi_pickup_point": string,"proposed_type": Database["public"]['Enums']["residential_type"],"requested_by_user_id": string,"review_notes": string | null,"reviewed_by_staff_id": string | null,"status": Database["public"]['Enums']["community_request_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "college_affiliation"?: string | null,"created_at"?: string,"created_community_id"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"proposed_address": string,"proposed_delivery_pickup_point": string,"proposed_name": string,"proposed_taxi_pickup_point": string,"proposed_type": Database["public"]['Enums']["residential_type"],"requested_by_user_id": string,"review_notes"?: string | null,"reviewed_by_staff_id"?: string | null,"status"?: Database["public"]['Enums']["community_request_status"],"updated_at"?: string
                  }
                  Update: {
                    "college_affiliation"?: string | null,"created_at"?: string,"created_community_id"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"proposed_address"?: string,"proposed_delivery_pickup_point"?: string,"proposed_name"?: string,"proposed_taxi_pickup_point"?: string,"proposed_type"?: Database["public"]['Enums']["residential_type"],"requested_by_user_id"?: string,"review_notes"?: string | null,"reviewed_by_staff_id"?: string | null,"status"?: Database["public"]['Enums']["community_request_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_requests_created_community_id_fkey"
      columns: ["created_community_id"]
isOneToOne: false
      referencedRelation: "communities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_requests_requested_by_user_id_fkey"
      columns: ["requested_by_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_requests_reviewed_by_staff_id_fkey"
      columns: ["reviewed_by_staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_carts": {
                  Row: {
                    "community_id": string,"created_at": string,"created_by_user_id": string,"id": string,"lock_at": string,"pickup_instructions": string | null,"status": Database["public"]['Enums']["group_cart_status"],"store_name": string | null,"title": string,"total_estimated_amount": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "community_id": string,"created_at"?: string,"created_by_user_id": string,"id"?: string,"lock_at": string,"pickup_instructions"?: string | null,"status"?: Database["public"]['Enums']["group_cart_status"],"store_name"?: string | null,"title": string,"total_estimated_amount"?: number,"updated_at"?: string
                  }
                  Update: {
                    "community_id"?: string,"created_at"?: string,"created_by_user_id"?: string,"id"?: string,"lock_at"?: string,"pickup_instructions"?: string | null,"status"?: Database["public"]['Enums']["group_cart_status"],"store_name"?: string | null,"title"?: string,"total_estimated_amount"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_carts_community_id_fkey"
      columns: ["community_id"]
isOneToOne: false
      referencedRelation: "communities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_carts_created_by_user_id_fkey"
      columns: ["created_by_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"is_read": boolean,"link_url": string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"is_read"?: boolean,"link_url"?: string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"is_read"?: boolean,"link_url"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"phone_number": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id": string,"phone_number"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"phone_number"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["user_role"],"updated_at": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name": string,"id": string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"username"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ride_messages": {
                  Row: {
                    "created_at": string,"id": string,"message_text": string,"ride_id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message_text": string,"ride_id": string,"sender_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message_text"?: string,"ride_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ride_messages_ride_id_fkey"
      columns: ["ride_id"]
isOneToOne: false
      referencedRelation: "shared_rides"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ride_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ride_participants": {
                  Row: {
                    "id": string,"joined_at": string,"notes": string | null,"ride_id": string,"seats_reserved": number,"status": Database["public"]['Enums']["ride_participant_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string,"notes"?: string | null,"ride_id": string,"seats_reserved"?: number,"status"?: Database["public"]['Enums']["ride_participant_status"],"user_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string,"notes"?: string | null,"ride_id"?: string,"seats_reserved"?: number,"status"?: Database["public"]['Enums']["ride_participant_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ride_participants_ride_id_fkey"
      columns: ["ride_id"]
isOneToOne: false
      referencedRelation: "shared_rides"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ride_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shared_rides": {
                  Row: {
                    "available_seats": number,"community_id": string,"created_at": string,"created_by_user_id": string,"departure_time": string,"destination": string,"estimated_cost_per_seat": number | null,"id": string,"luggage_details": string | null,"notes": string | null,"pickup_point": string,"status": Database["public"]['Enums']["shared_ride_status"],"total_seats": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available_seats": number,"community_id": string,"created_at"?: string,"created_by_user_id": string,"departure_time": string,"destination": string,"estimated_cost_per_seat"?: number | null,"id"?: string,"luggage_details"?: string | null,"notes"?: string | null,"pickup_point": string,"status"?: Database["public"]['Enums']["shared_ride_status"],"total_seats": number,"updated_at"?: string
                  }
                  Update: {
                    "available_seats"?: number,"community_id"?: string,"created_at"?: string,"created_by_user_id"?: string,"departure_time"?: string,"destination"?: string,"estimated_cost_per_seat"?: number | null,"id"?: string,"luggage_details"?: string | null,"notes"?: string | null,"pickup_point"?: string,"status"?: Database["public"]['Enums']["shared_ride_status"],"total_seats"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_rides_community_id_fkey"
      columns: ["community_id"]
isOneToOne: false
      referencedRelation: "communities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shared_rides_created_by_user_id_fkey"
      columns: ["created_by_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_ride_participant":
{ Args: { "p_applicant_user_id": string,"p_ride_id": string }; Returns: Json
                           },
"cancel_ride_reservation":
{ Args: { "p_participant_user_id": string,"p_ride_id": string }; Returns: Json
                           },
"cancel_shared_ride":
{ Args: { "p_ride_id": string }; Returns: Json
                           },
"decline_ride_participant":
{ Args: { "p_applicant_user_id": string,"p_ride_id": string }; Returns: Json
                           },
"is_community_member":
{ Args: { "p_community_id": string }; Returns: boolean
                           },
"is_staff_or_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_notification_as_read":
{ Args: { "p_notification_id": string }; Returns: boolean
                           },
"request_ride_seats":
{ Args: { "p_ride_id": string,"p_seats_requested": number }; Returns: Json
                           },
"set_cart_item_fulfillment":
{ Args: { "p_fulfilled": boolean,"p_item_id": string }; Returns: Json
                           }
          }
          Enums: {
            "community_request_status": "pending"|"approved"|"rejected","group_cart_status": "open"|"locked"|"ordered"|"completed"|"cancelled","notification_type": "community_request_approved"|"community_request_rejected"|"cart_lock_imminent"|"cart_order_placed"|"ride_seat_requested"|"ride_seat_accepted"|"ride_seat_declined","residential_type": "hostel"|"pg"|"apartment"|"other","ride_participant_status": "pending"|"accepted"|"declined"|"cancelled","shared_ride_status": "open"|"full"|"departed"|"completed"|"cancelled","user_role": "student"|"support_staff"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "community_request_status": ["pending", "approved", "rejected"],"group_cart_status": ["open", "locked", "ordered", "completed", "cancelled"],"notification_type": ["community_request_approved", "community_request_rejected", "cart_lock_imminent", "cart_order_placed", "ride_seat_requested", "ride_seat_accepted", "ride_seat_declined"],"residential_type": ["hostel", "pg", "apartment", "other"],"ride_participant_status": ["pending", "accepted", "declined", "cancelled"],"shared_ride_status": ["open", "full", "departed", "completed", "cancelled"],"user_role": ["student", "support_staff", "admin"]
          }
        }
} as const
