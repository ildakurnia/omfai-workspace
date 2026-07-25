<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WhatsAppHelper;
use App\Models\WorkHourPermission;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class WorkHourPermissionController extends Controller
{
    /**
     * List all work hour permissions (Admin/Owner only).
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can list all work hour permissions.'
            ], 403);
        }

        $query = WorkHourPermission::with('employee.user')
            ->orderBy('created_at', 'desc');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get()
        ]);
    }

    /**
     * Submit a work hour permission request (Employee only).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:out_temporary,arrive_late,leave_early',
            'date' => 'required|date',
            'start_time' => 'nullable|string',
            'end_time' => 'nullable|string',
            'reason' => 'required|string',
            'attachment' => 'nullable|file|mimes:jpeg,png,jpg,pdf|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        // Check if there is already a full-day leave approved for this date
        $isOnLeave = \App\Models\LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $request->date)
            ->whereDate('end_date', '>=', $request->date)
            ->exists();

        if ($isOnLeave) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan cuti/izin satu hari penuh yang disetujui pada tanggal tersebut.'
            ], 422);
        }

        // Check for duplicate pending/approved permission of the same type on the same date
        $duplicate = WorkHourPermission::where('employee_id', $employee->id)
            ->where('date', $request->date)
            ->where('type', $request->type)
            ->whereIn('status', ['pending', 'approved'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan izin jam kerja dengan tipe yang sama yang sedang diajukan atau disetujui pada tanggal tersebut.'
            ], 422);
        }

        // Upload attachment if present
        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('work_hour_permission_attachments', 'public');
        }

        // Save Work Hour Permission
        $permission = WorkHourPermission::create([
            'employee_id' => $employee->id,
            'type' => $request->type,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'reason' => $request->reason,
            'attachment' => $attachmentPath,
            'status' => 'pending',
        ]);

        // Send WhatsApp Notification to Owner
        $ownerNumber = config('services.whatsapp.owner_number');
        if (!empty($ownerNumber)) {
            $typeLabel = match($request->type) {
                'out_temporary' => 'Izin Keluar Sementara',
                'arrive_late' => 'Izin Datang Terlambat',
                'leave_early' => 'Izin Pulang Lebih Awal',
                default => str_replace('_', ' ', ucfirst($request->type))
            };
            $formattedDate = Carbon::parse($request->date)->format('d M Y');
            $timeRange = ($request->type === 'leave_early') 
                ? "mulai jam " . ($request->start_time ?: '--:--') 
                : ($request->start_time ?: '--:--') . " s/d " . ($request->end_time ?: '--:--');

            $frontendUrl = config('services.frontend.url');
            $waMessage = "🔔 *NOTIFIKASI PENGAJUAN IZIN JAM KERJA*\n\n"
                . "Halo Owner,\n\n"
                . "Terdapat pengajuan izin jam kerja baru yang memerlukan keputusan Anda.\n\n"
                . "👤 *Data Karyawan*\n"
                . "• Nama: {$employee->name}\n"
                . "• ID Karyawan: {$employee->employee_code}\n\n"
                . "📝 *Detail Pengajuan*\n"
                . "• Kategori: {$typeLabel}\n"
                . "• Tanggal: {$formattedDate}\n"
                . "• Jam Pengajuan: {$timeRange}\n"
                . "• Alasan/Keperluan: \"_{$request->reason}_\"\n\n"
                . "Sistem mendeteksi pengajuan ini berstatus *Pending*. Silakan klik link berikut untuk memproses pengajuan:\n"
                . "🔗 {$frontendUrl}/attendance-leave \n\n"
                . "Terima kasih. 🙏";

            WhatsAppHelper::sendMessage($ownerNumber, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Izin jam kerja berhasil diajukan.',
            'data' => $permission
        ], 201);
    }

    /**
     * Get history of work hour permissions for the authenticated employee.
     */
    public function history()
    {
        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $history = WorkHourPermission::where('employee_id', $employee->id)
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }

    /**
     * Cancel a pending work hour permission request (Employee only).
     */
    public function cancel($id)
    {
        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $permission = WorkHourPermission::find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan izin tidak ditemukan.'
            ], 404);
        }

        // Verify ownership
        if ($permission->employee_id !== $employee->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki otoritas untuk membatalkan pengajuan ini.'
            ], 403);
        }

        // Only allow cancellation of pending requests
        if ($permission->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan tidak dapat dibatalkan karena sudah diproses (Status: ' . $permission->status . ').'
            ], 422);
        }

        // Update status to cancelled
        $permission->update([
            'status' => 'cancelled'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan izin jam kerja berhasil dibatalkan.',
            'data' => $permission
        ]);
    }

    /**
     * Approve a work hour permission request (Admin/Owner only).
     */
    public function approve($id)
    {
        $user = Auth::user();

        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can approve work hour permissions.'
            ], 403);
        }

        $permission = WorkHourPermission::with('employee')->find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan izin tidak ditemukan.'
            ], 404);
        }

        if ($permission->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This request has already been processed (current status: ' . $permission->status . ').'
            ], 422);
        }

        // Update status to approved
        $permission->update([
            'status' => 'approved'
        ]);

        // Send WhatsApp notification to the employee
        $employee = $permission->employee;
        if ($employee && !empty($employee->whatsapp_number)) {
            $typeLabel = match($permission->type) {
                'out_temporary' => 'Izin Keluar Sementara',
                'arrive_late' => 'Izin Datang Terlambat',
                'leave_early' => 'Izin Pulang Lebih Awal',
                default => str_replace('_', ' ', ucfirst($permission->type))
            };
            $formattedDate = Carbon::parse($permission->date)->format('d M Y');
            $timeRange = ($permission->type === 'leave_early') 
                ? "mulai jam " . ($permission->start_time ?: '--:--') 
                : ($permission->start_time ?: '--:--') . " s/d " . ($permission->end_time ?: '--:--');

            $gpsReminder = "";
            if ($permission->type === 'out_temporary') {
                $gpsReminder = "\n\n📌 *Penting*\n"
                    . "Untuk izin *Keluar Sementara*, silakan tap *\"Mulai Keluar\"* saat meninggalkan kantor, lalu tap *\"Kembali Kerja\"* setelah Anda kembali ke area kantor.";
            }

            $frontendUrl = config('services.frontend.url');
            $waMessage = "🔔 *NOTIFIKASI PENGAJUAN IZIN JAM KERJA*\n\n"
                . "Halo {$employee->name},\n\n"
                . "Pengajuan izin jam kerja Anda telah disetujui oleh Admin/Owner.\n\n"
                . "📝 *Detail Pengajuan*\n"
                . "• Kategori: {$typeLabel}\n"
                . "• Tanggal: {$formattedDate}\n"
                . "• Jam Pengajuan: {$timeRange}\n"
                . "• Status: ✅ Disetujui"
                . $gpsReminder . "\n\n"
                . "Akses dashboard Anda untuk detailnya:\n"
                . "🔗 {$frontendUrl}/dashboard \n\n"
                . "Terima kasih. Semoga aktivitas Anda hari ini berjalan lancar. 🙏";

            WhatsAppHelper::sendMessage($employee->whatsapp_number, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Izin jam kerja berhasil disetujui.',
            'data' => $permission
        ]);
    }

    /**
     * Reject a work hour permission request (Admin/Owner only).
     */
    public function reject(Request $request, $id)
    {
        $user = Auth::user();

        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can reject work hour permissions.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'rejection_reason' => 'required|string|min:3',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Alasan penolakan harus diisi minimal 3 karakter.',
                'errors' => $validator->errors()
            ], 422);
        }

        $permission = WorkHourPermission::with('employee')->find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan izin tidak ditemukan.'
            ], 404);
        }

        if ($permission->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This request has already been processed (current status: ' . $permission->status . ').'
            ], 422);
        }

        // Update status to rejected
        $permission->update([
            'status' => 'rejected',
            'rejection_reason' => $request->rejection_reason,
        ]);

        // Send WhatsApp notification to the employee
        $employee = $permission->employee;
        if ($employee && !empty($employee->whatsapp_number)) {
            $typeLabel = match($permission->type) {
                'out_temporary' => 'Izin Keluar Sementara',
                'arrive_late' => 'Izin Datang Terlambat',
                'leave_early' => 'Izin Pulang Lebih Awal',
                default => str_replace('_', ' ', ucfirst($permission->type))
            };
            $formattedDate = Carbon::parse($permission->date)->format('d M Y');
            $timeRange = ($permission->type === 'leave_early') 
                ? "mulai jam " . ($permission->start_time ?: '--:--') 
                : ($permission->start_time ?: '--:--') . " s/d " . ($permission->end_time ?: '--:--');

            $frontendUrl = config('services.frontend.url');
            $waMessage = "❌ *STATUS PENOLAKAN IZIN JAM KERJA*\n\n"
                . "Halo {$employee->name},\n\n"
                . "Mohon maaf, pengajuan izin jam kerja Anda telah ditolak oleh Admin/Owner.\n\n"
                . "📝 *Detail Pengajuan*\n"
                . "• Kategori: {$typeLabel}\n"
                . "• Tanggal: {$formattedDate}\n"
                . "• Jam Pengajuan: {$timeRange}\n"
                . "• Status: Ditolak ❌\n"
                . "• Alasan Penolakan: \"_{$request->rejection_reason}_\"\n\n"
                . "Akses dashboard Anda untuk detailnya:\n"
                . "🔗 {$frontendUrl}/dashboard \n\n"
                . "Silakan hubungi pihak HRD/Admin jika ada pertanyaan lebih lanjut. 🙏";

            WhatsAppHelper::sendMessage($employee->whatsapp_number, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Izin jam kerja ditolak.',
            'data' => $permission
        ]);
    }

    /**
     * Delete a work hour permission request (Admin/Owner only).
     */
    public function destroy($id)
    {
        $user = Auth::user();

        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can delete work hour permissions.'
            ], 403);
        }

        $permission = WorkHourPermission::find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan izin tidak ditemukan.'
            ], 404);
        }

        $permission->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan izin jam kerja berhasil dihapus.'
        ]);
    }

    /**
     * Record actual start/end exit time with GPS detection for out_temporary type.
     */
    public function tapOutTemporary(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat lokasi (latitude & longitude) diperlukan.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $now = Carbon::now(config('app.timezone', 'Asia/Jakarta'));
        $today = $now->toDateString();
        $currentTime = $now->toTimeString();

        // 1. Geofence Check
        $geofences = \App\Models\Geofence::all();
        if ($geofences->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No geofencing coordinates are configured on the server.'
            ], 400);
        }

        $inRange = false;
        $userLat = $request->latitude;
        $userLng = $request->longitude;

        foreach ($geofences as $geofence) {
            $distance = $this->calculateDistance($userLat, $userLng, $geofence->latitude, $geofence->longitude);
            if ($distance <= $geofence->radius) {
                $inRange = true;
                break;
            }
        }

        if (!$inRange) {
            return response()->json([
                'success' => false,
                'message' => 'Anda berada di luar area geofence kantor yang diizinkan.'
            ], 403);
        }

        // 2. Fetch today's approved or pending out_temporary permission
        $permission = WorkHourPermission::where('employee_id', $employee->id)
            ->where('date', $today)
            ->where('type', 'out_temporary')
            ->whereIn('status', ['approved', 'pending'])
            ->first();

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin keluar sementara (pending/approved) untuk hari ini.'
            ], 403);
        }

        // 3. Process Toggle
        if (is_null($permission->actual_start_time)) {
            // Tap Out (Start Exit)
            $permission->update([
                'actual_start_time' => $currentTime
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Berhasil mencatat jam keluar sementara. Selamat jalan.',
                'data' => $permission
            ]);
        } elseif (is_null($permission->actual_end_time)) {
            // Tap In (Return to Work)
            $permission->update([
                'actual_end_time' => $currentTime
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Berhasil mencatat jam kembali kerja. Selamat bekerja kembali.',
                'data' => $permission
            ]);
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah menyelesaikan izin keluar sementara hari ini.'
            ], 403);
        }
    }

    /**
     * Helper: Haversine distance formula (in meters).
     */
    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371000; // Earth radius in meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}
