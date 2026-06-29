<?php
// Freedom Villa REST API — single front controller for shared cPanel hosting.
// Mirrors the data-access surface of the React app's db.ts. All money is AUD.

require __DIR__ . '/lib.php';

// ---- CORS ----
$cfg = fv_config();
header('Access-Control-Allow-Origin: ' . $cfg['cors_origin']);
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }

// ---- routing ----
$uri  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
if ($base !== '' && strpos($uri, $base) === 0) $uri = substr($uri, strlen($base));
$path = trim($uri, '/');
$seg  = $path === '' ? [] : explode('/', $path);
$method = $_SERVER['REQUEST_METHOD'];
$r0 = $seg[0] ?? '';
$r1 = $seg[1] ?? null;

// numeric-column maps (DECIMAL comes back as string from PDO; the app needs numbers)
$BOOKING_NUM = ['override_rate','applied_rate','direct_saving','accommodation_total',
  'additional_total','grand_total','deposit','amount_paid','balance','num_guests'];

// ---- public: login ----
if ($r0 === 'auth' && $r1 === 'login' && $method === 'POST') {
  $body = fv_body();
  $ok = isset($body['password']) && password_verify($body['password'], $cfg['password_hash']);
  if (!$ok) fv_send(['error' => 'Invalid password'], 401);
  fv_send(['token' => fv_make_token()]);
}

// Everything below requires a valid token.
fv_require_auth();
$db = fv_db();
$body = in_array($method, ['POST','PUT','PATCH'], true) ? fv_body() : [];

try {
  switch ($r0) {

    // ---- settings ----
    case 'settings': {
      if ($method === 'GET') {
        $rows = $db->query("SELECT `key`, `value` FROM settings")->fetchAll();
        $out = [];
        foreach ($rows as $row) $out[$row['key']] = $row['value'];
        fv_send($out);
      }
      if ($method === 'PUT') {
        $stmt = $db->prepare("INSERT INTO settings (`key`,`value`) VALUES (?,?)
                              ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
        foreach ($body as $k => $v) $stmt->execute([$k, (string) $v]);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- seasons ----
    case 'seasons': {
      if ($method === 'GET') {
        $rows = $db->query("SELECT * FROM seasons ORDER BY sort_order, start_date")->fetchAll();
        fv_send(fv_numify($rows, ['nightly_rate','agent_rate','rack_rate','minimum_nights','sort_order','id']));
      }
      if ($method === 'POST') {
        $db->exec("INSERT INTO seasons (name,start_date,end_date,nightly_rate,minimum_nights,sort_order)
                   VALUES ('Low','','',1300,3,(SELECT COALESCE(MAX(sort_order),0)+1 FROM (SELECT * FROM seasons) s))");
        $id = (int) $db->lastInsertId();
        $row = $db->query("SELECT * FROM seasons WHERE id = $id")->fetch();
        fv_send(fv_numify([$row], ['nightly_rate','agent_rate','rack_rate','minimum_nights','sort_order','id'])[0]);
      }
      if ($method === 'PATCH' && $r1) {
        $allowed = ['name','start_date','end_date','nightly_rate','agent_rate','rack_rate','minimum_nights'];
        foreach ($body as $f => $v) {
          if (!in_array($f, $allowed, true)) continue;
          $stmt = $db->prepare("UPDATE seasons SET `$f` = ? WHERE id = ?");
          $stmt->execute([$v === '' ? null : $v, (int) $r1]);
        }
        fv_send(['ok' => true]);
      }
      if ($method === 'DELETE' && $r1) {
        $db->prepare("DELETE FROM seasons WHERE id = ?")->execute([(int) $r1]);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- fx rates ----
    case 'fx-rates': {
      if ($method === 'GET') {
        $rows = $db->query("SELECT * FROM fx_rates ORDER BY sort_order")->fetchAll();
        fv_send(fv_numify($rows, ['rate_per_aud','sort_order']));
      }
      if ($method === 'PATCH' && $r1) {
        $stmt = $db->prepare("UPDATE fx_rates SET rate_per_aud = ? WHERE code = ?");
        $stmt->execute([(float) ($body['rate_per_aud'] ?? 0), $r1]);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- guest stays (pipeline list) ----
    case 'guest-stays': {
      $rows = $db->query("
        SELECT b.id, COALESCE(g.full_name,'—') AS guest_name, g.email, g.country,
               b.check_in, b.check_out, b.num_guests, b.grand_total, b.amount_paid,
               b.currency, COALESCE(b.source,'Direct (website)') AS source,
               b.status, b.quote_status, b.invoice_status, b.personalize_status,
               qs.sent_at AS quote_sent_at,
               (SELECT COUNT(*) FROM follow_ups f
                  WHERE f.booking_id = b.id AND f.done = 0 AND f.due_date <= CURDATE()) AS followups_due
        FROM bookings b
        LEFT JOIN guests g ON g.id = b.guest_id
        LEFT JOIN doc_status qs ON qs.booking_id = b.id AND qs.doc_type = 'quotation'
        ORDER BY b.check_in DESC, b.id DESC
      ")->fetchAll();
      fv_send(fv_numify($rows, ['grand_total','amount_paid','num_guests','followups_due']));
    }

    // ---- dashboard: due follow-ups ----
    case 'due-followups': {
      $rows = $db->query("
        SELECT f.id, f.booking_id, COALESCE(g.full_name,'—') AS guest_name, f.due_date, f.note
        FROM follow_ups f
        JOIN bookings b ON b.id = f.booking_id
        LEFT JOIN guests g ON g.id = b.guest_id
        WHERE f.done = 0 AND f.due_date <= CURDATE() AND b.status <> 'Cancelled'
        ORDER BY f.due_date, f.id
      ")->fetchAll();
      fv_send($rows);
    }

    // ---- returning guest lookup ----
    case 'returning-guest': {
      $email = trim($_GET['email'] ?? '');
      if ($email === '') fv_send(null);
      $stmt = $db->prepare("
        SELECT g.full_name, b.check_in, b.check_out
        FROM bookings b JOIN guests g ON g.id = b.guest_id
        WHERE LOWER(g.email) = LOWER(?) AND b.status <> 'Cancelled'
        ORDER BY b.check_in DESC LIMIT 1");
      $stmt->execute([$email]);
      fv_send($stmt->fetch() ?: null);
    }

    // ---- inquiries: guest + booking + charges + optional deposit (transactional) ----
    case 'inquiries': {
      if ($method !== 'POST') break;
      $g = $body['guest'] ?? [];
      $b = $body['booking'] ?? [];
      $charges = $body['charges'] ?? [];
      $db->beginTransaction();
      $gs = $db->prepare("INSERT INTO guests (full_name,country,email,whatsapp) VALUES (?,?,?,?)");
      $gs->execute([$g['full_name'] ?? '', $g['country'] ?? '', $g['email'] ?? '', $g['whatsapp'] ?? '']);
      $guestId = (int) $db->lastInsertId();
      $bs = $db->prepare("INSERT INTO bookings
        (guest_id,check_in,check_out,num_guests,inquiry_date,currency,source,apply_tax,override_rate,
         applied_rate,rate_source,direct_saving,accommodation_total,additional_total,grand_total,
         deposit,amount_paid,balance,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
      $bs->execute([
        $guestId, $b['check_in'] ?? null, $b['check_out'] ?? null, $b['num_guests'] ?? 0,
        $b['inquiry_date'] ?? null, $b['currency'] ?? 'AUD', $b['source'] ?? 'Direct (website)',
        $b['apply_tax'] ?? null, $b['override_rate'] ?? null, $b['applied_rate'] ?? 0,
        $b['rate_source'] ?? null, $b['direct_saving'] ?? 0, $b['accommodation_total'] ?? 0,
        $b['additional_total'] ?? 0, $b['grand_total'] ?? 0, $b['deposit'] ?? 0,
        $b['amount_paid'] ?? 0, $b['balance'] ?? 0, $b['notes'] ?? null,
      ]);
      $bookingId = (int) $db->lastInsertId();
      $cs = $db->prepare("INSERT INTO charges (booking_id,description,qty,unit_price,sort_order) VALUES (?,?,?,?,?)");
      $i = 0;
      foreach ($charges as $c) {
        if (empty($c['desc']) && empty($c['unit'])) { $i++; continue; }
        $cs->execute([$bookingId, $c['desc'] ?? '', $c['qty'] ?? 1, $c['unit'] ?? 0, $i++]);
      }
      if (!empty($b['amount_paid']) && $b['amount_paid'] > 0) {
        $ps = $db->prepare("INSERT INTO payments (booking_id,amount,kind,method,paid_on,note)
                            VALUES (?,?,'Deposit','',?,'Initial deposit')");
        $ps->execute([$bookingId, $b['amount_paid'], $b['inquiry_date'] ?? null]);
      }
      $db->commit();
      fv_send(['booking_id' => $bookingId]);
    }

    // ---- bookings: hydrate by id or latest ----
    case 'bookings': {
      if ($method === 'GET') {
        if ($r1 === 'latest') {
          $bk = $db->query("SELECT * FROM bookings ORDER BY id DESC LIMIT 1")->fetch();
        } elseif ($r1 !== null) {
          $stmt = $db->prepare("SELECT * FROM bookings WHERE id = ?");
          $stmt->execute([(int) $r1]);
          $bk = $stmt->fetch();
        } else { $bk = null; }
        if (!$bk) fv_send(null);
        $bk = fv_numify([$bk], $BOOKING_NUM)[0];
        $gid = (int) $bk['guest_id'];
        $guest = $db->query("SELECT * FROM guests WHERE id = $gid")->fetch() ?: null;
        $bid = (int) $bk['id'];
        $charges = $db->query("SELECT * FROM charges WHERE booking_id = $bid ORDER BY sort_order, id")->fetchAll();
        $charges = fv_numify($charges, ['qty','unit_price','sort_order']);
        fv_send(['booking' => $bk, 'guest' => $guest, 'charges' => $charges]);
      }
      if ($method === 'PATCH' && $r1) {
        $allowed = ['status','quote_status','invoice_status','personalize_status'];
        foreach ($body as $f => $v) {
          if (!in_array($f, $allowed, true)) continue;
          $stmt = $db->prepare("UPDATE bookings SET `$f` = ? WHERE id = ?");
          $stmt->execute([$v, (int) $r1]);
        }
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- payments ----
    case 'payments': {
      if ($method === 'GET') {
        $bid = (int) ($_GET['booking_id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM payments WHERE booking_id = ? ORDER BY paid_on, id");
        $stmt->execute([$bid]);
        fv_send(fv_numify($stmt->fetchAll(), ['amount']));
      }
      if ($method === 'POST') {
        $stmt = $db->prepare("INSERT INTO payments (booking_id,amount,kind,method,paid_on,note) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$body['booking_id'], $body['amount'], $body['kind'] ?? 'Payment',
          $body['method'] ?? '', $body['paid_on'] ?? null, $body['note'] ?? '']);
        fv_recompute_paid($db, (int) $body['booking_id']);
        fv_send(['ok' => true]);
      }
      if ($method === 'DELETE' && $r1) {
        $bid = (int) ($_GET['booking_id'] ?? 0);
        $db->prepare("DELETE FROM payments WHERE id = ?")->execute([(int) $r1]);
        if ($bid) fv_recompute_paid($db, $bid);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- follow-ups ----
    case 'followups': {
      if ($method === 'GET') {
        $bid = (int) ($_GET['booking_id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM follow_ups WHERE booking_id = ? ORDER BY done, due_date, id");
        $stmt->execute([$bid]);
        fv_send($stmt->fetchAll());
      }
      if ($method === 'POST') {
        $stmt = $db->prepare("INSERT INTO follow_ups (booking_id,due_date,note) VALUES (?,?,?)");
        $stmt->execute([$body['booking_id'], $body['due_date'] ?? null, $body['note'] ?? '']);
        fv_send(['ok' => true]);
      }
      if ($method === 'PATCH' && $r1) {
        $stmt = $db->prepare("UPDATE follow_ups SET done = ? WHERE id = ?");
        $stmt->execute([!empty($body['done']) ? 1 : 0, (int) $r1]);
        fv_send(['ok' => true]);
      }
      if ($method === 'DELETE' && $r1) {
        $db->prepare("DELETE FROM follow_ups WHERE id = ?")->execute([(int) $r1]);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- holds ----
    case 'holds': {
      if ($method === 'POST' && $r1 === 'auto-release') {
        $db->exec("UPDATE holds SET released = 1
                   WHERE released = 0 AND expires_on IS NOT NULL AND expires_on < CURDATE()");
        fv_send(['ok' => true]);
      }
      if ($method === 'GET') {
        $rows = $db->query("SELECT * FROM holds WHERE released = 0 ORDER BY check_in, id")->fetchAll();
        fv_send(fv_numify($rows, ['released']));
      }
      if ($method === 'POST') {
        $stmt = $db->prepare("INSERT INTO holds (guest_name,check_in,check_out,expires_on,note) VALUES (?,?,?,?,?)");
        $stmt->execute([$body['guest_name'] ?: null, $body['check_in'], $body['check_out'],
          ($body['expires_on'] ?? '') ?: null, $body['note'] ?? null]);
        fv_send(['ok' => true]);
      }
      if ($method === 'PATCH' && $r1) {
        $stmt = $db->prepare("UPDATE holds SET released = ? WHERE id = ?");
        $stmt->execute([!empty($body['released']) ? 1 : 0, (int) $r1]);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- personalizations (one per booking) ----
    case 'personalizations': {
      $bid = (int) ($r1 ?? 0);
      if ($method === 'GET') {
        $stmt = $db->prepare("SELECT * FROM personalizations WHERE booking_id = ?");
        $stmt->execute([$bid]);
        fv_send($stmt->fetch() ?: null);
      }
      if ($method === 'PUT') {
        $stmt = $db->prepare("INSERT INTO personalizations
          (booking_id,arriving_names,flight_number,airline,arrival_date,arrival_time,beds_json,notes,completed_at)
          VALUES (?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE arriving_names=VALUES(arriving_names),flight_number=VALUES(flight_number),
            airline=VALUES(airline),arrival_date=VALUES(arrival_date),arrival_time=VALUES(arrival_time),
            beds_json=VALUES(beds_json),notes=VALUES(notes),completed_at=VALUES(completed_at)");
        $stmt->execute([$bid, $body['arriving_names'] ?? null, $body['flight_number'] ?? null,
          $body['airline'] ?? null, $body['arrival_date'] ?? null, $body['arrival_time'] ?? null,
          $body['beds_json'] ?? null, $body['notes'] ?? null, $body['completed_at'] ?? null]);
        $db->prepare("UPDATE bookings SET personalize_status = ? WHERE id = ?")
           ->execute([!empty($body['completed_at']) ? 'Received' : 'Pending', $bid]);
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- doc fields ----
    case 'doc-fields': {
      if ($method === 'GET') {
        $stmt = $db->prepare("SELECT field, value FROM doc_fields WHERE booking_id = ? AND doc_type = ?");
        $stmt->execute([(int) ($_GET['booking_id'] ?? 0), $_GET['doc_type'] ?? '']);
        $out = [];
        foreach ($stmt->fetchAll() as $row) $out[$row['field']] = $row['value'];
        fv_send($out);
      }
      if ($method === 'PUT') {
        $stmt = $db->prepare("INSERT INTO doc_fields (booking_id,doc_type,field,value) VALUES (?,?,?,?)
                              ON DUPLICATE KEY UPDATE value = VALUES(value)");
        foreach (($body['fields'] ?? []) as $f => $v) {
          $stmt->execute([$body['booking_id'], $body['doc_type'], $f, $v]);
        }
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- doc status ----
    case 'doc-status': {
      if ($method === 'GET') {
        $stmt = $db->prepare("SELECT * FROM doc_status WHERE booking_id = ? AND doc_type = ?");
        $stmt->execute([(int) ($_GET['booking_id'] ?? 0), $_GET['doc_type'] ?? '']);
        fv_send($stmt->fetch() ?: null);
      }
      if ($method === 'POST' && $r1 === 'pdf') {
        $stmt = $db->prepare("INSERT INTO doc_status (booking_id,doc_type,pdf_saved_at) VALUES (?,?,NOW())
                              ON DUPLICATE KEY UPDATE pdf_saved_at = NOW()");
        $stmt->execute([$body['booking_id'], $body['doc_type']]);
        fv_send(['ok' => true]);
      }
      if ($method === 'POST' && $r1 === 'sent') {
        $stmt = $db->prepare("INSERT INTO doc_status (booking_id,doc_type,sent_at,sent_via) VALUES (?,?,NOW(),?)
                              ON DUPLICATE KEY UPDATE sent_at = NOW(), sent_via = VALUES(sent_via)");
        $stmt->execute([$body['booking_id'], $body['doc_type'], $body['via'] ?? '']);
        if (($body['doc_type'] ?? '') === 'quotation') {
          $db->prepare("UPDATE bookings SET quote_status = 'Sent' WHERE id = ?")->execute([$body['booking_id']]);
        }
        fv_send(['ok' => true]);
      }
      break;
    }

    // ---- full export (backup) ----
    case 'export': {
      $tables = ['settings','seasons','fx_rates','guests','bookings','charges','payments',
        'personalizations','doc_fields','doc_status','follow_ups','holds'];
      $data = [];
      foreach ($tables as $t) $data[$t] = $db->query("SELECT * FROM `$t`")->fetchAll();
      fv_send(['app' => 'Freedom Villa Booking Hub', 'version' => 2,
        'exported_at' => date('c'), 'data' => $data]);
    }
  }

  fv_send(['error' => 'Not found', 'path' => $path, 'method' => $method], 404);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  fv_send(['error' => 'Server error', 'detail' => $e->getMessage()], 500);
}

// Keeps bookings.amount_paid / balance in sync with the payments ledger.
function fv_recompute_paid(PDO $db, int $bookingId): void {
  $stmt = $db->prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE booking_id = ?");
  $stmt->execute([$bookingId]);
  $paid = (float) $stmt->fetchColumn();
  $upd = $db->prepare("UPDATE bookings SET amount_paid = ?, balance = grand_total - ? WHERE id = ?");
  $upd->execute([$paid, $paid, $bookingId]);
}
