<?php

namespace App\Http\Requests;

use App\Enums\ActivityStatusEnum;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateActivityRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => 'required|exists:categories,id,is_active,1',
            'activity' => 'required|string',
            'status' => ['required', new Enum(ActivityStatusEnum::class)],
            'hold_reason' => 'required_if:status,' . ActivityStatusEnum::ON_HOLD->value . '|nullable|string',
            'reference_link' => 'nullable|url',
            'progress_note' => 'nullable|string',
            'proof_image' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:5120',
        ];
    }

    /**
     * Custom error messages.
     */
    public function messages(): array
    {
        return [
            'category_id.exists' => 'Kategori yang dipilih tidak aktif atau tidak ditemukan.',
            'hold_reason.required_if' => 'Alasan hold (hold reason) wajib diisi jika status aktivitas adalah On Hold.',
            'reference_link.url' => 'Link referensi harus menggunakan format URL yang valid.',
            'proof_image.image' => 'File bukti harus berupa gambar.',
            'proof_image.mimes' => 'Format gambar bukti harus berupa PNG, JPG, JPEG, atau WebP.',
            'proof_image.max' => 'Ukuran gambar bukti tidak boleh lebih dari 5MB.',
        ];
    }
}
