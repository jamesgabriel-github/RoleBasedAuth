import { Button } from '@/components/ui/button'
import { oauthRedirectUrl } from '../api'
import type { OAuthProvider } from '../types'

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'github', label: 'Continue with GitHub' },
]

export function OAuthButtons() {
  function handleClick(provider: OAuthProvider) {
    window.location.href = oauthRedirectUrl(provider)
  }

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleClick(provider.id)}
        >
          {provider.label}
        </Button>
      ))}
    </div>
  )
}
