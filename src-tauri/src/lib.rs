use tauri_plugin_sql::{Migration, MigrationKind};

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS seasons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  nightly_rate  REAL NOT NULL,          -- stored in AUD (base currency)
  minimum_nights INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fx_rates (
  code          TEXT PRIMARY KEY,        -- e.g. USD, IDR
  name          TEXT NOT NULL,
  rate_per_aud  REAL NOT NULL,           -- how many units = 1 AUD
  sort_order    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name         TEXT NOT NULL,
  country           TEXT,
  email             TEXT,
  whatsapp          TEXT,
  preferences_notes TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id            INTEGER REFERENCES guests(id),
  check_in            TEXT,
  check_out           TEXT,
  num_guests          INTEGER DEFAULT 2,
  inquiry_date        TEXT,
  currency            TEXT DEFAULT 'AUD',
  override_rate       REAL,              -- AUD; null = use seasonal
  applied_rate        REAL,              -- AUD; the rate actually used / night
  rate_source         TEXT,              -- 'SEASONAL' | 'OVERRIDE'
  direct_saving       REAL DEFAULT 0,    -- AUD; shown on quotation
  accommodation_total REAL DEFAULT 0,    -- AUD
  additional_total    REAL DEFAULT 0,    -- AUD
  grand_total         REAL DEFAULT 0,    -- AUD
  deposit             REAL DEFAULT 0,    -- AUD
  amount_paid         REAL DEFAULT 0,    -- AUD
  balance             REAL DEFAULT 0,    -- AUD
  notes               TEXT,
  status              TEXT DEFAULT 'Inquiry',
  quote_status        TEXT DEFAULT 'Draft',
  invoice_status      TEXT DEFAULT 'Pending',
  personalize_status  TEXT DEFAULT 'Pending',
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS charges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  description TEXT,
  qty         REAL DEFAULT 1,
  unit_price  REAL DEFAULT 0,            -- AUD
  sort_order  INTEGER DEFAULT 0
);
"#;

// Seeds sensible defaults. Rates marked (placeholder) must be confirmed by Rob.
const SEED: &str = r#"
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('villa_name',          'Freedom Villa'),
  ('villa_tagline',       'A private luxury villa in Petitenget, Seminyak'),
  ('villa_address',       'Petitenget, Seminyak, Bali, Indonesia'),
  ('villa_owner',         'Robert Addamo'),
  ('villa_max_guests',    '10'),
  ('villa_email',         ''),
  ('villa_phone',         ''),
  ('villa_website',       'freedomvillabali.com'),
  ('villa_checkin_time',  '2:00 PM'),
  ('villa_checkout_time', '11:00 AM'),
  ('deposit_pct',         '50'),
  ('quote_valid_days',    '7'),
  ('invoice_due_days',    '7'),
  ('inclusions',          'All-inclusive of taxes, service and full staff.\nDaily breakfast, full housekeeping, private pool, and 24-hour villa support.'),
  ('base_currency',       'AUD'),
  ('default_currency',    'AUD');

INSERT OR IGNORE INTO fx_rates (code, name, rate_per_aud, sort_order) VALUES
  ('USD', 'US Dollar',         0.66,    1),
  ('IDR', 'Indonesian Rupiah', 10500.0, 2),
  ('EUR', 'Euro',              0.61,    3),
  ('GBP', 'British Pound',     0.52,    4),
  ('SGD', 'Singapore Dollar',  0.88,    5),
  ('THB', 'Thai Baht',         23.5,    6);

-- Seasons in AUD/night. Low season (1300) confirmed from Rob's quote.
-- High and Peak rates are placeholders pending Rob's real numbers.
INSERT INTO seasons (name, start_date, end_date, nightly_rate, minimum_nights, sort_order) VALUES
  ('Low',  '2026-01-06', '2026-06-30', 1300, 3, 1),
  ('High', '2026-07-01', '2026-08-31', 1600, 5, 2),
  ('Low',  '2026-09-01', '2026-12-15', 1300, 3, 3),
  ('Peak', '2026-12-16', '2027-01-05', 2000, 7, 4),
  ('Low',  '2027-01-06', '2027-06-30', 1300, 3, 5),
  ('High', '2027-07-01', '2027-08-31', 1600, 5, 6),
  ('Peak', '2027-12-16', '2028-01-05', 2000, 7, 7);
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "create core schema",
      sql: SCHEMA,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "seed default settings, fx rates and seasons",
      sql: SEED,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "add document/arrival settings keys",
      sql: r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES
          ('villa_owner_title', 'Owner · Freedom Villa Bali'),
          ('bank_details', ''),
          ('wifi_name', ''),
          ('wifi_pass', '');
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "guest personalization responses",
      sql: r#"
        CREATE TABLE IF NOT EXISTS personalizations (
          booking_id     INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
          arriving_names TEXT,
          flight_number  TEXT,
          airline        TEXT,
          arrival_date   TEXT,
          arrival_time   TEXT,
          beds_json      TEXT,
          notes          TEXT,
          completed_at   TEXT
        );
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 5,
      description: "payments ledger per booking",
      sql: r#"
        CREATE TABLE IF NOT EXISTS payments (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
          amount     REAL NOT NULL,           -- AUD
          kind       TEXT DEFAULT 'Payment',  -- Deposit | Balance | Other
          method     TEXT,                    -- Bank transfer | Cash | Card ...
          paid_on    TEXT,                    -- ISO date
          note       TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 6,
      description: "per-document editable text overrides",
      sql: r#"
        CREATE TABLE IF NOT EXISTS doc_fields (
          booking_id INTEGER,
          doc_type   TEXT,
          field      TEXT,
          value      TEXT,
          PRIMARY KEY (booking_id, doc_type, field)
        );
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 7,
      description: "per-document pdf/sent status",
      sql: r#"
        CREATE TABLE IF NOT EXISTS doc_status (
          booking_id   INTEGER,
          doc_type     TEXT,
          pdf_saved_at TEXT,
          sent_at      TEXT,
          sent_via     TEXT,
          PRIMARY KEY (booking_id, doc_type)
        );
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 8,
      description: "set Rob's real villa details",
      sql: r#"
        UPDATE settings SET value = '3:00 PM' WHERE key = 'villa_checkin_time';
        UPDATE settings SET value = '11:00 AM' WHERE key = 'villa_checkout_time';
        UPDATE settings SET value = 'Villa Owner and Booking Co-ordinator' WHERE key = 'villa_owner_title';
        UPDATE settings SET value = 'freedomvillabali.com' WHERE key = 'villa_website';
        UPDATE settings SET value = '+62 812 384 88685' WHERE key = 'villa_phone' AND (value IS NULL OR value = '');
        UPDATE settings SET value = 'robert@freedomvillabali.com' WHERE key = 'villa_email' AND (value IS NULL OR value = '');
        UPDATE settings SET value = '5 expansive bedroom suites (3 can split to singles)
1,000m² of beautifully manicured grounds
Private onsite commercial-grade gym
Daily chef-prepared breakfasts
Complimentary airport transfers
Full staff: butlers, security, villa manager, ground crew' WHERE key = 'inclusions';
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 9,
      description: "wave A: booking source, agent rate, tax settings",
      sql: r#"
        ALTER TABLE bookings ADD COLUMN source TEXT DEFAULT 'Direct (website)';
        ALTER TABLE bookings ADD COLUMN apply_tax INTEGER;
        ALTER TABLE seasons ADD COLUMN agent_rate REAL;
        INSERT OR IGNORE INTO settings (key, value) VALUES
          ('tax_mode', 'inclusive'),
          ('tax_rate', '16'),
          ('tax_show', 'total'),
          ('tax_allow_override', '0');
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 10,
      description: "wave B: follow-up scheduler",
      sql: r#"
        CREATE TABLE IF NOT EXISTS follow_ups (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
          due_date   TEXT,
          note       TEXT,
          done       INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      "#,
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:freedom-villa.db", migrations)
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
