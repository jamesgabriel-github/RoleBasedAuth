import { useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { removeAvatar, uploadAvatar } from '@/features/auth/api'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function AvatarUploader() {
  const { user, refetch } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be 5MB or smaller.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setSubmitting(true)
    try {
      await uploadAvatar(file)
      await refetch()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to upload photo.'))
    } finally {
      setSubmitting(false)
      URL.revokeObjectURL(objectUrl)
      setPreview(null)
    }
  }

  async function handleRemove() {
    setError(null)
    setSubmitting(true)
    try {
      await removeAvatar()
      await refetch()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to remove photo.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        <AvatarImage src={preview ?? user.avatarUrl ?? undefined} alt={user.fullName} />
        <AvatarFallback className="text-lg">{initials(user.fullName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => inputRef.current?.click()}
          >
            Change photo
          </Button>
          {user.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={handleRemove}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Up to 5MB.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
