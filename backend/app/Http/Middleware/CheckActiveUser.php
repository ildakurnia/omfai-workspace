<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckActiveUser
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && !$user->is_active) {
            // Hapus token aktif pengguna saat ini agar ter-kick seketika
            $user->tokens()->delete();
            
            return response()->json([
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi admin.'
            ], 403);
        }

        return $next($request);
    }
}
