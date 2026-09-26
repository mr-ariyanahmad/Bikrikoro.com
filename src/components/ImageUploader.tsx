import { useRef } from 'react'
import { validateImageFiles } from '@/lib/fileValidation'
import { BrandLoader } from '@/components/BrandLoader'

export function ImageUploader({
  images,
  onAdd,
  onRemove,
  onError,
  max = 6,
}: {
  images: { url: string; uploading?: boolean }[]
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
  onError?: (message: string) => void
  max?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((img, i) => (
        <div key={i} className="group relative aspect-square overflow-hidden rounded-2xl border border-outline bg-bg shadow-sm">
          <img src={img.url} alt="" className="h-full w-full object-cover" />
          {img.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/40">
              <BrandLoader compact />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900/75 text-xs text-white opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100"
            aria-label="মুছে ফেলুন"
          >
            ✕
          </button>
        </div>
      ))}

      {images.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 text-brand-600 transition hover:border-brand-500 hover:bg-brand-50"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl leading-none shadow-sm">+</span>
          <span className="mt-2 text-xs font-semibold">ছবি যোগ করুন</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          const validationError = validateImageFiles(files, Math.max(0, max - images.length))
          if (validationError) onError?.(validationError)
          else if (files.length) onAdd(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
