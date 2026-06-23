// Pure pricing + currency logic — no DB, no React. Easy to reason about and test.
// All money is held internally in AUD (the base currency). Display values are
// converted to the chosen currency at render time via makeFormatter().

import type { Season, FxRate } from "../db";

export interface Charge {
  desc: string;
  qty: number;
  unit: number; // AUD
}

export interface PricingInput {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  seasons: Season[];
  override: number | null; // AUD; null/0 = use seasonal
  charges: Charge[];
  amountPaid: number; // AUD
  depositPct: number;
}

export interface PricingResult {
  nights: number;
  seasonName: string; // '—' when no season matches
  seasonalRate: number | null; // AUD
  minNights: number | null;
  rateUsed: number; // AUD
  rateSource: "SEASONAL" | "OVERRIDE" | "—";
  accommodation: number; // AUD
  additionalTotal: number; // AUD
  grandTotal: number; // AUD
  deposit: number; // AUD
  balance: number; // AUD
  minMet: boolean | null; // null when not yet determinable
}

/** Nights between two ISO dates (check-out minus check-in). 0 if invalid/negative. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = Date.parse(checkIn + "T00:00:00");
  const b = Date.parse(checkOut + "T00:00:00");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  const diff = Math.round((b - a) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** First season whose date range contains the check-in date (ISO strings sort correctly). */
export function findSeason(seasons: Season[], checkIn: string): Season | null {
  if (!checkIn) return null;
  for (const s of seasons) {
    if (checkIn >= s.start_date && checkIn <= s.end_date) return s;
  }
  return null;
}

export function computePricing(input: PricingInput): PricingResult {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const season = findSeason(input.seasons, input.checkIn);

  const seasonalRate = season ? season.nightly_rate : null;
  const minNights = season ? season.minimum_nights : null;

  const hasOverride = input.override != null && input.override > 0;
  const rateUsed = hasOverride ? (input.override as number) : seasonalRate ?? 0;
  const rateSource: PricingResult["rateSource"] = hasOverride
    ? "OVERRIDE"
    : season
    ? "SEASONAL"
    : "—";

  const accommodation = nights * rateUsed;
  const additionalTotal = input.charges.reduce(
    (sum, c) => sum + (Number(c.qty) || 0) * (Number(c.unit) || 0),
    0
  );
  const grandTotal = accommodation + additionalTotal;
  const deposit = Math.round((grandTotal * (input.depositPct || 0)) / 100);
  const balance = grandTotal - (input.amountPaid || 0);

  const minMet =
    minNights == null || nights === 0 ? null : nights >= minNights;

  return {
    nights,
    seasonName: season ? season.name : "—",
    seasonalRate,
    minNights,
    rateUsed,
    rateSource,
    accommodation,
    additionalTotal,
    grandTotal,
    deposit,
    balance,
    minMet,
  };
}

// ---- dates ----

/** "12 Aug 2026" from an ISO date, or "—" if empty/invalid. */
export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Adds days to an ISO date, returning a new ISO date ("" if invalid). */
export function addDays(iso: string, days: number): string {
  const d = new Date((iso || "").slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---- currency ----

export const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  USD: "US$",
  IDR: "Rp",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  THB: "฿",
};

/**
 * Returns a formatter that converts an AUD amount into the chosen currency
 * and renders it with the right symbol and thousands separators.
 */
export function makeFormatter(currency: string, fxRates: FxRate[]) {
  const rate =
    currency === "AUD"
      ? 1
      : fxRates.find((f) => f.code === currency)?.rate_per_aud ?? 1;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  return (aud: number) => `${symbol}${nf.format(Math.round((aud || 0) * rate))}`;
}
