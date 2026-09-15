import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'
import { useCallContext } from '../CallContext'
import { formatCallDuration } from '../utils'

function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0)
      return
    }
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return elapsed
}

export function CallWindow() {
  const { user } = useAuth()
  const { phase, call, localStream, remoteStream, isMuted, isCameraOff, hangUp, toggleMute, toggleCamera } =
    useCallContext()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const elapsed = useElapsedSeconds(call?.answeredAt ?? null)

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream, phase])

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream, phase])

  if ((phase !== 'outgoing' && phase !== 'active') || !call) return null

  const otherUser = user?.id === call.callerId ? call.callee : call.caller

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full bg-neutral-900 object-cover"
      />
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute right-4 bottom-24 h-32 w-24 rounded-lg bg-neutral-800 object-cover ring-2 ring-white/50 sm:h-40 sm:w-32"
      />

      <div className="relative z-10 flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">{otherUser.fullName}</p>
          <p className="text-xs text-white/70">{phase === 'active' ? formatCallDuration(elapsed) : 'Ringing…'}</p>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex justify-center gap-3 p-6">
        <Button size="icon-lg" variant="secondary" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button
          size="icon-lg"
          variant="secondary"
          onClick={toggleCamera}
          aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {isCameraOff ? <VideoOff /> : <Video />}
        </Button>
        <Button size="icon-lg" variant="destructive" onClick={hangUp} aria-label="Hang up">
          <PhoneOff />
        </Button>
      </div>
    </div>
  )
}
