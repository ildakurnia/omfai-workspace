<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
$users = \App\Models\User::all(['id', 'name', 'email']);
echo json_encode($users, JSON_PRETTY_PRINT) . "\n";
