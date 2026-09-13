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

    /**
     * Video calls are only allowed client-to-client, or between staff
     * (admin/super_admin, in any combination) — never across that tier.
     */
    public function canVideoCallWith(self $other): bool
    {
        if ($this === self::Client && $other === self::Client) {
            return true;
        }

        $staff = [self::Admin, self::SuperAdmin];

        return in_array($this, $staff, true) && in_array($other, $staff, true);
    }
}
