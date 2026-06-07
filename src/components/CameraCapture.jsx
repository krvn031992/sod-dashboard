import { useEffect, useRef, useState } from 'react'
import { Button } from './ui'

// Selfie capture for attendance. Uses the front camera via getUserMedia and
// snapshots a JPEG. Falls back to the OS file picker when the camera is blocked
// or unavailable. Calls onCapture(blob, dataUrl).
export default function CameraCapture({ onCapture, label = 'Take selfie' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setActive(false)
  }

  useEffect(() => () => stop(), [])

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      setActive(true)
      // wait a tick for the <video> to mount
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch {
      setError('Camera unavailable — use “Upload photo” instead.')
    }
  }

  const snap = () => {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    // mirror so the selfie matches what the user sees
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, w, h)
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, canvas.toDataURL('image/jpeg', 0.85))
        stop()
      },
      'image/jpeg',
      0.85,
    )
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onCapture(file, reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      {active ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full -scale-x-100 object-cover"
          />
        </div>
      ) : null}

      {error && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <Button type="button" onClick={start}>
            {label}
          </Button>
        ) : (
          <>
            <Button type="button" onClick={snap}>
              Capture
            </Button>
            <Button type="button" variant="subtle" onClick={stop}>
              Cancel
            </Button>
          </>
        )}

        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-gold/35 px-4 py-2.5 text-[0.95rem] font-semibold text-gold transition hover:border-gold hover:bg-gold/10">
          Upload photo
          <input
            type="file"
            accept="image/*"
            capture="user"
            onChange={onFile}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}
