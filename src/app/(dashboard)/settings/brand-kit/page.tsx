import { getBrandKit } from './actions'
import { BrandKitForm } from '@/components/brand-kit/brand-kit-form'

export default async function BrandKitPage() {
  const brandKit = await getBrandKit()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Brand Kit</h1>
      <p className="text-gray-500 mb-8">
        Save your brand colors, font, and logo. These settings apply
        automatically when you generate new carousels.
      </p>
      <BrandKitForm brandKit={brandKit} />
    </div>
  )
}
