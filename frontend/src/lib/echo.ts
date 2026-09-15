import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { Channel, ChannelAuthorizationCallback } from 'pusher-js'
import { apiClient, ensureCsrfCookie } from './api-client'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

let echoInstance: Echo<'reverb'> | null = null

export async function connectEcho(): Promise<Echo<'reverb'>> {
  if (echoInstance) return echoInstance

  await ensureCsrfCookie()

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: Channel) => ({
      authorize(socketId: string, callback: ChannelAuthorizationCallback) {
        apiClient
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then(({ data }) => callback(null, data))
          .catch((error) => callback(error, null))
      },
    }),
  })

  return echoInstance
}

export function disconnectEcho(): void {
  echoInstance?.disconnect()
  echoInstance = null
}
