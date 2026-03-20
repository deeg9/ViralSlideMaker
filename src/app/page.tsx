import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNavbar } from '@/components/layout/top-navbar'
import { Footer } from '@/components/layout/footer'
import { Icon } from '@/components/ui/icon'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data.user) {
    redirect('/dashboard')
  }

  return (
    <div className="bg-[#fff8f7] text-[#281718] selection:bg-[#fadbdb]">
      <TopNavbar variant="marketing" />

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="px-8 max-w-5xl mx-auto flex flex-col items-center text-center mb-32">
          <span className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-[#7d6161] mb-6">
            Intelligence meets presentation
          </span>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-[-0.02em] text-[#3d0000] leading-[1.1] mb-8 max-w-4xl">
            The future of narrative is <span className="italic">automated.</span>
          </h1>
          <p className="text-lg text-[#55423f] max-w-2xl mb-12">
            ViralSlide transforms your raw thoughts into editorial-grade presentations instantly. No more templates. Just pure intent.
          </p>

          {/* AI Generation Box */}
          <div className="w-full bg-white rounded-2xl shadow-[0px_40px_80px_rgba(61,0,0,0.08)] p-8 md:p-12 border border-[#dbc1bc]/20">
            <div className="mb-8 text-left">
              <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-4 ml-1">
                Presentation Prompt
              </label>
              <div className="relative">
                <textarea
                  className="w-full bg-[#fff0f0] p-6 rounded-xl border border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-1 focus:ring-[#3d0000] transition-all text-lg resize-none placeholder:text-[#dbc1bc]/60"
                  placeholder="Describe your carousel topic... e.g. '5 productivity hacks for remote workers'"
                  rows={5}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[#dbc1bc]/60 uppercase tracking-widest">0 / 500</span>
                  <div className="flex items-center gap-1.5 text-[#dbc1bc]/60">
                    <Icon name="auto_awesome" size="sm" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">AI Assisted</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Picker */}
            <div className="mb-10 text-left">
              <div className="flex justify-between items-end mb-4">
                <label className="text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161]">
                  Choose Template
                </label>
                <button className="text-[0.75rem] font-bold text-[#3d0000] hover:underline">View All</button>
              </div>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 -mx-1 px-1">
                {['Bloom Editorial', 'The Archive', 'Manifesto', 'Systems'].map((name, i) => (
                  <button key={name} className="flex-none w-36 group text-left">
                    <div className={`aspect-[4/3] rounded-lg bg-[#ffe1e1] overflow-hidden mb-2 border-2 ${
                      i === 0
                        ? 'border-[#3d0000] ring-4 ring-[#3d0000]/5'
                        : 'border-transparent hover:border-[#dbc1bc]'
                    } transition-all`}>
                      <div className="w-full h-full flex items-center justify-center text-[#7d6161]">
                        <Icon name="style" size="lg" />
                      </div>
                    </div>
                    <span className={`block text-xs ${i === 0 ? 'font-bold text-[#3d0000]' : 'font-medium text-[#7d6161] group-hover:text-[#3d0000]'}`}>
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button className="w-full bg-[#3d0000] text-white py-5 rounded-xl font-bold tracking-wide flex items-center justify-center gap-3 shadow-[0px_20px_40px_rgba(61,0,0,0.15)] hover:opacity-95 transition-all active:scale-[0.98]">
              Generate Carousel
              <Icon name="auto_awesome" />
            </button>
          </div>
        </section>

        {/* Examples Showcase */}
        <section className="px-8 py-24 bg-[#fff8f7]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-semibold text-[#3d0000] mb-4">Created with ViralSlide</h2>
              <p className="text-[#55423f] max-w-xl mx-auto">
                High-converting carousel content generated in seconds for social creators.
              </p>
            </div>
            <div className="flex gap-8 overflow-x-auto hide-scrollbar pb-8 px-4 -mx-4">
              {/* Mockup 1 */}
              <div className="flex-none w-[320px] aspect-[9/16] rounded-[2rem] bg-[#f8f4ff] border-8 border-white shadow-2xl overflow-hidden relative group">
                <div className="p-8 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-12 h-1 bg-[#d4c5ff] rounded-full" />
                    <h3 className="text-2xl font-bold text-[#4a3b7a] leading-tight">5 Productivity Hacks for Remote Teams</h3>
                    <p className="text-[#7161a8] text-sm">Editorial Pastel Series</p>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/80 backdrop-blur p-4 rounded-2xl border border-white/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4a3b7a] mb-2">Tip #1</p>
                      <p className="text-sm text-[#4a3b7a]">Designate a &apos;Focus Zone&apos; in your home that is solely for deep work.</p>
                    </div>
                    <div className="flex justify-between items-center text-[#4a3b7a]">
                      <span className="text-xs font-bold">Slide 1/6</span>
                      <Icon name="arrow_forward" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mockup 2 */}
              <div className="flex-none w-[320px] aspect-[9/16] rounded-[2rem] bg-[#fff8f7] border-8 border-white shadow-2xl overflow-hidden relative group">
                <div className="p-8 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-12 h-1 bg-[#ca6758] rounded-full" />
                    <h3 className="text-2xl font-semibold text-[#3d0000] leading-tight">The Perfect Morning Wellness Routine</h3>
                    <p className="text-[#7d6161] text-sm italic">Bloom Rose Aesthetic</p>
                  </div>
                  <div className="flex-1 flex items-center justify-center my-4">
                    <div className="w-full aspect-square rounded-xl bg-[#ffe1e1] flex items-center justify-center">
                      <Icon name="spa" size="xl" className="text-[#ca6758]" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[#3d0000]">
                    <span className="text-xs font-bold uppercase tracking-widest">Swipe for more</span>
                    <Icon name="auto_awesome" />
                  </div>
                </div>
              </div>

              {/* Mockup 3 */}
              <div className="flex-none w-[320px] aspect-[9/16] rounded-[2rem] bg-[#1a1a1a] border-8 border-white shadow-2xl overflow-hidden relative">
                <div className="p-8 h-full flex flex-col justify-between text-white">
                  <div className="space-y-4">
                    <div className="w-12 h-1 bg-white/30 rounded-full" />
                    <h3 className="text-2xl font-bold leading-tight">Mastering Digital Minimalism</h3>
                    <p className="text-white/60 text-sm">Monochromatic Series</p>
                  </div>
                  <div className="border-l-2 border-white/20 pl-4 py-2">
                    <p className="text-lg font-light italic">&ldquo;Simplify your life by clearing the noise.&rdquo;</p>
                  </div>
                  <div className="flex justify-between items-center text-white/80">
                    <span className="text-xs font-bold uppercase tracking-widest">Next Slide</span>
                    <Icon name="arrow_forward" />
                  </div>
                </div>
              </div>
            </div>
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
                  <Icon name="grid_view" size="xl" className="text-[#dbc1bc]" />
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

        {/* Testimonials */}
        <section className="px-8 py-24 bg-[#fff8f7]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold text-[#3d0000] mb-4">
                Trusted by the World&apos;s Best Creators
              </h2>
              <p className="text-[#55423f]">Over 15,000 creators use ViralSlide to tell their stories.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: 'Sarah J.', title: '500k on TikTok', quote: 'ViralSlide saved me hours of design work. I used to spend days on one carousel, now it takes me 5 minutes and looks even better.' },
                { name: 'Marcus V.', title: 'LinkedIn Top Voice', quote: 'The layout engine is genuinely intelligent. It understands the hierarchy of my arguments and presents them with professional clarity.' },
                { name: 'Elena K.', title: '200k on Instagram', quote: 'The templates are stunning, but the AI-driven generation is the real magic. It captures my brand voice perfectly every time.' },
              ].map((t) => (
                <div key={t.name} className="bg-[#fff0f0] p-8 rounded-2xl border border-[#dbc1bc]/10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-[#fadbdb] flex items-center justify-center">
                      <Icon name="person" className="text-[#3d0000]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#3d0000]">{t.name}</h4>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-[#7d6161]">{t.title}</p>
                    </div>
                  </div>
                  <div className="flex text-[#ca6758] mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Icon key={i} name="star" size="sm" filled />
                    ))}
                  </div>
                  <p className="text-[#55423f] italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-8 py-32 bg-[#fff8f7] text-center">
          <div className="max-w-3xl mx-auto py-20 bg-[#fadbdb] rounded-2xl">
            <h2 className="text-3xl font-semibold text-[#3d0000] mb-6">Ready to elevate your story?</h2>
            <p className="text-[#55423f] mb-10">
              Join 15,000+ designers and writers who have switched to automated narrative.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-6">
              <input
                className="px-6 py-3 rounded-xl bg-white border-none shadow-sm focus:ring-2 focus:ring-[#3d0000] w-full max-w-sm"
                placeholder="Enter your work email"
                type="email"
              />
              <button className="bg-[#3d0000] text-white px-8 py-3 rounded-xl font-bold active:scale-95 transition-transform">
                Get Access
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
