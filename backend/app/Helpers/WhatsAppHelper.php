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
        // Fetch values from config
        $url = config('services.whatsapp.url');
        $token = config('services.whatsapp.token');

        // Clean target number (ensure numbers only, convert 08xxx to 628xxx)
        $target = preg_replace('/[^0-9]/', '', $target);
        if (str_starts_with($target, '0')) {
            $target = '62' . substr($target, 1);
        }

        // Always log the message locally for audit/debug purposes
        Log::info("WhatsApp Helper send attempt [To: {$target}]: {$message}");

        if (empty($token) || empty($url)) {
            Log::info("WhatsApp API Token or URL is empty (WA_API_TOKEN or WA_API_URL). Simulated message logged.");
            return true;
        }

        try {
            // Using CloudWA API v1 endpoint with Bearer token authorization
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $token,
            ])->post($url, [
                'recipient_type' => 'individual',
                'to' => $target,
                'type' => 'text',
                'text' => [
                    'body' => $message,
                ],
            ]);

            $responseData = $response->json();

            if ($response->successful() && isset($responseData['code']) && $responseData['code'] === 200) {
                Log::info("WhatsApp message successfully dispatched to {$target}. Response: " . json_encode($responseData));
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
