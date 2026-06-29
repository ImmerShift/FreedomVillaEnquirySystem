// Shared data types for both backends (SQLite + REST API).

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  nightly_rate: number;
  agent_rate: number | null;
  minimum_nights: number;
  sort_order: number;
}

export interface FxRate {
  code: string;
  name: string;
  rate_per_aud: number;
  sort_order: number;
}

export type Settings = Record<string, string>;

export interface Booking {
  id: number;
  guest_id: number;
  check_in: string;
  check_out: string;
  num_guests: number;
  inquiry_date: string;
  currency: string;
  source: string;
  apply_tax: number | null;
  override_rate: number | null;
  applied_rate: number;
  rate_source: string;
  direct_saving: number;
  accommodation_total: number;
  additional_total: number;
  grand_total: number;
  deposit: number;
  amount_paid: number;
  balance: number;
  notes: string | null;
  status: string;
  quote_status: string;
  invoice_status: string;
  personalize_status: string;
  created_at: string;
  updated_at: string;
}

export interface BookingCharge {
  id: number;
  booking_id: number;
  description: string;
  qty: number;
  unit_price: number;
  sort_order: number;
}

export interface FullBooking {
  booking: Booking;
  guest: Guest;
  charges: BookingCharge[];
}

export interface Guest {
  id: number;
  full_name: string;
  country: string | null;
  email: string | null;
  whatsapp: string | null;
  preferences_notes: string | null;
  created_at: string;
}

export interface ChargeRow {
  desc: string;
  qty: number;
  unit: number;
}

export interface SaveInquiryInput {
  guest: {
    full_name: string;
    country: string;
    email: string;
    whatsapp: string;
  };
  booking: {
    check_in: string;
    check_out: string;
    num_guests: number;
    inquiry_date: string;
    currency: string;
    source: string;
    apply_tax: number | null;
    override_rate: number | null;
    applied_rate: number;
    rate_source: string;
    direct_saving: number;
    accommodation_total: number;
    additional_total: number;
    grand_total: number;
    deposit: number;
    amount_paid: number;
    balance: number;
    notes: string;
  };
  charges: ChargeRow[];
}

export interface DocStatus {
  booking_id: number;
  doc_type: string;
  pdf_saved_at: string | null;
  sent_at: string | null;
  sent_via: string | null;
}

export interface Payment {
  id: number;
  booking_id: number;
  amount: number;
  kind: string;
  method: string | null;
  paid_on: string | null;
  note: string | null;
  created_at: string;
}

export interface GuestStayRow {
  id: number;
  guest_name: string;
  email: string | null;
  country: string | null;
  check_in: string;
  check_out: string;
  num_guests: number;
  grand_total: number;
  amount_paid: number;
  currency: string;
  source: string;
  quote_status: string;
  invoice_status: string;
  personalize_status: string;
  quote_sent_at: string | null;
  status: string;
  followups_due: number;
}

export interface ReturningGuest {
  full_name: string;
  check_in: string;
  check_out: string;
}

export interface Followup {
  id: number;
  booking_id: number;
  due_date: string | null;
  note: string | null;
  done: number;
  created_at: string;
}

export interface DueFollowup {
  id: number;
  booking_id: number;
  guest_name: string;
  due_date: string | null;
  note: string | null;
}

export interface Hold {
  id: number;
  guest_name: string | null;
  check_in: string;
  check_out: string;
  expires_on: string | null;
  note: string | null;
  released: number;
  created_at: string;
}

export interface Personalization {
  booking_id: number;
  arriving_names: string | null;
  flight_number: string | null;
  airline: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  beds_json: string | null;
  notes: string | null;
  completed_at: string | null;
}
