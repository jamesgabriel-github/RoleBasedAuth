import { useEffect, useRef } from 'react'
import { subscribeUserChannel } from '@/lib/userChannel'
import type { Call } from '../types'

export function useIncomingCallListener(userId: number | null, onIncoming: (call: Call) => void) {
  const onIncomingRef = useRef(onIncoming)

  useEffect(() => {
    onIncomingRef.current = onIncoming
  }, [onIncoming])

  useEffect(() => {
    if (!userId) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    subscribeUserChannel(userId, (channel) => {
      const handler = (call: Call) => onIncomingRef.current(call)
      channel.listen('.call.invited', handler)
      return () => channel.stopListening('.call.invited', handler)
    }).then((unsubscribe) => {
      if (cancelled) {
        unsubscribe()
      } else {
        cleanup = unsubscribe
      }
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [userId])
}
