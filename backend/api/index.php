<?php

/**
 * Vercel serverless entry — normalize CGI paths, then boot Laravel.
 *
 * Vercel serves this file as /api/index.php; without rewriting SCRIPT_* and
 * PATH_INFO, Laravel often sees the wrong URI and returns 404 for /api/*.
 */
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = dirname(__DIR__) . '/public/index.php';
$_SERVER['PHP_SELF'] = '/index.php' . ($path === '/' ? '' : $path);
$_SERVER['PATH_INFO'] = $path === '/index.php' ? '' : $path;

require dirname(__DIR__) . '/public/index.php';
