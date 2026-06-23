// Which saved booking the document screens should show. Persisted in localStorage
// so it survives navigation and app restarts. Set when an inquiry is saved or when
// a guest is picked on the Guests Stay screen.

const KEY = "fv_active_booking_id";

export function getActiveBookingId(): number | null {
  const v = localStorage.getItem(KEY);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function setActiveBookingId(id: number): void {
  localStorage.setItem(KEY, String(id));
}

export function clearActiveBookingId(): void {
  localStorage.removeItem(KEY);
}
