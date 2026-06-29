// Data-access facade. Picks the backend at runtime:
//   Tauri desktop build → ./data/sqlite (native SQLite, offline)
//   Web / PWA build      → ./data/api   (PHP/MySQL REST API)
// Pages import from here and never need to know which backend is live.

export * from "./data/types";

import { isTauri } from "./lib/env";
import * as sqlite from "./data/sqlite";
import * as api from "./data/api";

// `getDb` is a SQLite-only internal; everything else must exist in both backends.
// Typing impl as Omit<…,"getDb"> makes tsc fail here if ./data/api drifts out of
// sync with ./data/sqlite — our guarantee that the two stay interchangeable.
const impl: Omit<typeof sqlite, "getDb"> = isTauri() ? sqlite : api;

export const {
  loadSettings,
  saveSetting,
  loadSeasons,
  loadFxRates,
  updateSeasonField,
  addSeason,
  deleteSeason,
  updateFxRate,
  addFxRate,
  deleteFxRate,
  saveInquiry,
  exportAllData,
  loadDocStatus,
  markDocPdf,
  markDocSent,
  loadDocFields,
  saveDocFields,
  loadPayments,
  recomputeBookingPaid,
  addPayment,
  deletePayment,
  loadLatestBooking,
  loadBookingById,
  loadActiveBooking,
  autoReleaseExpiredHolds,
  loadHolds,
  addHold,
  releaseHold,
  loadDueFollowups,
  loadFollowups,
  addFollowup,
  toggleFollowup,
  deleteFollowup,
  findReturningGuest,
  setBookingCancelled,
  loadPersonalization,
  savePersonalization,
  loadGuestStays,
} = impl;
