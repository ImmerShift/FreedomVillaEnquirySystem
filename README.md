# Freedom Villa — Booking Hub

A desktop booking & document app for **Freedom Villa Bali** (Petitenget, Seminyak), built for owner-operator Robert Addamo by **ImmerShift**.

Rob enters a guest inquiry once and the app produces every document — quotation, invoice, receipt, villa guide, and a pre-arrival personalization form — with the right name, dates, seasonal rate, extras, and totals already filled in. Offline-first, no accounts, no setup.

## Features

- **New Inquiry** — guest details + a live seasonal pricing engine (date-range season match, minimum-stay check, custom rate override, additional charges), multi-currency.
- **Guests Stay** — pipeline of every booking with quote/invoice/personalize status; cancel & restore.
- **Availability** — month calendar with occupancy %, built from saved bookings.
- **Documents** — Quotation, Invoice, Receipt, Villa Guide, Personalization. Editable text, portrait/landscape, print-to-PDF, per-document "PDF created / sent" status, and a Send modal (WhatsApp / email).
- **Payments** — a ledger on the Receipt screen; deposit/balance flow into the invoice, calendar, and pipeline.
- **Settings** — villa details, document logo upload, payment details, rooms & beds, seasons & rates, exchange rates, and a one-click data backup.

## Stack

- **Tauri 2** (Rust shell) + **React 19** + **TypeScript** + **Vite** + **Tailwind CSS**
- Native **SQLite** via `tauri-plugin-sql` (data lives in the app data dir; schema/migrations in `src-tauri/src/lib.rs`)
- Self-hosted fonts (`@fontsource`) so everything renders offline

## Develop

```bash
npm install
npm run tauri dev      # run the app with hot reload
```

## Build the installer

```bash
npm run tauri build    # produces a Windows NSIS setup .exe + .msi
```

Output lands in `src-tauri/target/release/bundle/`. The app is currently unsigned, so the first install shows a one-time Windows SmartScreen "unknown publisher" warning.

## Regenerate the app icon

```bash
npx tauri icon app-icon-source.png
```

---

© ImmerShift. Internal project.
