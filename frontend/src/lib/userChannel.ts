import type Echo from 'laravel-echo'
import { connectEcho } from './echo'

type PrivateChannel = ReturnType<Echo<'reverb'>['private']>

/**
 * laravel-echo's Echo.leave() has no reference counting — it unconditionally
 * unsubscribes and drops the cached channel. Multiple independent hooks
 * subscribing to the same `user.{id}` channel would otherwise race to tear
 * each other's subscription down. This wrapper counts subscribers per
 * channel name so the channel is only left once the last consumer unmounts.
 */
const subscriberCounts = new Map<string, number>()

export async function subscribeUserChannel(
  userId: number,
  bind: (channel: PrivateChannel) => () => void,
): Promise<() => void> {
  const echo = await connectEcho()
  const name = `user.${userId}`
  const channel = echo.private(name)
  const unbind = bind(channel)

  subscriberCounts.set(name, (subscriberCounts.get(name) ?? 0) + 1)

  return () => {
    unbind()
    const count = (subscriberCounts.get(name) ?? 1) - 1
    if (count <= 0) {
      subscriberCounts.delete(name)
      echo.leave(name)
    } else {
      subscriberCounts.set(name, count)
    }
  }
}
