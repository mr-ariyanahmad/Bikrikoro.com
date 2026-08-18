export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export function validateImageFiles(files: File[], maxCount: number) {
  if (files.length > maxCount) return `সর্বোচ্চ ${maxCount}টি ছবি যোগ করা যাবে।`
  const invalidType = files.find((file) => !file.type.startsWith('image/'))
  if (invalidType) return 'শুধু image file আপলোড করা যাবে।'
  const oversized = files.find((file) => file.size > MAX_IMAGE_BYTES)
  if (oversized) return 'প্রতিটি ছবির size সর্বোচ্চ ৫ MB হতে হবে।'
  return null
}

export function validateEvidenceFiles(files: File[], maxCount: number) {
  if (files.length > maxCount) return `সর্বোচ্চ ${maxCount}টি evidence ছবি যোগ করা যাবে।`
  const invalidType = files.find((file) => !file.type.startsWith('image/'))
  if (invalidType) return 'Evidence হিসেবে শুধু image file আপলোড করা যাবে।'
  const oversized = files.find((file) => file.size > MAX_IMAGE_BYTES)
  if (oversized) return 'প্রতিটি evidence ছবির size সর্বোচ্চ ৫ MB হতে হবে।'
  return null
}

export function validateVerificationFile(file: File) {
  const allowed = file.type.startsWith('image/') || file.type === 'application/pdf'
  if (!allowed) return 'Document হিসেবে শুধু image বা PDF file আপলোড করা যাবে।'
  if (file.size > MAX_DOCUMENT_BYTES) return 'প্রতিটি document-এর size সর্বোচ্চ ১০ MB হতে হবে।'
  return null
}
