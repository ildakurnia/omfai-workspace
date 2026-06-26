<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppHelper
{
    /**
     * Send a WhatsApp message.
     *
     * @param string $target The recipient's phone number
     * @param string $message The message text content
     * @return bool
     */
    public static function sendMessage(string $target, string $message): bool
    {
        // Fetch values from env or config
        $token = env('WA_API_TOKEN');

        // Always log the message locally for audit/debug purposes
        Log::info("WhatsApp Helper send attempt [To: {$target}]: {$message}");

        if (empty($token)) {
            Log::info("WhatsApp API Token is empty (WA_API_TOKEN). Simulated message logged.");
            return true;
        }

        try {
            // Using Fonnte API endpoint as specified in implementation plan
            $response = Http::withHeaders([
                'Authorization' => $token,
            ])->post('https://api.fonnte.com/send', [
                'target' => $target,
                'message' => $message,
            ]);

            if ($response->successful()) {
                Log::info("WhatsApp message successfully dispatched to {$target}. Status code: " . $response->status());
                return true;
            }

            Log::error("WhatsApp Gateway returned error status: " . $response->status() . " with response: " . $response->body());
            return false;
        } catch (\Exception $e) {
            Log::error("Exception occurred while sending WhatsApp message: " . $e->getMessage());
            return false;
        }
    }
}
