<?php

namespace App\Enums;

enum UserRole: string
{
    case Client = 'client';
    case Admin = 'admin';
    case SuperAdmin = 'super_admin';

    public function label(): string
    {
        return match ($this) {
            self::Client => 'Client',
            self::Admin => 'Admin',
            self::SuperAdmin => 'Super Admin',
        };
    }
}
