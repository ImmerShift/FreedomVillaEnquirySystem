-- Freedom Villa — MySQL schema (port of the SQLite migrations v1–v11, final state).
-- Target: shared cPanel MySQL 5.7+ / MariaDB 10.x. Import once into an empty DB.
-- All money is stored in AUD (the base currency); display conversion is client-side.

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

CREATE TABLE IF NOT EXISTS settings (
  `key`   VARCHAR(64) NOT NULL PRIMARY KEY,
  `value` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seasons (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(40)  NOT NULL,
  start_date     DATE         NOT NULL,
  end_date       DATE         NOT NULL,
  nightly_rate   DECIMAL(12,2) NOT NULL,        -- AUD
  agent_rate     DECIMAL(12,2) NULL,            -- AUD; null = no agent rate
  minimum_nights INT          NOT NULL DEFAULT 1,
  sort_order     INT          DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fx_rates (
  code         VARCHAR(8)  NOT NULL PRIMARY KEY,
  name         VARCHAR(64) NOT NULL,
  rate_per_aud DECIMAL(16,6) NOT NULL,          -- how many units = 1 AUD
  sort_order   INT         DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS guests (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  full_name         VARCHAR(160) NOT NULL,
  country           VARCHAR(80),
  email             VARCHAR(160),
  whatsapp          VARCHAR(60),
  preferences_notes TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  guest_id            INT,
  check_in            DATE,
  check_out           DATE,
  num_guests          INT DEFAULT 2,
  inquiry_date        DATE,
  currency            VARCHAR(8)  DEFAULT 'AUD',
  source              VARCHAR(60) DEFAULT 'Direct (website)',
  apply_tax           TINYINT     NULL,
  override_rate       DECIMAL(12,2) NULL,
  applied_rate        DECIMAL(12,2) DEFAULT 0,
  rate_source         VARCHAR(20),
  direct_saving       DECIMAL(12,2) DEFAULT 0,
  accommodation_total DECIMAL(12,2) DEFAULT 0,
  additional_total    DECIMAL(12,2) DEFAULT 0,
  grand_total         DECIMAL(12,2) DEFAULT 0,
  deposit             DECIMAL(12,2) DEFAULT 0,
  amount_paid         DECIMAL(12,2) DEFAULT 0,
  balance             DECIMAL(12,2) DEFAULT 0,
  notes               TEXT,
  status              VARCHAR(20) DEFAULT 'Inquiry',
  quote_status        VARCHAR(20) DEFAULT 'Draft',
  invoice_status      VARCHAR(20) DEFAULT 'Pending',
  personalize_status  VARCHAR(20) DEFAULT 'Pending',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_guest FOREIGN KEY (guest_id) REFERENCES guests(id),
  INDEX idx_bookings_check_in (check_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS charges (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT,
  description TEXT,
  qty         DECIMAL(12,2) DEFAULT 1,
  unit_price  DECIMAL(12,2) DEFAULT 0,          -- AUD
  sort_order  INT DEFAULT 0,
  CONSTRAINT fk_charges_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  amount     DECIMAL(12,2) NOT NULL,            -- AUD
  kind       VARCHAR(20) DEFAULT 'Payment',
  method     VARCHAR(40),
  paid_on    DATE,
  note       TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS personalizations (
  booking_id     INT PRIMARY KEY,
  arriving_names TEXT,
  flight_number  VARCHAR(40),
  airline        VARCHAR(80),
  arrival_date   DATE,
  arrival_time   VARCHAR(20),
  beds_json      TEXT,
  notes          TEXT,
  completed_at   DATETIME,
  CONSTRAINT fk_personalizations_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doc_fields (
  booking_id INT,
  doc_type   VARCHAR(30),
  field      VARCHAR(60),
  value      TEXT,
  PRIMARY KEY (booking_id, doc_type, field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doc_status (
  booking_id   INT,
  doc_type     VARCHAR(30),
  pdf_saved_at DATETIME,
  sent_at      DATETIME,
  sent_via     VARCHAR(40),
  PRIMARY KEY (booking_id, doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS follow_ups (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  due_date   DATE,
  note       TEXT,
  done       TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_followups_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS holds (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guest_name VARCHAR(160),
  check_in   DATE NOT NULL,
  check_out  DATE NOT NULL,
  expires_on DATE NULL,
  note       TEXT,
  released   TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET foreign_key_checks = 1;

-- ---- seed (final values, incl. Rob's real villa details from migration v8) ----

INSERT IGNORE INTO settings (`key`, `value`) VALUES
  ('villa_name',          'Freedom Villa'),
  ('villa_tagline',       'A private luxury villa in Petitenget, Seminyak'),
  ('villa_address',       'Petitenget, Seminyak, Bali, Indonesia'),
  ('villa_owner',         'Robert Addamo'),
  ('villa_owner_title',   'Villa Owner and Booking Co-ordinator'),
  ('villa_max_guests',    '10'),
  ('villa_email',         'robert@freedomvillabali.com'),
  ('villa_phone',         '+62 812 384 88685'),
  ('villa_website',       'freedomvillabali.com'),
  ('villa_checkin_time',  '3:00 PM'),
  ('villa_checkout_time', '11:00 AM'),
  ('deposit_pct',         '50'),
  ('quote_valid_days',    '7'),
  ('invoice_due_days',    '7'),
  ('buffer_days',         '0'),
  ('bank_details',        ''),
  ('wifi_name',           ''),
  ('wifi_pass',           ''),
  ('base_currency',       'AUD'),
  ('default_currency',    'AUD'),
  ('tax_mode',            'inclusive'),
  ('tax_rate',            '16'),
  ('tax_show',            'total'),
  ('tax_allow_override',  '0'),
  ('inclusions',          '5 expansive bedroom suites (3 can split to singles)\n1,000m² of beautifully manicured grounds\nPrivate onsite commercial-grade gym\nDaily chef-prepared breakfasts\nComplimentary airport transfers\nFull staff: butlers, security, villa manager, ground crew');

INSERT IGNORE INTO fx_rates (code, name, rate_per_aud, sort_order) VALUES
  ('USD', 'US Dollar',         0.66,    1),
  ('IDR', 'Indonesian Rupiah', 10500.0, 2),
  ('EUR', 'Euro',              0.61,    3),
  ('GBP', 'British Pound',     0.52,    4),
  ('SGD', 'Singapore Dollar',  0.88,    5),
  ('THB', 'Thai Baht',         23.5,    6);

INSERT INTO seasons (name, start_date, end_date, nightly_rate, minimum_nights, sort_order) VALUES
  ('Low',  '2026-01-06', '2026-06-30', 1300, 3, 1),
  ('High', '2026-07-01', '2026-08-31', 1600, 5, 2),
  ('Low',  '2026-09-01', '2026-12-15', 1300, 3, 3),
  ('Peak', '2026-12-16', '2027-01-05', 2000, 7, 4),
  ('Low',  '2027-01-06', '2027-06-30', 1300, 3, 5),
  ('High', '2027-07-01', '2027-08-31', 1600, 5, 6),
  ('Peak', '2027-12-16', '2028-01-05', 2000, 7, 7);
