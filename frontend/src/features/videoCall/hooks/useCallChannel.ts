import { useEffect, useRef } from 'react'
import { connectEcho } from '@/lib/echo'
import type { Call, SignalPayload } from '../types'

export function useCallChannel(
  callId: number | null,
  handlers: {
    onStatusChanged: (call: Call) => void
    onSignal: (payload: SignalPayload) => void
  },
) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!callId) return

    const channelName = `call.${callId}`
    const onStatusChanged = (call: Call) => handlersRef.current.onStatusChanged(call)
    const onSignal = (payload: SignalPayload) => handlersRef.current.onSignal(payload)

    connectEcho().then((echo) => {
      echo.private(channelName).listen('.call.status-changed', onStatusChanged).listenForWhisper('signal', onSignal)
    })

    return () => {
      connectEcho().then((echo) => echo.leave(channelName))
    }
  }, [callId])

  async function sendSignal(payload: SignalPayload) {
    if (!callId) return
    const echo = await connectEcho()
    echo.private(`call.${callId}`).whisper('signal', payload)
  }

  return { sendSignal }
}
