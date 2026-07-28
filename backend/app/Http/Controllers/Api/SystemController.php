<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class SystemController extends Controller
{
    public function publicUrl(): JsonResponse
    {
        return response()->json([
            'frontend_url' => rtrim(config('app.frontend_url', 'http://localhost:5173'), '/'),
        ]);
    }
}
