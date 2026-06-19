<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreHolidayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => 'required|date|unique:holidays,date',
            'name' => 'required|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'date.required' => 'Tanggal libur wajib diisi.',
            'date.date' => 'Format tanggal libur tidak valid.',
            'date.unique' => 'Tanggal libur ini sudah terdaftar di sistem.',
            'name.required' => 'Nama libur wajib diisi.',
        ];
    }
}
