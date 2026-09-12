import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function PublicLandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <span className="text-lg font-semibold">Auth SPA</span>
        <nav className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link to="/login?tab=register">Register</Link>
          </Button>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Role-based authentication, done right.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          A single page application with guest and dashboard routing, social login, and
          role-aware access control for clients, admins, and super admins.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link to="/login?tab=register">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Auth SPA. All rights reserved.
      </footer>
    </div>
  )
}
