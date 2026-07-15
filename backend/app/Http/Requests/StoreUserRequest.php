<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Autentikasi dan otorisasi sudah dihandle di middleware routes
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:Owner,Admin,Employee',
            'joined_at' => 'required_if:role,Employee|nullable|date',
            'whatsapp_number' => 'required_if:role,Employee|nullable|string',
            'leave_balance' => 'required_if:role,Employee|nullable|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ];
    }
}
