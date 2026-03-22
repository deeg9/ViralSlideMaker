"use client"

import { useState, useRef, useCallback } from "react"

interface ShowcaseSlide {
  hook_text: string
  body_text: string
  image: string
}

interface ShowcaseData {
  title: string
  slides: ShowcaseSlide[]
  template: {
    bg: string
    text: string
    accent: string
    hookStyle: string
    overlayOpacity: number
  }
}

const carousels: ShowcaseData[] = [
  {
    title: "5 Productivity Hacks for Remote Teams",
    template: { bg: "#f8f0e3", text: "#1a1a2e", accent: "#c9a96e", hookStyle: "italic", overlayOpacity: 0.85 },
    slides: [
      { hook_text: "Stop Wasting Time on Remote Work!", body_text: "", image: "https://images.pexels.com/photos/5899099/pexels-photo-5899099.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Master Asynchronous Communication", body_text: "Reduce constant interruptions. Use tools like Slack or Notion for updates. Respond when it makes sense, not instantly.", image: "https://images.pexels.com/photos/4065877/pexels-photo-4065877.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Create a Dedicated Workspace", body_text: "Separate work from home life. Even a corner of a room helps. It signals to your brain: 'It's work time now.'", image: "https://images.pexels.com/photos/5882563/pexels-photo-5882563.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Schedule Regular Breaks", body_text: "Don't just power through. Short, intentional breaks every 90 minutes boost focus and prevent burnout.", image: "https://images.pexels.com/photos/1674115/pexels-photo-1674115.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Agendas for ALL Meetings", body_text: "No agenda, no meeting. Simple. Keeps discussions focused and ensures everyone's time is respected.", image: "https://images.pexels.com/photos/3201468/pexels-photo-3201468.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Leverage PM Tools", body_text: "Visualise tasks, track progress, and assign responsibilities clearly. Everyone knows what to do and by when.", image: "https://images.pexels.com/photos/7710203/pexels-photo-7710203.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Boost Your Team's Productivity!", body_text: "Follow for more remote work tips! Save this for later.", image: "https://images.pexels.com/photos/6774139/pexels-photo-6774139.jpeg?auto=compress&cs=tinysrgb&h=350" },
    ],
  },
  {
    title: "The Perfect Morning Wellness Routine",
    template: { bg: "#fff8f7", text: "#3d0000", accent: "#ca6758", hookStyle: "normal", overlayOpacity: 0.8 },
    slides: [
      { hook_text: "YOUR MORNING ROUTINE IS BROKEN", body_text: "But it doesn't have to be.", image: "https://images.pexels.com/photos/7445232/pexels-photo-7445232.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Rehydrate Instantly", body_text: "Drink a large glass of water with lemon. It kickstarts your metabolism and rehydrates after sleep.", image: "https://images.pexels.com/photos/7144993/pexels-photo-7144993.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "10 Minutes of Stillness", body_text: "Meditate, journal, or just sit quietly. No phone. Set intentions and boost your focus for the day.", image: "https://images.pexels.com/photos/6931844/pexels-photo-6931844.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Gentle Movement", body_text: "15-30 mins of light exercise. Yoga, stretching, or a brisk walk. Energizes your body without burnout.", image: "https://images.pexels.com/photos/6697121/pexels-photo-6697121.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Fuel with Whole Foods", body_text: "Prioritize protein and fiber. Think eggs, avocado toast, or a berry smoothie.", image: "https://images.pexels.com/photos/7655895/pexels-photo-7655895.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "READY TO TRANSFORM YOUR MORNINGS?", body_text: "Follow for more wellness tips! Save this post for your new routine.", image: "https://images.pexels.com/photos/6387046/pexels-photo-6387046.jpeg?auto=compress&cs=tinysrgb&h=350" },
    ],
  },
  {
    title: "Mastering Digital Minimalism",
    template: { bg: "#1a1a1a", text: "#ffffff", accent: "#666666", hookStyle: "normal", overlayOpacity: 0.7 },
    slides: [
      { hook_text: "Stop scrolling. Reclaim your focus.", body_text: "Digital overload is real. It's time to take back control of your attention and time.", image: "https://images.pexels.com/photos/3206082/pexels-photo-3206082.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Audit Your Digital Life", body_text: "Uninstall apps you don't truly use. Turn off non-essential notifications. Less noise = more clarity.", image: "https://images.pexels.com/photos/6373086/pexels-photo-6373086.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Define Intentional Use", body_text: "Ask yourself: Why am I using this app right now? Is it serving my goals or just filling time?", image: "https://images.pexels.com/photos/7534746/pexels-photo-7534746.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Create Tech-Free Zones", body_text: "Designate areas or times in your day that are completely digital-free. No phones at dinner. No screens before bed.", image: "https://images.pexels.com/photos/1125130/pexels-photo-1125130.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Batch Your Consumption", body_text: "Set specific times to engage with social media or email. 15 minutes, 2x a day. You'll be surprised how much time you gain.", image: "https://images.pexels.com/photos/6627215/pexels-photo-6627215.jpeg?auto=compress&cs=tinysrgb&h=350" },
      { hook_text: "Ready for more focus?", body_text: "Save this post for later. Follow for daily tips on productivity and mindful living!", image: "https://images.pexels.com/photos/7657398/pexels-photo-7657398.jpeg?auto=compress&cs=tinysrgb&h=350" },
    ],
  },
]

function CarouselCard({ data }: { data: ShowcaseData }) {
  const [current, setCurrent] = useState(0)
  const slide = data.slides[current]
  const { bg, text, accent, overlayOpacity } = data.template
  const touchStartX = useRef<number | null>(null)

  const goNext = useCallback(() => {
    setCurrent((p) => Math.min(data.slides.length - 1, p + 1))
  }, [data.slides.length])

  const goPrev = useCallback(() => {
    setCurrent((p) => Math.max(0, p - 1))
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    const SWIPE_THRESHOLD = 50
    if (diff > SWIPE_THRESHOLD) goNext()
    else if (diff < -SWIPE_THRESHOLD) goPrev()
    touchStartX.current = null
  }, [goNext, goPrev])

  return (
    <div
      className="w-[280px] md:w-[300px] aspect-[9/16] rounded-[2rem] border-8 border-white shadow-2xl overflow-hidden flex-none relative touch-pan-y"
      style={{ backgroundColor: bg, color: text }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
        style={{ backgroundImage: `url(${slide.image})` }}
      />
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: bg, opacity: overlayOpacity }}
      />

      {/* Content */}
      <div className="relative z-10 p-6 h-full flex flex-col justify-between">
        {/* Header */}
        <div className="space-y-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: accent }} />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
            {data.title}
          </p>
        </div>

        {/* Slide Content */}
        <div className="flex-1 flex flex-col justify-center py-6 space-y-4">
          <h3
            className="text-xl font-bold leading-tight"
            style={{
              fontStyle: data.template.hookStyle === "italic" ? "italic" : "normal",
            }}
          >
            {slide.hook_text}
          </h3>
          {slide.body_text && (
            <p className="text-sm leading-relaxed opacity-70">
              {slide.body_text}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
            {current + 1} / {data.slides.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              disabled={current === 0}
              className="w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 hover:opacity-70"
              style={{ backgroundColor: `${text}15` }}
              aria-label="Previous slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={goNext}
              disabled={current === data.slides.length - 1}
              className="w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 hover:opacity-70"
              style={{ backgroundColor: `${text}15` }}
              aria-label="Next slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ShowcaseCarousels() {
  return (
    <div className="flex flex-wrap justify-center gap-8">
      {carousels.map((data, i) => (
        <CarouselCard key={i} data={data} />
      ))}
    </div>
  )
}
