import { useEffect, useState } from 'react'
import { CircleAlert, Upload } from 'lucide-react'
import { validateVerificationFile } from '@/lib/fileValidation'
import { inspectVerificationImageQuality } from '@/lib/imageQuality'

export function VerificationDocumentPicker({ documentType, label, file, onSelect, onError }: { documentType: string; label: string; file: File | null; onSelect: (file: File) => void; onError: (message: string) => void }) {
  const [warnings, setWarnings] = useState<string[]>([])
  const isNid = documentType === 'NID_FRONT' || documentType === 'NID_BACK'

  useEffect(() => {
    let active = true
    if (!isNid || !file || !file.type.startsWith('image/')) { setWarnings([]); return }
    void inspectVerificationImageQuality(file).then((result) => { if (active) setWarnings(result?.warnings ?? []) })
    return () => { active = false }
  }, [file, isNid])

  return <div className="mt-3"><label className="block"><span className="sr-only">{label} আপলোড</span><span className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"><Upload size={15} />{file ? 'ফাইল পরিবর্তন করুন' : 'ফাইল নির্বাচন করুন'}<input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0] ?? null; event.target.value = ''; if (!selected) return; const error = validateVerificationFile(selected); if (error) { onError(error); return }; onSelect(selected) }} /></span>{file && <span className="mt-1 block truncate text-xs text-brand-700">{file.name}</span>}</label>{warnings.length > 0 && <div role="status" className="mt-2 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900">{warnings.map((warning) => <p key={warning} className="flex gap-1.5"><CircleAlert size={14} className="mt-0.5 shrink-0" />{warning}</p>)}<p className="pl-5 font-semibold">আপলোড চালিয়ে যেতে পারেন, তবে পরিষ্কার ছবি দিলে যাচাই দ্রুত হবে।</p></div>}</div>
}
