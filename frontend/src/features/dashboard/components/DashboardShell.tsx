import { useState } from 'react'
import type { ReactNode } from 'react'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function DashboardShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav onMenuClick={() => setNavOpen(true)} />
      <div className="flex flex-1">
        <Sidebar />
        <MobileNav open={navOpen} onOpenChange={setNavOpen} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
