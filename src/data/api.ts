// Data access over the PHP/MySQL REST API. This is the web/PWA backend.
// Same exported surface as ./sqlite.ts so ../db can swap between them at runtime.
// Numeric columns are returned as JSON numbers by the API (see api/lib.php fv_numify).

import { getActiveBookingId } from "../lib/activeBooking";
import { getToken } from "../lib/auth";
import type {
  Season,
  FxRate,
  Settings,
  FullBooking,
  SaveInquiryInput,
  DocStatus,
  Payment,
  GuestStayRow,
  ReturningGuest,
  Followup,
  DueFollowup,
  Hold,
  Personalization,
} from "./types";

const API_BASE = ((import.meta as any).env?.VITE_API_URL as string) || "/api";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    // token missing/expired — bounce to login
    window.dispatchEvent(new CustomEvent("fv-unauthorized"));
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(p: string) => req<T>(p);
const send = <T>(method: string, p: string, body?: unknown) =>
  req<T>(p, { method, body: body === undefined ? undefined : JSON.stringify(body) });

const qs = (params: Record<string, string | number>) =>
  "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

// ---- settings ----

export async function loadSettings(): Promise<Settings> {
  return get<Settings>("/settings");
}
export async function saveSetting(key: string, value: string): Promise<void> {
  await send("PUT", "/settings", { [key]: value });
}

// ---- seasons & fx ----

export async function loadSeasons(): Promise<Season[]> {
  return get<Season[]>("/seasons");
}
export async function loadFxRates(): Promise<FxRate[]> {
  return get<FxRate[]>("/fx-rates");
}
export async function updateSeasonField(
  id: number,
  field: string,
  value: string | number
): Promise<void> {
  await send("PATCH", `/seasons/${id}`, { [field]: value });
}
export async function addSeason(): Promise<Season> {
  return send<Season>("POST", "/seasons");
}
export async function deleteSeason(id: number): Promise<void> {
  await send("DELETE", `/seasons/${id}`);
}
export async function updateFxRate(code: string, ratePerAud: number): Promise<void> {
  await send("PATCH", `/fx-rates/${code}`, { rate_per_aud: ratePerAud });
}
export async function addFxRate(code: string, name: string, ratePerAud: number): Promise<void> {
  await send("POST", "/fx-rates", { code, name, rate_per_aud: ratePerAud });
}
export async function deleteFxRate(code: string): Promise<void> {
  await send("DELETE", `/fx-rates/${code}`);
}

// ---- inquiries ----

export async function saveInquiry(input: SaveInquiryInput): Promise<number> {
  const r = await send<{ booking_id: number }>("POST", "/inquiries", input);
  return r.booking_id;
}

export async function exportAllData(): Promise<unknown> {
  return get<unknown>("/export");
}

// ---- documents ----

export async function loadDocStatus(
  bookingId: number,
  docType: string
): Promise<DocStatus | null> {
  return get<DocStatus | null>("/doc-status" + qs({ booking_id: bookingId, doc_type: docType }));
}
export async function markDocPdf(bookingId: number, docType: string): Promise<void> {
  await send("POST", "/doc-status/pdf", { booking_id: bookingId, doc_type: docType });
}
export async function markDocSent(bookingId: number, docType: string, via: string): Promise<void> {
  await send("POST", "/doc-status/sent", { booking_id: bookingId, doc_type: docType, via });
}
export async function loadDocFields(
  bookingId: number,
  docType: string
): Promise<Record<string, string>> {
  return get<Record<string, string>>("/doc-fields" + qs({ booking_id: bookingId, doc_type: docType }));
}
export async function saveDocFields(
  bookingId: number,
  docType: string,
  fields: Record<string, string>
): Promise<void> {
  await send("PUT", "/doc-fields", { booking_id: bookingId, doc_type: docType, fields });
}

// ---- payments ----

export async function loadPayments(bookingId: number): Promise<Payment[]> {
  return get<Payment[]>("/payments" + qs({ booking_id: bookingId }));
}
/** The server keeps amount_paid/balance in sync on add/delete; this is a no-op on web. */
export async function recomputeBookingPaid(_bookingId: number): Promise<void> {
  /* handled server-side */
}
export async function addPayment(p: {
  booking_id: number;
  amount: number;
  kind: string;
  method: string;
  paid_on: string;
  note: string;
}): Promise<void> {
  await send("POST", "/payments", p);
}
export async function deletePayment(id: number, bookingId: number): Promise<void> {
  await send("DELETE", `/payments/${id}` + qs({ booking_id: bookingId }));
}

// ---- bookings ----

export async function loadLatestBooking(): Promise<FullBooking | null> {
  return get<FullBooking | null>("/bookings/latest");
}
export async function loadBookingById(id: number): Promise<FullBooking | null> {
  return get<FullBooking | null>(`/bookings/${id}`);
}
export async function loadActiveBooking(): Promise<FullBooking | null> {
  const id = getActiveBookingId();
  if (id != null) {
    const byId = await loadBookingById(id);
    if (byId) return byId;
  }
  return loadLatestBooking();
}

// ---- holds ----

export async function autoReleaseExpiredHolds(): Promise<void> {
  await send("POST", "/holds/auto-release");
}
export async function loadHolds(): Promise<Hold[]> {
  return get<Hold[]>("/holds");
}
export async function addHold(h: {
  guest_name: string;
  check_in: string;
  check_out: string;
  expires_on: string;
  note: string;
}): Promise<void> {
  await send("POST", "/holds", h);
}
export async function releaseHold(id: number): Promise<void> {
  await send("PATCH", `/holds/${id}`, { released: 1 });
}

// ---- follow-ups ----

export async function loadDueFollowups(): Promise<DueFollowup[]> {
  return get<DueFollowup[]>("/due-followups");
}
export async function loadFollowups(bookingId: number): Promise<Followup[]> {
  return get<Followup[]>("/followups" + qs({ booking_id: bookingId }));
}
export async function addFollowup(bookingId: number, dueDate: string, note: string): Promise<void> {
  await send("POST", "/followups", { booking_id: bookingId, due_date: dueDate, note });
}
export async function toggleFollowup(id: number, done: boolean): Promise<void> {
  await send("PATCH", `/followups/${id}`, { done: done ? 1 : 0 });
}
export async function deleteFollowup(id: number): Promise<void> {
  await send("DELETE", `/followups/${id}`);
}

// ---- guests / personalization ----

export async function findReturningGuest(email: string): Promise<ReturningGuest | null> {
  const e = (email || "").trim();
  if (!e) return null;
  return get<ReturningGuest | null>("/returning-guest" + qs({ email: e }));
}
export async function setBookingCancelled(id: number, cancelled: boolean): Promise<void> {
  await send("PATCH", `/bookings/${id}`, { status: cancelled ? "Cancelled" : "Inquiry" });
}
export async function loadPersonalization(bookingId: number): Promise<Personalization | null> {
  return get<Personalization | null>(`/personalizations/${bookingId}`);
}
export async function savePersonalization(p: Personalization): Promise<void> {
  await send("PUT", `/personalizations/${p.booking_id}`, p);
}
export async function loadGuestStays(): Promise<GuestStayRow[]> {
  return get<GuestStayRow[]>("/guest-stays");
}
