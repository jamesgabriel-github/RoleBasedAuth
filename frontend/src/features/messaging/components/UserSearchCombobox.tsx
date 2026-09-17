import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getErrorMessage } from '@/lib/errors'
import type { User } from '@/types/user'
import { searchMessageableUsers } from '../api'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function UserSearchCombobox({ onSelect }: { onSelect: (user: User) => void }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || email.trim().length < 2) {
      setResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        setResults(await searchMessageableUsers(email.trim()))
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to search.'))
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [email, open])

  function handleSelect(user: User) {
    setOpen(false)
    setEmail('')
    setResults([])
    onSelect(user)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="size-4" />
          New message
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] sm:w-80">
        <Input
          autoFocus
          placeholder="Search by email…"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="flex flex-col gap-1">
          {loading && <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</p>}
          {error && <p className="px-2 py-1.5 text-sm text-destructive">{error}</p>}
          {!loading && !error && email.trim().length >= 2 && results.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches found.</p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Avatar size="sm">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
              </Avatar>
              <span className="flex flex-col overflow-hidden">
                <span className="truncate font-medium">{user.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
