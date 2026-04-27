import { Icon } from '@/components/ui/icon'

export default function DiscoverPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-[#fadbdb] flex items-center justify-center mb-6">
        <Icon name="explore" size="lg" className="text-[#3d0000]" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#3d0000] mb-2">Discover</h1>
      <p className="text-sm text-[#7d6161] max-w-sm">
        Trending carousels and inspiration from the community. Coming soon.
      </p>
    </div>
  )
}
