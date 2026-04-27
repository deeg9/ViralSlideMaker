import { Icon } from '@/components/ui/icon'

export default function ResourcesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-[#fadbdb] flex items-center justify-center mb-6">
        <Icon name="science" size="lg" className="text-[#3d0000]" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#3d0000] mb-2">Resources</h1>
      <p className="text-sm text-[#7d6161] max-w-sm">
        Templates, guides, and creator tools. Coming soon.
      </p>
    </div>
  )
}
