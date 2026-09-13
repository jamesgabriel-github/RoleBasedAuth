import { useCallback, useEffect, useRef, useState } from 'react'
import { RTC_CONFIG } from '../utils'

interface PeerConnectionHandlers {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
  onRemoteStream: (stream: MediaStream) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
}

export function useWebRTCPeerConnection(handlers: PeerConnectionHandlers) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const remoteDescriptionSetRef = useRef(false)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current

    const pc = new RTCPeerConnection(RTC_CONFIG)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        handlersRef.current.onIceCandidate(event.candidate.toJSON())
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) {
        setRemoteStream(stream)
        handlersRef.current.onRemoteStream(stream)
      }
    }

    pc.onconnectionstatechange = () => {
      handlersRef.current.onConnectionStateChange(pc.connectionState)
    }

    pcRef.current = pc
    return pc
  }, [])

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const candidate of queued) {
      await pc.addIceCandidate(candidate)
    }
  }, [])

  const getLocalMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStreamRef.current = stream
    setLocalStream(stream)

    const pc = ensurePeerConnection()
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    return stream
  }, [ensurePeerConnection])

  const createOffer = useCallback(async () => {
    const pc = ensurePeerConnection()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    return offer
  }, [ensurePeerConnection])

  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      const pc = ensurePeerConnection()
      await pc.setRemoteDescription(offer)
      remoteDescriptionSetRef.current = true
      await flushPendingCandidates(pc)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      return answer
    },
    [ensurePeerConnection, flushPendingCandidates],
  )

  const applyAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      const pc = ensurePeerConnection()
      await pc.setRemoteDescription(answer)
      remoteDescriptionSetRef.current = true
      await flushPendingCandidates(pc)
    },
    [ensurePeerConnection, flushPendingCandidates],
  )

  const addIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const pc = ensurePeerConnection()
      if (remoteDescriptionSetRef.current) {
        await pc.addIceCandidate(candidate)
      } else {
        pendingCandidatesRef.current.push(candidate)
      }
    },
    [ensurePeerConnection],
  )

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return false
    const audioTracks = stream.getAudioTracks()
    const nextEnabled = audioTracks.some((track) => !track.enabled)
    audioTracks.forEach((track) => {
      track.enabled = nextEnabled
    })
    return !nextEnabled
  }, [])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return false
    const videoTracks = stream.getVideoTracks()
    const nextEnabled = videoTracks.some((track) => !track.enabled)
    videoTracks.forEach((track) => {
      track.enabled = nextEnabled
    })
    return !nextEnabled
  }, [])

  const teardown = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    pendingCandidatesRef.current = []
    remoteDescriptionSetRef.current = false
    setLocalStream(null)
    setRemoteStream(null)
  }, [])

  const connectionState = useCallback(() => pcRef.current?.connectionState ?? null, [])

  return {
    localStream,
    remoteStream,
    getLocalMedia,
    createOffer,
    createAnswer,
    applyAnswer,
    addIceCandidate,
    toggleMute,
    toggleCamera,
    teardown,
    connectionState,
  }
}
