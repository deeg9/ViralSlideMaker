import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNavbar } from '@/components/layout/top-navbar'
import { Footer } from '@/components/layout/footer'
import { Icon } from '@/components/ui/icon'
import { SplineScene } from '@/components/ui/splite'
import { Testimonials } from '@/components/landing/testimonials-section'
import { AnimatedWord } from '@/components/landing/animated-word'
import { MouseSparkles } from '@/components/ui/magic-cursor'
import { CpuArchitecture } from '@/components/ui/cpu-architecture'
import { ShowcaseCarousels } from '@/components/landing/showcase-carousel'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data.user) {
    redirect('/dashboard')
  }

  return (
    <div className="bg-[#fff8f7] text-[#281718] selection:bg-[#fadbdb]">
      <MouseSparkles />
      <TopNavbar variant="marketing" />

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="px-8 max-w-7xl mx-auto flex flex-col items-center text-center mb-32">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-[-0.02em] text-[#3d0000] leading-[1.1] mb-8 max-w-4xl">
            The future of content creation is <AnimatedWord />
          </h1>
          <p className="text-lg text-[#55423f] max-w-2xl mb-12">
            Turn your ideas into viral carousels in seconds. No design skills needed.
          </p>

          {/* Side-by-side: Chat Box + Robot */}
          <div className="w-full flex flex-col md:flex-row gap-6 items-stretch">
          {/* Left: AI Generation Box */}
          <div className="flex-1 bg-white rounded-2xl shadow-[0px_40px_80px_rgba(61,0,0,0.08)] p-8 md:p-12 border border-[#dbc1bc]/20">
            <div className="mb-8 text-left">
              <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-4 ml-1">
                Presentation Prompt
              </label>
              <div className="relative">
                <textarea
                  className="w-full bg-[#fff0f0] p-6 rounded-xl border border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000] transition-all text-lg resize-none placeholder:text-[#7d6161]/60"
                  placeholder="Describe your carousel topic... e.g. '5 productivity hacks for remote workers'"
                  rows={5}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[#7d6161]/60 uppercase tracking-widest">0 / 500</span>
                  <div className="flex items-center gap-1.5 text-[#7d6161]/60">
                    <Icon name="auto_awesome" size="sm" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">AI Assisted</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Picker */}
            <div className="mb-10 text-left">
              <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-4">
                Select Visual Style
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'Bold Minimal', bg: '#000000', text: '#ffffff', font: 'sans-serif', hookStyle: 'uppercase' as const },
                  { name: 'Dark Gradient', bg: '#1a1a2e', text: '#ffffff', font: 'sans-serif', hookStyle: 'normal' as const },
                  { name: 'Soft Pastel', bg: '#f8f0e3', text: '#1a1a2e', font: 'serif', hookStyle: 'italic' as const },
                  { name: 'Neon Pop', bg: '#0d0d0d', text: '#ffffff', font: 'sans-serif', hookStyle: 'uppercase' as const },
                ].map((tmpl, i) => (
                  <button key={tmpl.name} className="group text-left">
                    <div className={`aspect-[4/3] rounded-lg overflow-hidden mb-2 border-2 flex items-center justify-center transition-all ${
                      i === 0
                        ? 'border-[#3d0000] ring-4 ring-[#3d0000]/5'
                        : 'border-transparent hover:border-[#dbc1bc]'
                    }`} style={{ backgroundColor: tmpl.bg }}>
                      <span style={{
                        color: tmpl.text,
                        fontFamily: tmpl.font,
                        fontStyle: tmpl.hookStyle === 'italic' ? 'italic' : 'normal',
                        textTransform: tmpl.hookStyle === 'uppercase' ? 'uppercase' : 'none',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                      }}>
                        Aa
                      </span>
                    </div>
                    <span className={`block text-xs ${i === 0 ? 'font-bold text-[#3d0000]' : 'font-medium text-[#7d6161] group-hover:text-[#3d0000]'}`}>
                      {tmpl.name}
                    </span>
                    <span className="block text-[10px] uppercase tracking-widest text-[#dbc1bc]">
                      {i === 0 ? 'Selected' : 'Style'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <a href="/waitlist" className="w-full bg-[#3d0000] text-white py-5 rounded-xl font-bold tracking-wide flex items-center justify-center gap-3 shadow-[0px_20px_40px_rgba(61,0,0,0.15)] hover:opacity-95 transition-all active:scale-[0.98]">
              Generate Carousel
              <Icon name="auto_awesome" />
            </a>
            <p className="text-xs text-[#7d6161] text-center mt-3 flex items-center justify-center gap-1">
              <Icon name="info" size="sm" className="text-[#dbc1bc]" />
              By clicking Generate Carousel, you agree to our <a href="/terms" className="underline hover:text-[#3d0000]">Terms of Service</a>.
            </p>
          </div>

          {/* Right: 3D Robot */}
          <div className="hidden md:flex flex-1 overflow-visible relative min-h-[500px] -mx-12"
            style={{
              maskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black 60%, transparent 95%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black 60%, transparent 95%)',
            }}
          >
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          </div>
          </div>
        </section>

        {/* Examples Showcase */}
        <section className="px-8 py-24 bg-[#fff8f7]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-semibold text-[#3d0000] mb-4">Created with ViralSlideMaker</h2>
              <p className="text-[#55423f] max-w-xl mx-auto">
                High-converting carousel content generated in seconds for social creators.
              </p>
            </div>
            <ShowcaseCarousels />
          </div>
        </section>

        {/* Bento Grid Features */}
        <section className="px-8 py-20 bg-[#fff0f0]">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="text-3xl font-medium tracking-tight text-[#3d0000]">Crafted for Clarification</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 md:h-[600px]">
              {/* Large card */}
              <div className="md:col-span-2 md:row-span-2 bg-white p-10 rounded-xl flex flex-col justify-between">
                <div>
                  <Icon name="auto_awesome" size="xl" className="text-[#3d0000] mb-6" />
                  <h3 className="text-2xl font-semibold mb-4 text-[#3d0000]">Neural Layout Engine</h3>
                  <p className="text-[#55423f] leading-relaxed">
                    Our AI doesn&apos;t just fill templates. It analyzes your content hierarchy and builds custom layouts from scratch, ensuring every point has its place.
                  </p>
                </div>
                <div className="mt-8 overflow-hidden rounded-lg h-48 bg-[#fff0f0] flex items-center justify-center">
                  <CpuArchitecture text="AI" className="text-[#dbc1bc]" />
                </div>
              </div>

              {/* Typography */}
              <div className="md:col-span-2 bg-[#fadbdb] p-10 rounded-xl flex items-center gap-8">
                <div className="flex-1">
                  <Icon name="font_download" size="lg" className="text-[#3d0000] mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-[#3d0000]">Editorial Typography</h3>
                  <p className="text-[#55423f] text-sm">
                    Professional-grade font pairings and perfect white space, automatically applied to every slide.
                  </p>
                </div>
                <div className="hidden sm:flex w-32 h-32 bg-[#3d0000] rounded-xl items-center justify-center">
                  <span className="text-white text-4xl font-bold">Aa</span>
                </div>
              </div>

              {/* Instant Export */}
              <div className="bg-[#fadbdb] p-8 rounded-xl flex flex-col justify-center text-center">
                <Icon name="bolt" size="lg" className="text-[#3d0000] mb-4 mx-auto" />
                <h3 className="text-lg font-semibold text-[#3d0000]">Instant Export</h3>
                <p className="text-xs text-[#55423f] mt-2">PDF, PPTX, or Live Web Link.</p>
              </div>

              {/* Brand DNA */}
              <div className="bg-white p-8 rounded-xl flex flex-col justify-center text-center">
                <Icon name="palette" size="lg" className="text-[#3d0000] mb-4 mx-auto" />
                <h3 className="text-lg font-semibold text-[#3d0000]">Brand DNA</h3>
                <p className="text-xs text-[#55423f] mt-2">Matches your brand colors instantly.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials — Scrolling Columns */}
        <Testimonials />

      </main>

      <Footer />
    </div>
  )
}
