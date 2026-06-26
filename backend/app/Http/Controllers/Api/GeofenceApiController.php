<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Geofence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class GeofenceApiController extends Controller
{
    /**
     * List all geofences.
     */
    public function index()
    {
        $geofences = Geofence::all();
        return response()->json([
            'success' => true,
            'data' => $geofences
        ]);
    }

    /**
     * Create a new geofence (Admin/Owner only).
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can manage geofence coordinates.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius' => 'required|integer|min:5|max:10000', // 5 meters to 10km
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error.',
                'errors' => $validator->errors()
            ], 422);
        }

        $geofence = Geofence::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Geofence location created successfully.',
            'data' => $geofence
        ], 201);
    }

    /**
     * Update an existing geofence (Admin/Owner only).
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can manage geofence coordinates.'
            ], 403);
        }

        $geofence = Geofence::find($id);

        if (!$geofence) {
            return response()->json([
                'success' => false,
                'message' => 'Geofence location not found.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius' => 'required|integer|min:5|max:10000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error.',
                'errors' => $validator->errors()
            ], 422);
        }

        $geofence->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Geofence location updated successfully.',
            'data' => $geofence
        ]);
    }

    /**
     * Delete a geofence (Admin/Owner only).
     */
    public function destroy($id)
    {
        $user = Auth::user();
        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can manage geofence coordinates.'
            ], 403);
        }

        $geofence = Geofence::find($id);

        if (!$geofence) {
            return response()->json([
                'success' => false,
                'message' => 'Geofence location not found.'
            ], 404);
        }

        $geofence->delete();

        return response()->json([
            'success' => true,
            'message' => 'Geofence location deleted successfully.'
        ]);
    }
}
