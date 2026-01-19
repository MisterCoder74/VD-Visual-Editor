<?php
/**
 * Save Settings Endpoint
 * Persists model/maxTokens/temperature/systemPrompt to settings.json
 * API key is intentionally not stored server-side.
 */

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'Method not allowed'
    ]);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'Invalid request body'
    ]);
    exit;
}

$payload = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'Invalid JSON payload'
    ]);
    exit;
}

$allowedModels = ['gpt-4o-mini', 'gpt-4', 'gpt-4-turbo'];

$model = $payload['model'] ?? null;
$maxTokens = $payload['maxTokens'] ?? null;
$temperature = $payload['temperature'] ?? null;
$systemPrompt = $payload['systemPrompt'] ?? null;

$errors = [];

if (!is_string($model) || !in_array($model, $allowedModels, true)) {
    $errors['model'] = 'Model must be one of: ' . implode(', ', $allowedModels);
}

$maxTokensInt = filter_var($maxTokens, FILTER_VALIDATE_INT);
if ($maxTokensInt === false || $maxTokensInt < 100 || $maxTokensInt > 4000) {
    $errors['maxTokens'] = 'Max Tokens must be an integer between 100 and 4000';
}

if (!is_numeric($temperature)) {
    $errors['temperature'] = 'Temperature must be a number between 0 and 2';
} else {
    $tempFloat = (float)$temperature;
    if ($tempFloat < 0 || $tempFloat > 2) {
        $errors['temperature'] = 'Temperature must be between 0 and 2';
    }
}

if (!is_string($systemPrompt)) {
    $errors['systemPrompt'] = 'System Prompt must be a string';
} else if (strlen($systemPrompt) > 5000) {
    $errors['systemPrompt'] = 'System Prompt must be at most 5000 characters';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => ['validation' => $errors],
        'error' => 'Validation failed'
    ]);
    exit;
}

$settingsFile = __DIR__ . '/settings.json';

$defaults = [
    'model' => 'gpt-4o-mini',
    'maxTokens' => 2000,
    'temperature' => 0.7,
    'systemPrompt' => ''
];

$fh = null;
$locked = false;

try {
    $fh = fopen($settingsFile, 'c+');
    if ($fh === false) {
        throw new Exception('Settings file not writable');
    }

    $start = microtime(true);
    while (!( $locked = flock($fh, LOCK_EX | LOCK_NB) )) {
        if ((microtime(true) - $start) >= 3.0) {
            throw new Exception('Could not acquire settings lock (timeout)');
        }
        usleep(50000); // 50ms
    }

    rewind($fh);
    $existingRaw = stream_get_contents($fh);
    $existing = [];
    if ($existingRaw !== false && trim($existingRaw) !== '') {
        $decoded = json_decode($existingRaw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $existing = $decoded;
        }
    }

    $updated = array_merge($defaults, $existing, [
        'model' => $model,
        'maxTokens' => $maxTokensInt,
        'temperature' => (float)$temperature,
        'systemPrompt' => $systemPrompt
    ]);

    if (isset($updated['apiKey'])) {
        unset($updated['apiKey']);
    }

    $json = json_encode($updated, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new Exception('Failed to encode settings JSON');
    }

    ftruncate($fh, 0);
    rewind($fh);
    $written = fwrite($fh, $json);
    if ($written === false) {
        throw new Exception('Failed to write settings file');
    }

    fflush($fh);

    echo json_encode([
        'success' => true,
        'data' => [
            'model' => $updated['model'],
            'maxTokens' => $updated['maxTokens'],
            'temperature' => $updated['temperature'],
            'systemPrompt' => $updated['systemPrompt']
        ],
        'error' => null
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => $e->getMessage()
    ]);
} finally {
    if (is_resource($fh)) {
        if ($locked) {
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
}
