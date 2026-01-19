<?php
/**
 * OpenAI Proxy for VD Visual Editor
 * Handles secure API calls to OpenAI from the frontend
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'Method not allowed'
    ]);
    exit();
}

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'Invalid JSON input'
    ]);
    exit();
}

// Validate inputs
$systemPrompt = isset($input['systemPrompt']) ? trim($input['systemPrompt']) : '';
$userMessage = isset($input['userMessage']) ? trim($input['userMessage']) : '';

if (empty($systemPrompt) || empty($userMessage)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'System prompt and user message are required'
    ]);
    exit();
}

// Validate input lengths
if (strlen($systemPrompt) > 8000) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'System prompt too long (max 8000 characters)'
    ]);
    exit();
}

if (strlen($userMessage) > 2000) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'User message too long (max 2000 characters)'
    ]);
    exit();
}

// Get API key from Authorization header
$apiKey = null;
$authHeader = null;

$headers = function_exists('getallheaders') ? getallheaders() : [];
if (is_array($headers)) {
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'authorization') {
            $authHeader = $v;
            break;
        }
    }
}

// Fallbacks for environments where getallheaders() doesn't include Authorization
if (empty($authHeader)) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
}

if (!empty($authHeader) && preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
    $apiKey = trim($matches[1]);
}

if (empty($apiKey)) {
    $headerKeys = is_array($headers) ? implode(', ', array_keys($headers)) : 'none';
    $serverAuthPresent = implode(', ', array_filter([
        isset($_SERVER['HTTP_AUTHORIZATION']) ? 'HTTP_AUTHORIZATION' : null,
        isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? 'REDIRECT_HTTP_AUTHORIZATION' : null
    ]));

    error_log('openai_proxy: missing/invalid Authorization header. headers=[' . $headerKeys . '], serverAuthKeys=[' . $serverAuthPresent . ']');

    http_response_code(401);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'API key not found. Please save Settings first'
    ]);
    exit();
}

// Get settings
$model = isset($input['model']) ? $input['model'] : 'gpt-4o-mini';
$maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 2000;
$temperature = isset($input['temperature']) ? floatval($input['temperature']) : 0.7;

// Validate settings
$allowedModels = ['gpt-4o-mini', 'gpt-4', 'gpt-4-turbo'];
if (!in_array($model, $allowedModels)) {
    $model = 'gpt-4o-mini';
}

if ($maxTokens < 100 || $maxTokens > 4000) {
    $maxTokens = 2000;
}

if ($temperature < 0 || $temperature > 2) {
    $temperature = 0.7;
}

// Prepare OpenAI API request
$openaiData = [
    'model' => $model,
    'messages' => [
        [
            'role' => 'system',
            'content' => $systemPrompt
        ],
        [
            'role' => 'user',
            'content' => $userMessage
        ]
    ],
    'max_tokens' => $maxTokens,
    'temperature' => $temperature
];

// Make request to OpenAI API
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.openai.com/v1/chat/completions',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($openaiData),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_TIMEOUT => 60,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'data' => null,
        'error' => 'Network error: ' . $error
    ]);
    exit();
}

// Handle different HTTP status codes
switch ($httpCode) {
    case 200:
        $openaiResponse = json_decode($response, true);
        
        if (!$openaiResponse || !isset($openaiResponse['choices'][0]['message']['content'])) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'data' => null,
                'error' => 'Invalid response from OpenAI API'
            ]);
            exit();
        }
        
        $content = $openaiResponse['choices'][0]['message']['content'];
        
        echo json_encode([
            'success' => true,
            'data' => [
                'response' => $content
            ],
            'error' => null
        ]);
        break;
        
    case 401:
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'data' => null,
            'error' => 'Invalid API key. Please check Settings'
        ]);
        break;
        
    case 429:
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'data' => null,
            'error' => 'Rate limit exceeded. Please wait a moment and try again.'
        ]);
        break;
        
    case 500:
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'data' => null,
            'error' => 'OpenAI API is temporarily unavailable. Please try again later.'
        ]);
        break;
        
    default:
        http_response_code($httpCode);
        $errorMessage = 'OpenAI API error (HTTP ' . $httpCode . ')';
        
        // Try to extract error message from OpenAI response
        $openaiError = json_decode($response, true);
        if ($openaiError && isset($openaiError['error']['message'])) {
            $errorMessage = $openaiError['error']['message'];
        }
        
        echo json_encode([
            'success' => false,
            'data' => null,
            'error' => $errorMessage
        ]);
        break;
}
?>