import type { Product } from '@/types/product'

export function getProductDeliverySummary(product: Pick<Product, 'is_digital' | 'auto_delivery_enabled'>) {
  if (!product.is_digital) return 'বিক্রেতার নির্বাচিত শর্ত অনুযায়ী ডেলিভারি হবে।'
  return product.auto_delivery_enabled
    ? 'পেমেন্ট নিশ্চিত হলে ডেলিভারির তথ্য অর্ডার পাতায় নিরাপদে প্রস্তুত হবে।'
    : 'পেমেন্ট নিশ্চিত হলে বিক্রেতা অর্ডার পাতায় নিরাপদে ডেলিভারি সম্পন্ন করবেন।'
}
