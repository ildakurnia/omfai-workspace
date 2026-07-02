<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Auto-clear route cache if route files are newer than the cache file
        $routeCachePath = base_path('bootstrap/cache/routes-v7.php');
        $routesApi = base_path('routes/api.php');
        $routesWeb = base_path('routes/web.php');

        if (file_exists($routeCachePath)) {
            $cacheTime = filemtime($routeCachePath);
            $apiChanged = file_exists($routesApi) && filemtime($routesApi) > $cacheTime;
            $webChanged = file_exists($routesWeb) && filemtime($routesWeb) > $cacheTime;

            if ($apiChanged || $webChanged) {
                @unlink($routeCachePath);
            }
        }
    }
}
