import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function PublicLandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <span className="text-lg font-semibold">GAB App</span>
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
          Welcome to GAB — the seamless multi-client messaging experience.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Connect effortlessly across devices with one unified account and real-time
          infrastructure. Whether you're on the web app (Laravel + React SPA) or the native
          Python desktop app, you can message and video-call. A browser user and a desktop user
          can chat or jump into a call interchangeably — no barriers, just smooth communication.
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
        &copy; {new Date().getFullYear()} GAB App. All rights reserved.
      </footer>
    </div>
  )
}
