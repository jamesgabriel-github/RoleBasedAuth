<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $roles = collect(UserRole::cases())
            ->mapWithKeys(fn (UserRole $role) => [
                $role->value => Role::firstOrCreate(['name' => $role->value, 'guard_name' => 'web']),
            ]);

        $enableDisableAdmin = Permission::firstOrCreate(['name' => 'enable-disable-admin', 'guard_name' => 'web']);
        $enableDisableClient = Permission::firstOrCreate(['name' => 'enable-disable-client', 'guard_name' => 'web']);
        $viewLoggedInClients = Permission::firstOrCreate(['name' => 'view-logged-in-clients', 'guard_name' => 'web']);

        // super_admin gets every permission explicitly synced (not just enable-disable-admin) so the
        // `permissions` array returned to the frontend reflects full access for UI rendering — Gate::before
        // in AppServiceProvider already grants super_admin every ability server-side regardless of this list.
        $roles[UserRole::SuperAdmin->value]->syncPermissions(Permission::all());
        $roles[UserRole::Admin->value]->syncPermissions([$enableDisableClient, $viewLoggedInClients]);
        $roles[UserRole::Client->value]->syncPermissions([]);
    }
}
