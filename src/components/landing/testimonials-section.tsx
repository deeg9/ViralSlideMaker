"use client"

import { TestimonialsColumn, type Testimonial } from './testimonials-columns'

const column1: Testimonial[] = [
  {
    text: "honestly VSM cut my content time by like 80%?? i used to spend a full day on one carousel lol. now i batch 10 in an hour.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Sarah Mitchell",
    role: "TikTok Creator, 500k followers",
  },
  {
    text: "my engagement literally doubled the first week. the AI just gets what performs on social, idk how to explain it.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "David Chen",
    role: "Content Strategist",
  },
  {
    text: "we use ViralSlideMaker for every client at the agency now. it's basically become our Canva replacement for carousels.",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Priya Sharma",
    role: "Marketing Agency Owner",
  },
  {
    text: "the templates look great but honestly what sold me is how the AI structures everything. it actually understands storytelling which is wild.",
    image: "https://randomuser.me/api/portraits/men/75.jpg",
    name: "Alex Torres",
    role: "Freelance Designer",
  },
]

const column2: Testimonial[] = [
  {
    text: "the layout engine genuinely understands content hierarchy. presents my arguments way clearer than i could do manually tbh.",
    image: "https://randomuser.me/api/portraits/men/55.jpg",
    name: "Marcus Williams",
    role: "LinkedIn Top Voice",
  },
  {
    text: "went from 2k to 50k in three months. VSM carousels are my not-so-secret weapon at this point lol.",
    image: "https://randomuser.me/api/portraits/women/17.jpg",
    name: "Jordan Kim",
    role: "Business Coach",
  },
  {
    text: "the brand kit feature is a game changer fr. every slide matches my brand colors and fonts without me touching anything.",
    image: "https://randomuser.me/api/portraits/women/90.jpg",
    name: "Nina Patel",
    role: "Brand Consultant",
  },
  {
    text: "my team does 20+ carousels a week now. before ViralSlideMaker we could barely manage 5. the ROI is nuts.",
    image: "https://randomuser.me/api/portraits/men/11.jpg",
    name: "Tom Anderson",
    role: "Social Media Manager",
  },
]

const column3: Testimonial[] = [
  {
    text: "i've tried every carousel tool out there. VSM is the only one where i actually post without editing the output first.",
    image: "https://randomuser.me/api/portraits/women/3.jpg",
    name: "Elena Kowalski",
    role: "Instagram Creator, 200k",
  },
  {
    text: "export quality is insane. clients literally can't tell the difference between my VSM carousels and custom agency work.",
    image: "https://randomuser.me/api/portraits/men/86.jpg",
    name: "Chris Liu",
    role: "Tech Influencer",
  },
  {
    text: "i repurpose blog posts into carousels in like 2 minutes. paste, pick a template, generate. almost too easy.",
    image: "https://randomuser.me/api/portraits/women/26.jpg",
    name: "Mia Rodriguez",
    role: "Course Creator",
  },
  {
    text: "my coaching clients are blown away when i show them carousels i made in minutes. makes me look like a design pro ngl.",
    image: "https://randomuser.me/api/portraits/men/46.jpg",
    name: "Ryan Park",
    role: "Online Educator",
  },
]

export function Testimonials() {
  return (
    <section className="px-8 py-24 bg-[#fff8f7]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#3d0000] mb-4">
            Trusted and Loved by Creators
          </h2>
          <p className="text-[#55423f]">Over 15,000 creators use ViralSlideMaker to tell their stories.</p>
        </div>
        <div className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[700px] overflow-hidden">
          <TestimonialsColumn testimonials={column1} duration={15} className="hidden md:block" />
          <TestimonialsColumn testimonials={column2} duration={19} />
          <TestimonialsColumn testimonials={column3} duration={17} className="hidden lg:block" />
        </div>
      </div>
    </section>
  )
}
