// Data access over the native SQLite database (tauri-plugin-sql).
// The DB file lives in the app data dir; migrations/seeding run in Rust at startup.
// This is the Tauri (offline desktop) backend. See ./api.ts for the web backend.

import Database from "@tauri-apps/plugin-sql";
import { getActiveBookingId } from "../lib/activeBooking";
import type {
  Season,
  FxRate,
  Settings,
  Booking,
  BookingCharge,
  FullBooking,
  Guest,
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

const DB_URL = "sqlite:freedom-villa.db";

let _db: Database | null = null;
export async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load(DB_URL);
  return _db;
}

// ---- settings ----

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings"
  );
  const out: Settings = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value]
  );
}

// ---- seasons & fx ----

export async function loadSeasons(): Promise<Season[]> {
  const db = await getDb();
  return db.select<Season[]>(
    "SELECT * FROM seasons ORDER BY sort_order, start_date"
  );
}

export async function loadFxRates(): Promise<FxRate[]> {
  const db = await getDb();
  return db.select<FxRate[]>("SELECT * FROM fx_rates ORDER BY sort_order");
}

const SEASON_FIELDS = new Set([
  "name",
  "start_date",
  "end_date",
  "nightly_rate",
  "agent_rate",
  "rack_rate",
  "minimum_nights",
]);

export async function updateSeasonField(
  id: number,
  field: string,
  value: string | number
): Promise<void> {
  if (!SEASON_FIELDS.has(field)) throw new Error(`bad season field: ${field}`);
  const db = await getDb();
  await db.execute(`UPDATE seasons SET ${field} = $1 WHERE id = $2`, [value, id]);
}

export async function addSeason(): Promise<Season> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO seasons (name, start_date, end_date, nightly_rate, minimum_nights, sort_order)
     VALUES ('Low', '', '', 1300, 3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM seasons))`
  );
  const rows = await db.select<Season[]>("SELECT * FROM seasons WHERE id = $1", [
    res.lastInsertId,
  ]);
  return rows[0];
}

export async function deleteSeason(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM seasons WHERE id = $1", [id]);
}

export async function updateFxRate(
  code: string,
  ratePerAud: number
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE fx_rates SET rate_per_aud = $1 WHERE code = $2", [
    ratePerAud,
    code,
  ]);
}

// ---- inquiries (guest + booking + charges) ----

/** Inserts a guest, a booking, and its charge rows. Returns the new booking id. */
export async function saveInquiry(input: SaveInquiryInput): Promise<number> {
  const db = await getDb();

  const guestRes = await db.execute(
    "INSERT INTO guests (full_name, country, email, whatsapp) VALUES ($1,$2,$3,$4)",
    [
      input.guest.full_name,
      input.guest.country,
      input.guest.email,
      input.guest.whatsapp,
    ]
  );
  const guestId = guestRes.lastInsertId;

  const b = input.booking;
  const bookingRes = await db.execute(
    `INSERT INTO bookings
      (guest_id, check_in, check_out, num_guests, inquiry_date, currency,
       source, apply_tax, override_rate, applied_rate, rate_source, direct_saving,
       accommodation_total, additional_total, grand_total, deposit,
       amount_paid, balance, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      guestId,
      b.check_in,
      b.check_out,
      b.num_guests,
      b.inquiry_date,
      b.currency,
      b.source,
      b.apply_tax,
      b.override_rate,
      b.applied_rate,
      b.rate_source,
      b.direct_saving,
      b.accommodation_total,
      b.additional_total,
      b.grand_total,
      b.deposit,
      b.amount_paid,
      b.balance,
      b.notes,
    ]
  );
  const bookingId = bookingRes.lastInsertId as number;

  for (let i = 0; i < input.charges.length; i++) {
    const c = input.charges[i];
    if (!c.desc && !c.unit) continue;
    await db.execute(
      "INSERT INTO charges (booking_id, description, qty, unit_price, sort_order) VALUES ($1,$2,$3,$4,$5)",
      [bookingId, c.desc, c.qty, c.unit, i]
    );
  }

  // seed the payments ledger with the deposit entered at inquiry time
  if (b.amount_paid > 0) {
    await db.execute(
      "INSERT INTO payments (booking_id, amount, kind, method, paid_on, note) VALUES ($1,$2,'Deposit','',$3,'Initial deposit')",
      [bookingId, b.amount_paid, b.inquiry_date]
    );
  }

  return bookingId;
}

async function hydrateBooking(booking: Booking): Promise<FullBooking> {
  const db = await getDb();
  const guests = await db.select<Guest[]>("SELECT * FROM guests WHERE id = $1", [
    booking.guest_id,
  ]);
  const charges = await db.select<BookingCharge[]>(
    "SELECT * FROM charges WHERE booking_id = $1 ORDER BY sort_order, id",
    [booking.id]
  );
  return { booking, guest: guests[0], charges };
}

/** Full data snapshot (all tables) for a backup file. */
export async function exportAllData(): Promise<unknown> {
  const db = await getDb();
  const tables = [
    "settings",
    "seasons",
    "fx_rates",
    "guests",
    "bookings",
    "charges",
    "payments",
    "personalizations",
    "doc_fields",
    "doc_status",
    "follow_ups",
    "holds",
  ];
  const data: Record<string, unknown[]> = {};
  for (const t of tables) {
    data[t] = await db.select<unknown[]>(`SELECT * FROM ${t}`);
  }
  return { app: "Freedom Villa Booking Hub", version: 1, exported_at: new Date().toISOString(), data };
}

export async function loadDocStatus(
  bookingId: number,
  docType: string
): Promise<DocStatus | null> {
  const db = await getDb();
  const rows = await db.select<DocStatus[]>(
    "SELECT * FROM doc_status WHERE booking_id = $1 AND doc_type = $2",
    [bookingId, docType]
  );
  return rows[0] ?? null;
}

export async function markDocPdf(bookingId: number, docType: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO doc_status (booking_id, doc_type, pdf_saved_at) VALUES ($1,$2,$3)
     ON CONFLICT(booking_id, doc_type) DO UPDATE SET pdf_saved_at = $3`,
    [bookingId, docType, now]
  );
}

export async function markDocSent(
  bookingId: number,
  docType: string,
  via: string
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO doc_status (booking_id, doc_type, sent_at, sent_via) VALUES ($1,$2,$3,$4)
     ON CONFLICT(booking_id, doc_type) DO UPDATE SET sent_at = $3, sent_via = $4`,
    [bookingId, docType, now, via]
  );
  if (docType === "quotation") {
    await db.execute("UPDATE bookings SET quote_status = 'Sent' WHERE id = $1", [
      bookingId,
    ]);
  }
}

export async function loadDocFields(
  bookingId: number,
  docType: string
): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ field: string; value: string }[]>(
    "SELECT field, value FROM doc_fields WHERE booking_id = $1 AND doc_type = $2",
    [bookingId, docType]
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.field] = r.value;
  return out;
}

export async function saveDocFields(
  bookingId: number,
  docType: string,
  fields: Record<string, string>
): Promise<void> {
  const db = await getDb();
  for (const [field, value] of Object.entries(fields)) {
    await db.execute(
      `INSERT INTO doc_fields (booking_id, doc_type, field, value) VALUES ($1,$2,$3,$4)
       ON CONFLICT(booking_id, doc_type, field) DO UPDATE SET value = $4`,
      [bookingId, docType, field, value]
    );
  }
}

export async function loadPayments(bookingId: number): Promise<Payment[]> {
  const db = await getDb();
  return db.select<Payment[]>(
    "SELECT * FROM payments WHERE booking_id = $1 ORDER BY paid_on, id",
    [bookingId]
  );
}

/** Keeps bookings.amount_paid / balance in sync with the payments ledger. */
export async function recomputeBookingPaid(bookingId: number): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ total: number }[]>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE booking_id = $1",
    [bookingId]
  );
  const paid = rows[0]?.total ?? 0;
  await db.execute(
    "UPDATE bookings SET amount_paid = $1, balance = grand_total - $1 WHERE id = $2",
    [paid, bookingId]
  );
}

export async function addPayment(p: {
  booking_id: number;
  amount: number;
  kind: string;
  method: string;
  paid_on: string;
  note: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO payments (booking_id, amount, kind, method, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)",
    [p.booking_id, p.amount, p.kind, p.method, p.paid_on, p.note]
  );
  await recomputeBookingPaid(p.booking_id);
}

export async function deletePayment(id: number, bookingId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM payments WHERE id = $1", [id]);
  await recomputeBookingPaid(bookingId);
}

/** Loads the most recently saved booking with its guest and charges, or null. */
export async function loadLatestBooking(): Promise<FullBooking | null> {
  const db = await getDb();
  const bookings = await db.select<Booking[]>(
    "SELECT * FROM bookings ORDER BY id DESC LIMIT 1"
  );
  if (bookings.length === 0) return null;
  return hydrateBooking(bookings[0]);
}

/** Loads a specific booking by id, or null if it no longer exists. */
export async function loadBookingById(id: number): Promise<FullBooking | null> {
  const db = await getDb();
  const bookings = await db.select<Booking[]>(
    "SELECT * FROM bookings WHERE id = $1",
    [id]
  );
  if (bookings.length === 0) return null;
  return hydrateBooking(bookings[0]);
}

/** The booking the document screens show: the active one if set, else the latest. */
export async function loadActiveBooking(): Promise<FullBooking | null> {
  const id = getActiveBookingId();
  if (id != null) {
    const byId = await loadBookingById(id);
    if (byId) return byId;
  }
  return loadLatestBooking();
}

// ---- tentative holds (Availability) ----

/** Marks any non-released hold whose expiry date has passed as released. */
export async function autoReleaseExpiredHolds(): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE holds SET released = 1 WHERE released = 0 AND expires_on IS NOT NULL AND expires_on < date('now')"
  );
}

/** Active (not released) holds, soonest stay first. */
export async function loadHolds(): Promise<Hold[]> {
  const db = await getDb();
  return db.select<Hold[]>(
    "SELECT * FROM holds WHERE released = 0 ORDER BY check_in, id"
  );
}

export async function addHold(h: {
  guest_name: string;
  check_in: string;
  check_out: string;
  expires_on: string;
  note: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO holds (guest_name, check_in, check_out, expires_on, note) VALUES ($1,$2,$3,$4,$5)",
    [h.guest_name || null, h.check_in, h.check_out, h.expires_on || null, h.note || null]
  );
}

/** Releases a hold (frees its dates) without deleting the record. */
export async function releaseHold(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE holds SET released = 1 WHERE id = $1", [id]);
}

/** Open follow-ups due today or overdue, across all active bookings (for the dashboard). */
export async function loadDueFollowups(): Promise<DueFollowup[]> {
  const db = await getDb();
  return db.select<DueFollowup[]>(`
    SELECT f.id, f.booking_id, COALESCE(g.full_name, '—') AS guest_name,
           f.due_date, f.note
    FROM follow_ups f
    JOIN bookings b ON b.id = f.booking_id
    LEFT JOIN guests g ON g.id = b.guest_id
    WHERE f.done = 0 AND f.due_date <= date('now') AND b.status != 'Cancelled'
    ORDER BY f.due_date, f.id
  `);
}

export async function loadFollowups(bookingId: number): Promise<Followup[]> {
  const db = await getDb();
  return db.select<Followup[]>(
    "SELECT * FROM follow_ups WHERE booking_id = $1 ORDER BY done, due_date, id",
    [bookingId]
  );
}

export async function addFollowup(
  bookingId: number,
  dueDate: string,
  note: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO follow_ups (booking_id, due_date, note) VALUES ($1,$2,$3)",
    [bookingId, dueDate, note]
  );
}

export async function toggleFollowup(id: number, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE follow_ups SET done = $1 WHERE id = $2", [done ? 1 : 0, id]);
}

export async function deleteFollowup(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM follow_ups WHERE id = $1", [id]);
}

/** Most recent prior stay for a guest email (for the returning-guest banner), or null. */
export async function findReturningGuest(
  email: string
): Promise<ReturningGuest | null> {
  const e = (email || "").trim();
  if (!e) return null;
  const db = await getDb();
  const rows = await db.select<ReturningGuest[]>(
    `SELECT g.full_name, b.check_in, b.check_out
     FROM bookings b JOIN guests g ON g.id = b.guest_id
     WHERE LOWER(g.email) = LOWER($1) AND b.status != 'Cancelled'
     ORDER BY b.check_in DESC LIMIT 1`,
    [e]
  );
  return rows[0] ?? null;
}

/** Marks a booking cancelled (or restores it). Reversible. */
export async function setBookingCancelled(
  id: number,
  cancelled: boolean
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE bookings SET status = $1 WHERE id = $2", [
    cancelled ? "Cancelled" : "Inquiry",
    id,
  ]);
}

export async function loadPersonalization(
  bookingId: number
): Promise<Personalization | null> {
  const db = await getDb();
  const rows = await db.select<Personalization[]>(
    "SELECT * FROM personalizations WHERE booking_id = $1",
    [bookingId]
  );
  return rows[0] ?? null;
}

/** Upserts a personalization and reflects its state on the booking's pipeline chip. */
export async function savePersonalization(p: Personalization): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO personalizations
       (booking_id, arriving_names, flight_number, airline, arrival_date, arrival_time, beds_json, notes, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(booking_id) DO UPDATE SET
       arriving_names=$2, flight_number=$3, airline=$4, arrival_date=$5,
       arrival_time=$6, beds_json=$7, notes=$8, completed_at=$9`,
    [
      p.booking_id,
      p.arriving_names,
      p.flight_number,
      p.airline,
      p.arrival_date,
      p.arrival_time,
      p.beds_json,
      p.notes,
      p.completed_at,
    ]
  );
  await db.execute("UPDATE bookings SET personalize_status = $1 WHERE id = $2", [
    p.completed_at ? "Received" : "Pending",
    p.booking_id,
  ]);
}

/** All bookings, newest stays first, for the Guests Stay pipeline. */
export async function loadGuestStays(): Promise<GuestStayRow[]> {
  const db = await getDb();
  return db.select<GuestStayRow[]>(`
    SELECT b.id, COALESCE(g.full_name, '—') AS guest_name, g.email, g.country,
           b.check_in, b.check_out, b.num_guests, b.grand_total, b.amount_paid,
           b.currency, COALESCE(b.source, 'Direct (website)') AS source,
           b.status, b.quote_status, b.invoice_status, b.personalize_status,
           qs.sent_at AS quote_sent_at,
           (SELECT COUNT(*) FROM follow_ups f
              WHERE f.booking_id = b.id AND f.done = 0 AND f.due_date <= date('now')) AS followups_due
    FROM bookings b
    LEFT JOIN guests g ON g.id = b.guest_id
    LEFT JOIN doc_status qs ON qs.booking_id = b.id AND qs.doc_type = 'quotation'
    ORDER BY b.check_in DESC, b.id DESC
  `);
}
