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
    <div className="flex flex-wrap gap-3">
      {images.map((img, i) => (
        <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-outline">
          <img src={img.url} alt="" className="h-full w-full object-cover" />
          {img.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/40">
              <BrandLoader compact />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900/70 text-xs text-white"
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
          className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-outline text-ink-300 hover:border-brand-500/40 hover:text-brand-500"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="mt-1 text-xs">ছবি যোগ করুন</span>
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
