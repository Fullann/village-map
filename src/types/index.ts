export type SeasonMode = "halloween" | "advent" | "off_season";
export type VerificationStatus = "pending" | "verified_by_code" | "verified_by_admin" | "revoked";
export type AppRole = "resident" | "moderator" | "admin";

export interface Address {
  id: string;
  street_name: string;
  house_number: string;
  postal_code: string;
  city: string;
  lng?: number;
  lat?: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  address_id: string | null;
  requested_address_id: string | null;
  verification_status: VerificationStatus;
}

export interface VillageMapEvent {
  address_id: string;
  street_name: string;
  house_number: string;
  lng: number;
  lat: number;
  is_distributing?: boolean | null;
  out_of_candy?: boolean | null;
  halloween_start?: string | null;
  halloween_end?: string | null;
  is_self_service?: boolean | null;
  access_instructions?: string | null;
  day_number?: number | null;
  participation_type?: "window_only" | "hospitality" | null;
  activity_label?: string | null;
  lighting_time?: string | null;
  event_start_time?: string | null;
  hospitality_details?: string | null;
  is_accessible_step_free?: boolean | null;
  photo_url?: string | null;
}

export interface CommunalAlert {
  id: string;
  level: "info" | "warning" | "urgent";
  title: string;
  message: string;
  created_at?: string;
}

export interface MyHalloweenStatus {
  isRegistered: boolean;
  isDistributing: boolean;
  outOfCandy: boolean;
  addressLabel: string;
}
