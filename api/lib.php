<?php
// Shared helpers: config loading, PDO connection, JSON I/O, token auth.

function fv_config(): array {
  static $cfg = null;
  if ($cfg === null) {
    $path = __DIR__ . '/config.php';
    if (!file_exists($path)) {
      http_response_code(500);
      header('Content-Type: application/json');
      echo json_encode(['error' => 'Server not configured: copy config.example.php to config.php']);
      exit;
    }
    $cfg = require $path;
  }
  return $cfg;
}

function fv_db(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $c = fv_config();
    $dsn = "mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4";
    try {
      $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
      ]);
    } catch (Throwable $e) {
      fv_send(['error' => 'Database connection failed'], 500);
    }
  }
  return $pdo;
}

function fv_send($data, int $code = 200): void {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

function fv_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === '' || $raw === false) return [];
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

// ---- token auth (stateless HMAC; no server-side session store needed) ----

function fv_make_token(): string {
  $c = fv_config();
  $exp = time() + (int) $c['token_ttl'];
  $payload = base64_encode(json_encode(['exp' => $exp]));
  $sig = hash_hmac('sha256', $payload, $c['token_secret']);
  return $payload . '.' . $sig;
}

function fv_valid_token(?string $token): bool {
  if (!$token) return false;
  $c = fv_config();
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) return false;
  [$payload, $sig] = $parts;
  $expected = hash_hmac('sha256', $payload, $c['token_secret']);
  if (!hash_equals($expected, $sig)) return false;
  $data = json_decode(base64_decode($payload), true);
  return is_array($data) && isset($data['exp']) && $data['exp'] > time();
}

function fv_require_auth(): void {
  $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!$hdr && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
      if (strcasecmp($k, 'Authorization') === 0) { $hdr = $v; break; }
    }
  }
  $token = null;
  if (stripos($hdr, 'Bearer ') === 0) $token = substr($hdr, 7);
  if (!fv_valid_token($token)) fv_send(['error' => 'Unauthorized'], 401);
}

// Casts the listed columns of each row to float (PDO/MySQL return DECIMAL as strings,
// but the React app does arithmetic on these and needs real numbers).
function fv_numify(array $rows, array $cols): array {
  foreach ($rows as &$r) {
    foreach ($cols as $col) {
      if (array_key_exists($col, $r) && $r[$col] !== null) $r[$col] = (float) $r[$col];
    }
  }
  return $rows;
}
