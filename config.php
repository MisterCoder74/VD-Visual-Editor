<?php
/**
 * VD-Visual-Editor Configuration
 */

// Define root paths
define('ROOT_PATH', __DIR__);

// Session settings
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Default values
$config = [
    'max_file_size' => 5242880, // 5MB
    'allowed_element_types' => [
        'div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'u', 'code', 'pre', 'blockquote', 'hr',
        'img', 'video', 'audio', 'iframe',
        'form', 'input', 'button', 'textarea', 'select', 'label', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
        'a', 'br'
    ],
    'undo_limit' => 20
];
