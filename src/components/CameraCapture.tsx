import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, RotateCcw, X } from 'lucide-react'

type CameraKind = 'DOCUMENT' | 'FACE'

type CameraCaptureProps = {
  kind: CameraKind
  title: string
  onCapture: (file: File) => void
  onClose: () => void
}

type FaceDetectorLike = { detect: (source: HTMLVideoElement) => Promise<unknown[]> }
type WindowWithFaceDetector = Window & { FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike }

export function CameraCapture({ kind, title, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const stableFramesRef = useRef(0)
  const lastLumaRef = useRef<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [status, setStatus] = useState('ক্যামেরা প্রস্তুত করা হচ্ছে...')
  const [progress, setProgress] = useState(0)
  const [captured, setCaptured] = useState(false)

  useEffect(() => {
    let active = true
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('এই browser-এ camera support নেই। নিচের ফাইল আপলোড ব্যবহার করুন।')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: kind === 'FACE' ? 'user' : { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setStatus(kind === 'FACE' ? 'মুখটি গোল ফ্রেমের মধ্যে রাখুন' : 'NID-এর চার কোণা ফ্রেমের মধ্যে রাখুন')
        intervalRef.current = window.setInterval(() => { void inspectFrame() }, 450)
      } catch (error) {
        console.error('Camera permission failed:', error)
        if (active) setCameraError('ক্যামেরা চালু করা যায়নি। Permission Allow করুন অথবা নিচের ফাইল আপলোড ব্যবহার করুন।')
      }
    }
    void startCamera()
    return () => {
      active = false
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const inspectFrame = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || busyRef.current || captured || video.readyState < 2 || video.videoWidth < 320) return
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    canvas.width = 160
    canvas.height = 120
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let luminance = 0
    for (let index = 0; index < pixels.length; index += 16) luminance += (pixels[index] * 0.299) + (pixels[index + 1] * 0.587) + (pixels[index + 2] * 0.114)
    const averageLuminance = luminance / (pixels.length / 16)
    const stable = averageLuminance > 42 && averageLuminance < 225 && (lastLumaRef.current === null || Math.abs(averageLuminance - lastLumaRef.current) < 16)
    lastLumaRef.current = averageLuminance
    let faceReady = true
    if (kind === 'FACE') {
      const detector = (window as WindowWithFaceDetector).FaceDetector
      if (detector) {
        try { faceReady = (await new detector({ fastMode: true, maxDetectedFaces: 1 }).detect(video)).length > 0 } catch { faceReady = true }
      }
    }
    if (stable && faceReady) {
      stableFramesRef.current += 1
      setProgress(Math.min(100, stableFramesRef.current * 34))
      setStatus(kind === 'FACE' ? 'মুখ স্থির আছে, ছবি নেওয়া হচ্ছে...' : 'NID স্থির আছে, ছবি নেওয়া হচ্ছে...')
      if (stableFramesRef.current >= 3) await captureFrame()
    } else {
      stableFramesRef.current = 0
      setProgress(0)
      setStatus(kind === 'FACE' ? 'মুখটি ফ্রেমের মধ্যে স্থির রাখুন' : 'NID-এর চার কোণা ও লেখা পরিষ্কার রাখুন')
    }
  }

  const captureFrame = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || busyRef.current) return
    busyRef.current = true
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      busyRef.current = false
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      setCameraError('ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।')
      busyRef.current = false
      return
    }
    const file = new File([blob], `${kind === 'FACE' ? 'face' : 'nid'}-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setCaptured(true)
    setProgress(100)
    setStatus('ছবি নেওয়া হয়েছে')
    onCapture(file)
  }

  const restart = () => {
    stableFramesRef.current = 0
    lastLumaRef.current = null
    busyRef.current = false
    setCaptured(false)
    setProgress(0)
    setCameraError(null)
    setStatus(kind === 'FACE' ? 'মুখটি গোল ফ্রেমের মধ্যে রাখুন' : 'NID-এর চার কোণা ফ্রেমের মধ্যে রাখুন')
    intervalRef.current = window.setInterval(() => { void inspectFrame() }, 450)
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/75 sm:items-center sm:p-4"><div className="w-full max-w-xl overflow-hidden bg-surface shadow-2xl"><div className="flex items-center justify-between border-b border-outline px-4 py-3"><div><p className="text-xs font-semibold text-brand-700">নিরাপদ ক্যামেরা</p><h2 className="mt-0.5 text-base font-bold text-ink-900">{title}</h2></div><button type="button" onClick={onClose} className="border border-outline p-2 text-ink-600 hover:border-brand-500 hover:text-brand-700" aria-label="ক্যামেরা বন্ধ করুন"><X size={18} /></button></div><div className="relative bg-ink-900 p-4"><video ref={videoRef} className="mx-auto aspect-[4/3] w-full max-h-[58vh] object-cover" playsInline muted /><canvas ref={canvasRef} className="hidden" /><div className={`pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 border-2 border-brand-300/90 ${kind === 'FACE' ? 'mx-auto aspect-square max-w-[13rem] rounded-full' : 'aspect-[1.58/1]'}`}><span className="absolute -top-7 left-0 bg-ink-900/70 px-2 py-1 text-xs text-white">{kind === 'FACE' ? 'মুখ' : 'NID front / back'}</span></div>{cameraError && <div className="absolute inset-x-8 bottom-8 border border-red-200 bg-white p-3 text-xs leading-5 text-red-700">{cameraError}</div>}</div><div className="space-y-3 p-4"><div className="flex items-center gap-2 text-sm text-ink-700"><Camera size={17} className="text-brand-600" /><span>{status}</span></div><div className="h-1.5 overflow-hidden bg-brand-50"><div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs leading-5 text-ink-500">আলো পরিষ্কার রাখুন, glare ও blur এড়ান। Auto-capture না হলে নিচের button দিয়ে নিজে ছবি তুলতে পারবেন।</p><div className="flex gap-2"><button type="button" onClick={() => void captureFrame()} disabled={Boolean(cameraError) || captured} className="flex-1 bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{captured ? 'ছবি নেওয়া হয়েছে' : 'এখনই ছবি তুলুন'}</button>{captured && <button type="button" onClick={restart} className="inline-flex items-center justify-center gap-1.5 border border-brand-500 px-3 py-2.5 text-sm font-semibold text-brand-700"><RotateCcw size={15} />আবার</button>}</div><p className="flex items-center gap-1 text-xs text-ink-400"><CheckCircle2 size={13} className="text-brand-600" />ক্যামেরার ছবি সরাসরি verification document হিসেবে ব্যবহার হবে।</p></div></div></div>
}
