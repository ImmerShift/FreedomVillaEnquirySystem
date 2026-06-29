<?php
// Copy this file to `config.php` on the server and fill in real values.
// config.php is git-ignored so credentials never get committed.

return [
  // cPanel MySQL database (create it + a user in cPanel → MySQL Databases)
  'db_host' => 'localhost',
  'db_name' => 'freedomvilla',     // usually prefixed, e.g. cpaneluser_freedomvilla
  'db_user' => 'freedomvilla_user',
  'db_pass' => 'CHANGE_ME',

  // Single-user login (Rob). Generate a hash once with:
  //   php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
  'password_hash' => '$2y$10$REPLACE_WITH_A_REAL_BCRYPT_HASH',

  // Random secret for signing session tokens. Generate once with:
  //   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
  'token_secret' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',

  // Token lifetime in seconds (default 30 days).
  'token_ttl' => 60 * 60 * 24 * 30,

  // Allowed browser origin for CORS. The PWA's URL in production, e.g.
  // 'https://inquiry.freedomvillabali.com'. Use '*' only for local testing.
  'cors_origin' => '*',
];
