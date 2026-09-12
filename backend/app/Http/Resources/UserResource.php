<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'firstName' => $this->first_name,
            'middleName' => $this->middle_name,
            'lastName' => $this->last_name,
            'fullName' => $this->full_name,
            'contactNumber' => $this->contact_number,
            'email' => $this->email,
            'role' => $this->role->value,
            'isActive' => $this->is_active,
            'permissions' => $this->getAllPermissions()->pluck('name')->values(),
            'createdAt' => $this->created_at,
        ];
    }
}
