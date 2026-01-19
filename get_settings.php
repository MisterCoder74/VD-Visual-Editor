<?php
/**
 * Get Settings Endpoint
 * Retrieves settings from settings.json
 */

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$settingsFile = __DIR__ . '/settings.json';

try {
    if (!file_exists($settingsFile)) {
        $defaultSettings = [
            'model' => 'gpt-4o-mini',
            'maxTokens' => 2000,
            'temperature' => 0.7,
            'systemPrompt' => ''
        ];
        echo json_encode([
            'success' => true,
            'data' => $defaultSettings,
            'error' => null
        ]);
        exit;
    }

    $content = file_get_contents($settingsFile);
    if ($content === false) {
        throw new Exception('Failed to read settings file');
    }

    $settings = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON in settings file: ' . json_last_error_msg());
    }

    $data = [
        'model' => $settings['model'] ?? 'gpt-4o-mini',
        'maxTokens' => $settings['maxTokens'] ?? 2000,
        'temperature' => $settings['temperature'] ?? 0.7,
        'systemPrompt' => $settings['systemPrompt'] ?? ''
    ];

    echo json_encode([
        'success' => true,
        'data' => $data,
        'error' => null
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => $e->getMessage()
    ]);
}
