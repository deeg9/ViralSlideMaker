import { getBrandKit } from './actions'
import { BrandKitForm } from '@/components/brand-kit/brand-kit-form'
import { Icon } from '@/components/ui/icon'

export default async function BrandKitPage() {
  const brandKit = await getBrandKit()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="palette" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Brand Kit</h1>
          <p className="text-sm text-[#7d6161]">
            Save your brand colors, font, and logo. These apply automatically to new carousels.
          </p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-8 border border-[#dbc1bc]/10">
        <BrandKitForm brandKit={brandKit} />
      </div>
    </div>
  )
}
