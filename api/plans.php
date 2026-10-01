<?php
/**
 * Eyezonkid – public pricing endpoint:  GET /api/plans
 *
 * The browser calls THIS file (same domain). This file calls the real
 * Eyezonkid API server-side with the secret token, so the API URL and the
 * token never reach the visitor's browser.
 *
 * Secrets live in an env file that is NOT inside public_html:
 *     /home/<cpanel-user>/.eyezonkid.env
 * (fallback for local testing: eyezonkid.com/.env – blocked by .htaccess)
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

/* ---------- 1. load env ---------- */
function ezk_env(): array {
    $candidates = [
        dirname(__DIR__, 3) . '/.eyezonkid.env',   // /home/<user>/.eyezonkid.env  (production)
        dirname(__DIR__) . '/.env',                 // eyezonkid.com/.env           (local dev)
    ];
    foreach ($candidates as $file) {
        if (is_readable($file)) {
            $vars = [];
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
                [$k, $v] = array_map('trim', explode('=', $line, 2));
                $vars[$k] = trim($v, "\"'");
            }
            return $vars;
        }
    }
    return [];
}
$env   = ezk_env();
$base  = rtrim($env['EZK_API_BASE'] ?? '', '/');
$token = $env['EZK_API_TOKEN'] ?? '';
$ttl   = (int)($env['EZK_PLANS_CACHE_SECONDS'] ?? 600);

/* ---------- 2. small file cache (outside the web root when possible) ---------- */
$cacheDir  = is_writable(dirname(__DIR__, 3)) ? dirname(__DIR__, 3) . '/.ezk-cache' : sys_get_temp_dir();
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0700, true);
$cacheFile = $cacheDir . '/plans.json';

function ezk_out(array $plans, string $source): void {
    echo json_encode(['success' => true, 'source' => $source, 'plans' => $plans], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (is_readable($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
    ezk_out(json_decode(file_get_contents($cacheFile), true) ?: [], 'cache');
}

/* ---------- 3. call the real API ---------- */
$plans = null;
if ($base !== '' && $token !== '' && function_exists('curl_init')) {
    $ch = curl_init($base . '/plan/v1/plans');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-APIGATEWAY-Authorization: Bearer ' . $token,
        ],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = ($body !== false && $code === 200) ? json_decode($body, true) : null;
    if (is_array($json) && !empty($json['success']) && isset($json['data']['plans']) && is_array($json['data']['plans'])) {
        // pass on only the public fields the website needs
        $plans = array_map(function ($p) {
            return [
                'code'                    => (string)($p['code'] ?? ''),
                'name'                    => (string)($p['name'] ?? ''),
                'description'             => (string)($p['description'] ?? ''),
                'features'                => array_values(array_map('strval', (array)($p['features'] ?? []))),
                'currency'                => (string)($p['currency'] ?? 'INR'),
                'price'                   => (string)($p['price'] ?? ''),
                'additional_device_price' => (string)($p['additional_device_price'] ?? ''),
                'included_devices'        => (int)($p['included_devices'] ?? 1),
                'max_devices'             => (int)($p['max_devices'] ?? 1),
                'interval'                => [
                    'unit'  => (string)($p['interval']['unit'] ?? ''),
                    'count' => (int)($p['interval']['count'] ?? 1),
                ],
                'tax'                     => [
                    'rate'     => (string)($p['tax']['rate'] ?? ''),
                    'included' => (bool)($p['tax']['included'] ?? false),
                ],
                'trial'                   => [
                    'enabled' => (bool)($p['trial']['enabled'] ?? false),
                    'days'    => (int)($p['trial']['days'] ?? 0),
                    'price'   => (string)($p['trial']['price'] ?? '0'),
                    'is_free' => (bool)($p['trial']['is_free'] ?? false),
                ],
            ];
        }, $json['data']['plans']);
        @file_put_contents($cacheFile, json_encode($plans, JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
}

if ($plans !== null) ezk_out($plans, 'live');

/* ---------- 4. API down or not configured: serve last good copy ---------- */
if (is_readable($cacheFile)) {
    ezk_out(json_decode(file_get_contents($cacheFile), true) ?: [], 'stale');
}
http_response_code(503);
echo json_encode(['success' => false, 'message' => 'Plans are unavailable right now']);
