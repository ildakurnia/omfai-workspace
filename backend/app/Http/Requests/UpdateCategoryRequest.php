<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCategoryRequest extends FormRequest
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
        $categoryId = $this->route('category');
        if (is_object($categoryId)) {
            $categoryId = $categoryId->id;
        }

        return [
            'name' => 'required|string|max:255|unique:categories,name,' . $categoryId,
            'is_active' => 'required|boolean',
        ];
    }
}
