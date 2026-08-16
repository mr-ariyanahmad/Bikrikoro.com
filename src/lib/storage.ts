import { supabase } from '@/lib/supabase'

const PRODUCT_BUCKET = 'product-images'
const DISPUTE_BUCKET = 'dispute-evidence' // matches SupabaseStorageHelper.uploadDisputeEvidence on Android

/** Uploads File objects to the same `product-images` bucket the Android app uses, returns public URLs. */
export async function uploadProductImages(files: File[], sellerId: string): Promise<string[]> {
  return uploadTo(PRODUCT_BUCKET, files, sellerId)
}

/** Uploads dispute evidence photos, keyed by orderId like the Android side. */
export async function uploadDisputeEvidence(files: File[], orderId: string): Promise<string[]> {
  return uploadTo(DISPUTE_BUCKET, files, orderId)
}

async function uploadTo(bucket: string, files: File[], ownerFolder: string): Promise<string[]> {
  const urls: string[] = []

  for (const file of files) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${ownerFolder}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) throw error

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    urls.push(data.publicUrl)
  }

  return urls
}
