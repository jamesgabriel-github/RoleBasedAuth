import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function MessageComposer({ onSend }: { onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      await onSend(trimmed)
      setBody('')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t p-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        className="max-h-40"
      />
      <Button onClick={handleSend} disabled={sending || !body.trim()}>
        Send
      </Button>
    </div>
  )
}
