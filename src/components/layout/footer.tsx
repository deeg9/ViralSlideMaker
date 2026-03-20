import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-[#fff8f7] w-full border-t-0 py-16">
      <div className="flex flex-col md:flex-row justify-between items-center px-12 max-w-7xl mx-auto gap-12 md:gap-0">
        <div className="flex flex-col items-center md:items-start">
          <div className="flex items-center gap-2 mb-4">
            <Image src="/logo.png" alt="ViralSlideMaker" width={24} height={24} className="rounded" />
            <span className="text-sm font-bold uppercase tracking-widest text-[#3d0000]">ViralSlideMaker</span>
          </div>
          <p className="text-xs text-[#7d6161]">&copy; 2026 ViralSlideMaker. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          <Link className="text-xs text-[#7d6161] hover:text-[#3d0000] transition-colors" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="text-xs text-[#7d6161] hover:text-[#3d0000] transition-colors" href="/terms">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}
