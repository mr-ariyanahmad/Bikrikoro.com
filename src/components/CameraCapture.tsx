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

function getAverageLuminance(pixels: Uint8ClampedArray) {
  let luminance = 0
  for (let index = 0; index < pixels.length; index += 16) luminance += (pixels[index] * 0.299) + (pixels[index + 1] * 0.587) + (pixels[index + 2] * 0.114)
  return luminance / (pixels.length / 16)
}

function looksLikeDocument(pixels: Uint8ClampedArray, width: number, height: number) {
  const grayscale = new Uint8Array(width * height)
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) grayscale[pixel] = Math.round((pixels[index] * 0.299) + (pixels[index + 1] * 0.587) + (pixels[index + 2] * 0.114))
  let edges = 0
  let samples = 0
  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const current = grayscale[y * width + x]
      const horizontal = Math.abs(current - grayscale[y * width + x + 2])
      const vertical = Math.abs(current - grayscale[(y + 2) * width + x])
      if (horizontal > 18 || vertical > 18) edges += 1
      samples += 1
    }
  }
  const edgeRatio = samples ? edges / samples : 0
  const centerStartX = Math.floor(width * 0.2)
  const centerEndX = Math.floor(width * 0.8)
  const centerStartY = Math.floor(height * 0.2)
  const centerEndY = Math.floor(height * 0.8)
  let centerTotal = 0
  let centerCount = 0
  for (let y = centerStartY; y < centerEndY; y += 4) {
    for (let x = centerStartX; x < centerEndX; x += 4) {
      centerTotal += grayscale[y * width + x]
      centerCount += 1
    }
  }
  const centerAverage = centerCount ? centerTotal / centerCount : 0
  return edgeRatio > 0.055 && centerAverage > 30 && centerAverage < 235
}

export function CameraCapture({ kind, title, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null)
  const busyRef = useRef(false)
  const stableFramesRef = useRef(0)
  const lastLumaRef = useRef<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [status, setStatus] = useState('ক্যামেরা প্রস্তুত করা হচ্ছে...')
  const [progress, setProgress] = useState(0)
  const [captureReady, setCaptureReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)

  const stopStream = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const captureFrame = async (manual = false) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || busyRef.current || video.videoWidth < 320) return
    if (!manual && !captureReady) return
    busyRef.current = true
    stopStream()
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      busyRef.current = false
      setCameraError('ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      busyRef.current = false
      setCameraError('ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।')
      return
    }
    const file = new File([blob], `${kind === 'FACE' ? 'face' : 'nid'}-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setPreviewFile(file)
    setPreviewUrl(URL.createObjectURL(blob))
    setProgress(100)
    setStatus('ছবিটি পরীক্ষা করুন')
  }

  async function inspectFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || busyRef.current || previewFile || video.readyState < 2 || video.videoWidth < 320) return
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    canvas.width = 160
    canvas.height = 120
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const averageLuminance = getAverageLuminance(pixels)
    const lightingReady = averageLuminance > 42 && averageLuminance < 225
    const movementReady = lastLumaRef.current === null || Math.abs(averageLuminance - lastLumaRef.current) < 16
    lastLumaRef.current = averageLuminance
    let targetReady = false
    if (kind === 'FACE') {
      const detectorConstructor = (window as WindowWithFaceDetector).FaceDetector
      if (detectorConstructor) {
        faceDetectorRef.current ??= new detectorConstructor({ fastMode: true, maxDetectedFaces: 1 })
        try {
          targetReady = (await faceDetectorRef.current.detect(video)).length > 0
        } catch {
          targetReady = false
        }
      } else {
        setCaptureReady(false)
        setProgress(0)
        setStatus('এই browser-এ মুখ শনাক্ত করা যায় না—মুখ ফ্রেমে এনে preview দেখে ছবি তুলুন')
        return
      }
    } else {
      targetReady = looksLikeDocument(pixels, canvas.width, canvas.height)
    }
    const ready = lightingReady && movementReady && targetReady
    setCaptureReady(ready)
    if (ready) {
      stableFramesRef.current += 1
      setProgress(Math.min(92, stableFramesRef.current * 30))
      setStatus(kind === 'FACE' ? 'মুখ শনাক্ত হয়েছে, স্থির রাখুন...' : 'NID শনাক্ত হয়েছে, স্থির রাখুন...')
      if (stableFramesRef.current >= 3) await captureFrame()
      return
    }
    stableFramesRef.current = 0
    setCaptureReady(false)
    setProgress(0)
    if (!lightingReady) setStatus('আলো ঠিক করুন—ছবি খুব অন্ধকার বা বেশি উজ্জ্বল')
    else if (!movementReady) setStatus('ক্যামেরা স্থির রাখুন')
    else if (kind === 'FACE') setStatus('মুখটি গোল ফ্রেমের পুরো ভিতরে আনুন')
    else setStatus('NID-এর চার কোণা ফ্রেমের ভিতরে আনুন')
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('এই browser-এ camera support নেই। নিচের ফাইল আপলোড ব্যবহার করুন।')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: kind === 'FACE' ? 'user' : { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCameraError(null)
      setStatus(kind === 'FACE' ? 'মুখটি গোল ফ্রেমের ভিতরে আনুন' : 'NID-এর চার কোণা ফ্রেমের ভিতরে আনুন')
      intervalRef.current = window.setInterval(() => { void inspectFrame() }, 450)
    } catch (error) {
      console.error('Camera permission failed:', error)
      setCameraError('ক্যামেরা চালু করা যায়নি। Permission Allow করুন অথবা নিচের ফাইল আপলোড ব্যবহার করুন।')
    }
  }

  useEffect(() => {
    void startCamera()
    return () => {
      stopStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    setCameraError(null)
    setProgress(0)
    setCaptureReady(false)
    stableFramesRef.current = 0
    lastLumaRef.current = null
    busyRef.current = false
    void startCamera()
  }

  const confirmCapture = () => {
    if (!previewFile) return
    onCapture(previewFile)
  }

  return <div className="fixed inset-0 z-[70] flex h-[100dvh] w-full items-center justify-center bg-ink-900"><div className="flex h-full w-full flex-col bg-surface sm:max-w-3xl sm:max-h-[96dvh] sm:shadow-2xl"><div className="flex shrink-0 items-center justify-between border-b border-outline px-4 py-3"><div><p className="text-xs font-semibold text-brand-700">নিরাপদ ক্যামেরা</p><h2 className="mt-0.5 text-base font-bold text-ink-900">{title}</h2></div><button type="button" onClick={onClose} className="border border-outline p-2 text-ink-600 hover:border-brand-500 hover:text-brand-700" aria-label="ক্যামেরা বন্ধ করুন"><X size={18} /></button></div>{previewUrl ? <div className="flex min-h-0 flex-1 flex-col bg-ink-900"><div className="flex min-h-0 flex-1 items-center justify-center p-3"><img src={previewUrl} alt="ক্যাপচার করা verification preview" className="max-h-full max-w-full object-contain" /></div><div className="shrink-0 space-y-3 bg-surface p-4"><div className="flex items-center gap-2 text-sm font-semibold text-brand-700"><CheckCircle2 size={17} />ছবিটি ঠিক আছে কি না দেখে নিন</div><p className="text-xs leading-5 text-ink-600">চার কোণা, মুখ, লেখা ও নম্বর পরিষ্কার দেখা গেলে ব্যবহার করুন। ঝাপসা বা ভুল হলে আবার ছবি তুলুন।</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={retake} className="inline-flex items-center justify-center gap-1.5 border border-brand-500 px-3 py-3 text-sm font-semibold text-brand-700"><RotateCcw size={16} />আবার তুলুন</button><button type="button" onClick={confirmCapture} className="bg-brand-500 px-3 py-3 text-sm font-semibold text-white hover:bg-brand-600">ছবি ব্যবহার করুন</button></div></div></div> : <><div className="relative flex min-h-0 flex-1 items-center justify-center bg-ink-900 p-3"><video ref={videoRef} className="max-h-full w-full object-contain" playsInline muted /><canvas ref={canvasRef} className="hidden" /><div className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-brand-300/90 ${kind === 'FACE' ? 'aspect-square w-[min(72vw,22rem)] rounded-full' : 'aspect-[1.58/1] w-[min(88vw,34rem)]'}`}><span className="absolute -top-7 left-0 bg-ink-900/80 px-2 py-1 text-xs text-white">{kind === 'FACE' ? 'মুখ' : 'NID front / back'}</span></div>{cameraError && <div className="absolute inset-x-5 bottom-5 border border-red-200 bg-white p-3 text-xs leading-5 text-red-700">{cameraError}</div>}</div><div className="shrink-0 space-y-3 bg-surface p-4"><div className="flex items-center gap-2 text-sm text-ink-700"><Camera size={17} className="text-brand-600" /><span>{status}</span></div><div className="h-1.5 overflow-hidden bg-brand-50"><div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs leading-5 text-ink-500">আলো পরিষ্কার রাখুন, glare ও blur এড়ান। Auto-capture না হলে নিজে ছবি তুলে পরের ধাপে preview দেখে নিশ্চিত করতে পারবেন।</p><button type="button" onClick={() => void captureFrame(true)} disabled={Boolean(cameraError) || busyRef.current} className="w-full bg-brand-500 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50">এখনই ছবি তুলুন</button><p className="flex items-center gap-1 text-xs text-ink-400"><CheckCircle2 size={13} className="text-brand-600" />ছবি submit করার আগে আপনি preview দেখে retake করতে পারবেন।</p></div></>}</div></div>
}
