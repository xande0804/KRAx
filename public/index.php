<?php
date_default_timezone_set('America/Sao_Paulo');
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../storage/logs/app.log');
error_reporting(E_ALL);

$BASE_URL = '/KRAx';

require_once __DIR__ . '/../app/views/index.php';
