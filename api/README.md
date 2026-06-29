# Freedom Villa — PHP/MySQL API

Vanilla PHP (PDO) REST API for the Freedom Villa PWA. Designed to run on shared
cPanel hosting with no Composer, frameworks, or build step. All money is stored
in AUD; currency conversion and print-to-PDF happen in the browser.

## What's here

| File | Purpose |
|------|---------|
| `schema.sql` | MySQL schema + seed (port of the SQLite migrations v1–v11). Import once. |
| `config.example.php` | Template for DB creds + login password + token secret. Copy to `config.php`. |
| `lib.php` | Config, PDO connection, JSON I/O, HMAC token auth helpers. |
| `index.php` | Front controller — all endpoints. |
| `.htaccess` | Routes everything to `index.php`; preserves the `Authorization` header. |

`config.php` is git-ignored — it holds secrets and only ever lives on the server.

## Deploy (when Rob provides cPanel access)

1. **Create the database** in cPanel → *MySQL Databases*: a DB + a user, add the
   user to the DB with all privileges.
2. **Import the schema**: cPanel → *phpMyAdmin* → select the DB → *Import* →
   upload `schema.sql`.
3. **Configure**: copy `config.example.php` to `config.php` and fill in the DB
   credentials. Generate the two secrets locally:
   ```sh
   php -r "echo password_hash('rob-chooses-this', PASSWORD_DEFAULT), PHP_EOL;"   # -> password_hash
   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"                              # -> token_secret
   ```
   Set `cors_origin` to the PWA's URL (e.g. `https://inquiry.freedomvillabali.com`).
4. **Upload** the `api/` folder to the subdomain/subfolder that will serve the API.
5. **Smoke-test**:
   ```sh
   curl -X POST https://HOST/api/auth/login -d '{"password":"rob-chooses-this"}'
   # -> {"token":"..."}   then pass it as:  Authorization: Bearer <token>
   curl https://HOST/api/settings -H "Authorization: Bearer <token>"
   ```

## Endpoints (all JSON; all except login require `Authorization: Bearer <token>`)

- `POST /auth/login` `{password}` → `{token}`
- `GET /settings` · `PUT /settings` `{key:value,…}`
- `GET /seasons` · `POST /seasons` · `PATCH /seasons/{id}` · `DELETE /seasons/{id}`
- `GET /fx-rates` · `PATCH /fx-rates/{code}` `{rate_per_aud}`
- `GET /guest-stays` · `GET /due-followups` · `GET /returning-guest?email=`
- `POST /inquiries` `{guest,booking,charges}` → `{booking_id}` (transactional)
- `GET /bookings/{id}` · `GET /bookings/latest` → `{booking,guest,charges}` · `PATCH /bookings/{id}`
- `GET /payments?booking_id=` · `POST /payments` · `DELETE /payments/{id}?booking_id=`
- `GET /followups?booking_id=` · `POST /followups` · `PATCH /followups/{id}` · `DELETE /followups/{id}`
- `GET /holds` · `POST /holds` · `PATCH /holds/{id}` · `POST /holds/auto-release`
- `GET /personalizations/{booking_id}` · `PUT /personalizations/{booking_id}`
- `GET /doc-fields?booking_id=&doc_type=` · `PUT /doc-fields`
- `GET /doc-status?booking_id=&doc_type=` · `POST /doc-status/pdf` · `POST /doc-status/sent`
- `GET /export` (full backup snapshot)

## Local testing

PHP's built-in server can host the API against a local MySQL/MariaDB:
```sh
cd api && php -S localhost:8787
```
(`php -S` has no `.htaccess`/rewrite, but `index.php` parses the path itself, so
`http://localhost:8787/index.php/settings` works — or front it with Apache.)
