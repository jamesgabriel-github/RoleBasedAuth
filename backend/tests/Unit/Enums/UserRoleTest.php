<?php

namespace Tests\Unit\Enums;

use App\Enums\UserRole;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class UserRoleTest extends TestCase
{
    #[DataProvider('pairs')]
    public function test_can_video_call_with(UserRole $a, UserRole $b, bool $expected): void
    {
        $this->assertSame($expected, $a->canVideoCallWith($b));
    }

    /**
     * @return array<string, array{UserRole, UserRole, bool}>
     */
    public static function pairs(): array
    {
        return [
            'client-client' => [UserRole::Client, UserRole::Client, true],
            'client-admin' => [UserRole::Client, UserRole::Admin, false],
            'client-super_admin' => [UserRole::Client, UserRole::SuperAdmin, false],
            'admin-client' => [UserRole::Admin, UserRole::Client, false],
            'super_admin-client' => [UserRole::SuperAdmin, UserRole::Client, false],
            'admin-admin' => [UserRole::Admin, UserRole::Admin, true],
            'admin-super_admin' => [UserRole::Admin, UserRole::SuperAdmin, true],
            'super_admin-admin' => [UserRole::SuperAdmin, UserRole::Admin, true],
            'super_admin-super_admin' => [UserRole::SuperAdmin, UserRole::SuperAdmin, true],
        ];
    }
}
