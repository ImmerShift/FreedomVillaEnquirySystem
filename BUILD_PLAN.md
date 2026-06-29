# Freedom Villa — V2 Build Plan

**Decided architecture (27 Jun 2026):**
- **One online-first installable PWA** (single React codebase for laptop + phone + tablet). The Tauri desktop app is frozen as legacy.
- **Backend: vanilla PHP + MySQL REST API** — portable, runs on shared cPanel. No Node/Postgres/sync-engine (cPanel can't host them).
- **Hosting:** PWA static files + PHP API on Rob's cPanel; data in MySQL. Public app at `inquiry.freedomvillabali.com`.
- **Single-user auth** (Rob only). **Client-side print-to-PDF** (no server PDF).
- **Offline:** service worker caches app + recent data for *reading* during wifi blips. No offline-write sync (cPanel can't support it; villa has wifi).
- **We build & test locally; deploy when Rob provides cPanel/FTP access** (the last step).

---

## Phase 0 — V1 fixes (current app; these components port straight into the PWA)

- [ ] **Fix 1 — Real logo everywhere** (`logo-freedomvilla.png`): sidebar 120px; all 5 document headers 100px; window taskbar icon = hummingbird crop.
- [ ] **Fix 2 — One-page Quotation** to Rob's exact spec: remove the 3 photos, the navy TOTAL box, the duplicate line-item table, and the long "Dear…" opening. New layout: centred logo → QUOTATION → 2-col meta → italic one-liner → 4-col stay row → 2-col main (gold rate box LEFT / totals RIGHT) → 2-col inclusions grid → terms → closing → 2-col footer (contact + signature). **Verify the PDF prints 1/1.**
- [ ] **Fix 3 — App icon** from the real hummingbird mark (32/64/128/256/512).
- [ ] **Fix 4 — Signature** on **Quotation + Invoice only** (not Receipt): 70px, footer-right, `mix-blend-mode: multiply` to drop the white box.
- [ ] **Seed real villa details**: phone `+62 812 384 88685`, email `robert@freedomvillabali.com`, owner title, check-in 3:00 PM / check-out 11:00 AM, real inclusions list.

## Phase 1 — PWA + PHP/MySQL backend (built & tested locally)

- [ ] MySQL schema (port from the SQLite migrations)
- [ ] PHP REST API — auth + CRUD for every entity
- [ ] Rewrite `db.ts` → API client (the only frontend file that changes)
- [ ] Single-user login screen
- [ ] PWA config: manifest, installable, service worker (read-offline cache)
- [ ] Local end-to-end test
- [ ] Data import path (existing JSON backup → MySQL)

## Phase 2 — Deploy (needs Rob's cPanel access)

- [ ] Confirm host has PHP 8+, MySQL, and can point a subdomain
- [ ] Upload PWA build + PHP API; create + import MySQL DB
- [ ] Point `inquiry.freedomvillabali.com`; smoke-test on real phone/tablet/laptop

## Phase 3 — V2 features (built once, on the unified PWA)

- [ ] Settings: tax configuration (inclusive vs added-on-top, per-booking override)
- [ ] Settings: agent rate tier + New Inquiry "Booking source"
- [ ] Settings: currency management + "converted at X on date" note
- [ ] New Inquiry: min-stay warning, document-status checklist
- [ ] Guest Stay: search/filter, payment-ledger enhancements, follow-up scheduler, returning-guest flag
- [ ] Documents: guest-first flow + "Generate document" modal
- [ ] Availability: tentative holds, same-day transitions, buffer days, season overlay, gap finder, filters, revenue stats + revenue view
- [ ] Home dashboard
- [ ] All 5 documents verified A4

## Phase 4 — Public guest personalization form (needs backend live)

- [ ] Tokenised public URL per booking (expires after checkout)
- [ ] Branded guest form (dietary / amenities / occasions / arrival / extras)
- [ ] Writes to `personalization_responses`; status badges + in-app notification

## Out of scope (per Rob)
Online payments/Stripe · live FX API · OTA dashboards · email marketing · analytics · multi-user · WhatsApp Business API · automated sending without Rob's review.
