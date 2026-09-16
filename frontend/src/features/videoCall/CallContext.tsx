import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import type { User } from '@/types/user'
import * as callApi from './api'
import { useCallChannel } from './hooks/useCallChannel'
import { useIncomingCallListener } from './hooks/useIncomingCallListener'
import { useWebRTCPeerConnection } from './hooks/useWebRTCPeerConnection'
import type { Call, SignalPayload } from './types'
import { CALL_RING_TIMEOUT_MS } from './utils'

type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active'

interface CallContextValue {
  phase: CallPhase
  call: Call | null
  outgoingTarget: User | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMuted: boolean
  isCameraOff: boolean
  startCall: (conversationId: number, targetUser: User) => void
  acceptIncoming: () => void
  declineIncoming: () => Promise<void>
  hangUp: () => Promise<void>
  toggleMute: () => void
  toggleCamera: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [call, setCall] = useState<Call | null>(null)
  const [outgoingTarget, setOutgoingTarget] = useState<User | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  // Set when the user hangs up an outgoing call before initiateCall() has
  // even responded — there's no real Call to cancel yet, so we remember to
  // cancel it as soon as the response arrives instead.
  const outgoingCancelledRef = useRef(false)

  // Refs mirroring the latest state for the setTimeout ring-timeout callback
  // below, which is a plain closure created once and never refreshed by React.
  const callRef = useRef(call)
  useEffect(() => {
    callRef.current = call
  }, [call])

  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearRingTimeout() {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
  }

  useEffect(() => clearRingTimeout, [])

  const peer = useWebRTCPeerConnection({
    onIceCandidate: (candidate) => {
      sendSignalRef.current({ type: 'ice-candidate', candidate, fromUserId: user?.id ?? 0 })
    },
    onRemoteStream: () => {},
    onConnectionStateChange: (state) => {
      if (state === 'failed') {
        void endActiveCall('failed')
      }
    },
  })

  function resetState() {
    clearRingTimeout()
    peer.teardown()
    setCall(null)
    setOutgoingTarget(null)
    setPhase('idle')
    setIsMuted(false)
    setIsCameraOff(false)
  }

  async function handleSignal(payload: SignalPayload) {
    if (user && payload.fromUserId === user.id) return

    if (payload.type === 'offer') {
      const answer = await peer.createAnswer(payload.sdp)
      sendSignalRef.current({ type: 'answer', sdp: answer, fromUserId: user?.id ?? 0 })
    } else if (payload.type === 'answer') {
      await peer.applyAnswer(payload.sdp)
    } else {
      await peer.addIceCandidate(payload.candidate)
    }
  }

  async function handleStatusChanged(updatedCall: Call) {
    setCall(updatedCall)

    if (updatedCall.status === 'ongoing') {
      clearRingTimeout()
      setPhase('active')

      // Only the caller initiates the SDP offer, once media is ready.
      if (user?.id === updatedCall.callerId) {
        try {
          await peer.getLocalMedia()
          const offer = await peer.createOffer()
          sendSignalRef.current({ type: 'offer', sdp: offer, fromUserId: user.id })
        } catch (err) {
          toast.error(getErrorMessage(err, 'Unable to access camera/microphone.'))
          await endActiveCall('failed')
        }
      }
    } else {
      // declined / cancelled / missed / ended / failed
      resetState()
    }
  }

  const { sendSignal } = useCallChannel(call?.id ?? null, {
    onStatusChanged: handleStatusChanged,
    onSignal: handleSignal,
  })
  const sendSignalRef = useRef(sendSignal)
  useEffect(() => {
    sendSignalRef.current = sendSignal
  }, [sendSignal])

  useIncomingCallListener(user?.id ?? null, (incomingCall) => {
    if (phase !== 'idle') {
      // Already on/starting a call — fast local "busy" signal; the server's
      // busy check on a fresh initiate is the real backstop.
      void callApi.declineCall(incomingCall.id).catch(() => {})
      return
    }
    setCall(incomingCall)
    setPhase('incoming')
  })

  function startCall(conversationId: number, targetUser: User) {
    if (phaseRef.current !== 'idle') return

    outgoingCancelledRef.current = false
    setOutgoingTarget(targetUser)
    setPhase('outgoing')

    callApi
      .initiateCall(conversationId)
      .then((newCall) => {
        if (outgoingCancelledRef.current) {
          // Already hung up before the server responded — cancel it now
          // instead of ringing, and don't touch local state (already idle).
          void callApi.cancelCall(newCall.id).catch(() => {})
          return
        }

        setCall(newCall)
        ringTimeoutRef.current = setTimeout(() => {
          if (callRef.current?.id === newCall.id && phaseRef.current === 'outgoing') {
            void callApi.timeoutCall(newCall.id).catch(() => {})
          }
        }, CALL_RING_TIMEOUT_MS)
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Unable to start the call.'))
        resetState()
      })
  }

  function acceptIncoming() {
    if (!call || phaseRef.current !== 'incoming') return

    // The callee already has the full call (caller+callee) from the earlier
    // CallInvited broadcast, so the call window can render immediately —
    // no need to wait on getUserMedia or the accept round-trip.
    const acceptedCallId = call.id
    setPhase('active')

    peer
      .getLocalMedia()
      .then(() => callApi.acceptCall(acceptedCallId))
      .catch((err) => {
        // If the user already hung up/declined locally while this was in
        // flight, the call is already resolved — don't show a confusing
        // error on top of an intentional hang-up.
        if (callRef.current?.id !== acceptedCallId) return
        toast.error(getErrorMessage(err, 'Unable to join the call.'))
        resetState()
      })
  }

  async function declineIncoming() {
    if (!call) return
    await callApi.declineCall(call.id).catch(() => {})
    resetState()
  }

  async function endActiveCall(outcome: 'ended' | 'failed') {
    const current = callRef.current

    if (!current) {
      // Hung up before initiateCall() even responded — remember to cancel
      // the real call once it arrives, and reset local state now.
      if (phaseRef.current === 'outgoing') {
        outgoingCancelledRef.current = true
        resetState()
      }
      return
    }

    try {
      if (current.status === 'ringing' && current.callerId === user?.id) {
        await callApi.cancelCall(current.id)
      } else if (current.status === 'ringing' && current.calleeId === user?.id) {
        await callApi.declineCall(current.id)
      } else if (current.status === 'ongoing') {
        await callApi.endCall(current.id, outcome)
      }
    } catch {
      // best-effort — tear down locally regardless
    } finally {
      resetState()
    }
  }

  async function hangUp() {
    await endActiveCall(peer.connectionState() === 'failed' ? 'failed' : 'ended')
  }

  function toggleMute() {
    setIsMuted(peer.toggleMute())
  }

  function toggleCamera() {
    setIsCameraOff(peer.toggleCamera())
  }

  const value: CallContextValue = {
    phase,
    call,
    outgoingTarget,
    localStream: peer.localStream,
    remoteStream: peer.remoteStream,
    isMuted,
    isCameraOff,
    startCall,
    acceptIncoming,
    declineIncoming,
    hangUp,
    toggleMute,
    toggleCamera,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCallContext(): CallContextValue {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider')
  }
  return context
}
