import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

export const metadata = {
  title: 'Resources — ViralSlideMaker',
  description:
    'The viral-carousel playbook: hook formulas, slide structure, text-legibility rules, and how to ship faster with templates and your brand kit.',
}

interface HookExample {
  pattern: string
  example: string
}

const hookExamples: HookExample[] = [
  {
    pattern: 'The Question',
    example: 'Why do 90% of carousels flop in the first 2 seconds?',
  },
  {
    pattern: 'The Bold Claim',
    example: 'Stop posting Reels. Carousels get 1.9× more reach.',
  },
  {
    pattern: 'The Stat',
    example: '8–10 slide carousels hit 10%+ engagement. Yours has 4.',
  },
  {
    pattern: 'The Transformation',
    example: 'I went from 200 to 40k followers with this exact carousel.',
  },
]

const ctaExamples = [
  '"Save this for later — you’ll need it."',
  '"Tag a friend who keeps scrolling past their dreams."',
  '"Comment LINK and I’ll DM the template."',
  '"Follow for a new viral framework every week."',
]

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-12">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fadbdb] flex items-center justify-center">
            <Icon name="auto_awesome" className="text-[#3d0000]" />
          </div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#7d6161]">
            Creator Playbook
          </p>
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#3d0000] leading-tight">
          Make slides people can’t stop swiping.
        </h1>
        <p className="text-base text-[#7d6161] max-w-2xl">
          A short, opinionated guide to viral carousels — the hooks, the math,
          the design rules — plus how to ship them in minutes with
          ViralSlideMaker.
        </p>
      </header>

      {/* Stat strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="More reach than static" value="1.9×" hint="vs single-image posts" />
        <StatCard label="Sweet-spot slide count" value="8–10" hint="per Instagram engagement studies" />
        <StatCard label="Time on slide 1" value="~2 sec" hint="to earn the swipe" />
      </section>

      {/* 1. The Hook Rule */}
      <Section
        number="01"
        icon="bolt"
        title="The hook rule: earn the second slide"
        body="Your first slide has ~2 seconds to convince someone to swipe. Strong hooks hit 60–80% swipe-through; weak ones don’t crack 20%. The mechanic that wins is the curiosity gap — promise something they want to know, then make them swipe to get it."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hookExamples.map((h) => (
            <div
              key={h.pattern}
              className="bg-white rounded-xl border border-[#dbc1bc]/40 p-5"
            >
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-[#7d6161]">
                {h.pattern}
              </p>
              <p className="text-[#3d0000] font-semibold mt-2 leading-snug">
                {h.example}
              </p>
            </div>
          ))}
        </div>
        <Tip>
          Don’t reveal everything on slide 1. Tease the payoff so slide 2 has
          something to do.
        </Tip>
      </Section>

      {/* 2. Make text pop */}
      <Section
        number="02"
        icon="text_fields"
        title="Make text pop on a 6-inch screen"
        body="Almost every swipe happens on a phone, often outside in bright light. Treat your slides like billboards, not documents."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RuleCard
            icon="format_size"
            title="Big, simple type"
            body="Headlines 36px+, body 24px+. Sans-serif (Inter, Helvetica, Montserrat). Skip script and thin weights."
          />
          <RuleCard
            icon="contrast"
            title="High contrast"
            body="Aim for WCAG AA (4.5:1). Dark text on light, or white text on a dimmed photo overlay. Never gray-on-gray."
          />
          <RuleCard
            icon="format_align_left"
            title="Left-align, one idea"
            body="Left-aligned text scans faster than centered. Limit each slide to one idea, 10–15 words max."
          />
          <RuleCard
            icon="grid_view"
            title="Breathe with whitespace"
            body="Empty space is a feature, not a bug. Margins around the text give the eye somewhere to land."
          />
        </div>
      </Section>

      {/* 3. Structure */}
      <Section
        number="03"
        icon="view_carousel"
        title="Structure: hook → tension → payoff → CTA"
        body="Carousels with 8–10 slides hit the highest engagement. Engagement dips around slide 3 and rebounds at slide 8 — that’s where saves and shares happen."
      >
        <div className="bg-white rounded-2xl border border-[#dbc1bc]/40 p-6">
          <ol className="space-y-4">
            <StructureStep
              n={1}
              title="Hook"
              body="Curiosity-gap headline. Bold visual. One claim."
            />
            <StructureStep
              n={2}
              title="Why it matters"
              body="Instagram sometimes re-serves slide 2 — make it stand alone."
            />
            <StructureStep
              n="3–7"
              title="Tension & teaching"
              body="One idea per slide. Each slide ends with a reason to swipe."
            />
            <StructureStep
              n="8–9"
              title="The payoff"
              body="Deliver the promise from slide 1. This is where saves spike."
            />
            <StructureStep
              n={10}
              title="CTA"
              body="Tell them exactly what to do next: save, share, tag, comment."
            />
          </ol>
        </div>
      </Section>

      {/* 4. Last slide CTAs */}
      <Section
        number="04"
        icon="campaign"
        title="The last slide is a CTA, not a goodbye"
        body="Saves, shares, and comments are the engagement signals the algorithm rewards most. Every viral carousel earns them on slide N — usually with a single, specific instruction."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ctaExamples.map((cta) => (
            <div
              key={cta}
              className="bg-[#fff0f0] rounded-xl p-4 text-[#3d0000] text-sm leading-relaxed border border-[#fadbdb]"
            >
              {cta}
            </div>
          ))}
        </div>
        <Tip>
          Pick <strong>one</strong> action per post. Asking for save AND share
          AND follow gets you none of them.
        </Tip>
      </Section>

      {/* 5. App playbook */}
      <Section
        number="05"
        icon="rocket_launch"
        title="The ViralSlideMaker shortcut"
        body="The fastest path from idea to posted carousel:"
      >
        <div className="space-y-3">
          <AppStep
            icon="travel_explore"
            title="Start from a proven template"
            body="Browse Explore for carousels that already went viral. Tap any tile to see the full deck — the Remix button forks it into a new project so you can keep the structure and swap in your topic."
            cta={{ label: 'Browse Explore', href: '/explore' }}
          />
          <AppStep
            icon="palette"
            title="Lock in your Brand Kit once"
            body="Set your fonts, accent color, text alignment, and overlay opacity in your Brand Kit. Apply it as a single-click style on every new project — your slides stop looking like a template and start looking like you."
            cta={{ label: 'Set up Brand Kit', href: '/settings/brand-kit' }}
          />
          <AppStep
            icon="branding_watermark"
            title="Add your logo as a watermark"
            body="Upload a logo, pick one of nine positions, and it auto-applies to every slide. Hide it on individual slides where it would crowd the design."
          />
          <AppStep
            icon="bolt"
            title="Go from 3 → 10 slides"
            body="Free projects cap at 3 slides — perfect for testing a hook. Upgrade unlocks the full 10-slide format that hits the engagement sweet spot."
          />
          <AppStep
            icon="download"
            title="Export the ZIP, post natively"
            body="Download every slide as a numbered PNG zip, then upload directly to Instagram or TikTok’s photo carousel. Don’t screenshot — the export is sharper."
          />
        </div>
      </Section>

      {/* 6. Quick checklist */}
      <Section
        number="06"
        icon="checklist"
        title="The pre-post checklist"
        body="Before you hit publish, run the deck through this:"
      >
        <ul className="bg-white rounded-2xl border border-[#dbc1bc]/40 p-6 space-y-3">
          {[
            'Slide 1 has a curiosity gap — I want to know the answer.',
            'Each slide says one thing. Out loud, in one breath.',
            'Body text is at least 24px and high-contrast.',
            'Slides 8–10 deliver the payoff promised on slide 1.',
            'Last slide asks for one specific action (save, tag, comment, follow).',
            'Caption hooks on its first line — readable before the "more" cutoff.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-[#3d0000]">
              <Icon name="check_circle" className="text-[#3d0000] mt-0.5" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Final CTA */}
      <section className="bg-[#3d0000] text-white rounded-3xl p-10 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#fadbdb]">
            Your turn
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            Pick a template. Ship in five minutes.
          </h2>
          <p className="text-sm text-[#fadbdb]/80">
            The fastest viral carousel is the one you actually post. Start from
            something that worked — then make it yours.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 bg-white text-[#3d0000] px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#fadbdb] transition-colors"
          >
            <Icon name="travel_explore" size="sm" />
            Browse templates
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-[#5a0000] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#7a0000] transition-colors border border-[#fadbdb]/20"
          >
            <Icon name="add" size="sm" />
            Start a new carousel
          </Link>
        </div>
      </section>
    </div>
  )
}

/* --- Building blocks (kept local — page-specific, not a design system) --- */

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-[#fff0f0] rounded-xl p-6">
      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-[#7d6161]">
        {label}
      </p>
      <p className="text-3xl font-semibold text-[#3d0000] mt-2">{value}</p>
      <p className="text-xs text-[#7d6161] mt-1">{hint}</p>
    </div>
  )
}

function Section({
  number,
  icon,
  title,
  body,
  children,
}: {
  number: string
  icon: string
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[0.7rem] font-bold tracking-[0.2em] text-[#7d6161]">
            {number}
          </span>
          <div className="h-px flex-1 bg-[#dbc1bc]/40" />
          <Icon name={icon} className="text-[#3d0000]" />
        </div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#3d0000]">
          {title}
        </h2>
        <p className="text-sm md:text-base text-[#7d6161] max-w-3xl leading-relaxed">
          {body}
        </p>
      </div>
      {children}
    </section>
  )
}

function RuleCard({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#dbc1bc]/40 p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="text-[#3d0000]" />
        <h3 className="font-semibold text-[#3d0000]">{title}</h3>
      </div>
      <p className="text-sm text-[#7d6161] leading-relaxed">{body}</p>
    </div>
  )
}

function StructureStep({
  n,
  title,
  body,
}: {
  n: number | string
  title: string
  body: string
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#fadbdb] text-[#3d0000] font-semibold text-sm flex items-center justify-center">
        {n}
      </span>
      <div className="pt-1">
        <p className="font-semibold text-[#3d0000]">{title}</p>
        <p className="text-sm text-[#7d6161] leading-relaxed">{body}</p>
      </div>
    </li>
  )
}

function AppStep({
  icon,
  title,
  body,
  cta,
}: {
  icon: string
  title: string
  body: string
  cta?: { label: string; href: string }
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#dbc1bc]/40 p-6 flex flex-col md:flex-row gap-5 md:items-center">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#fff0f0] flex items-center justify-center">
        <Icon name={icon} className="text-[#3d0000]" size="lg" />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="font-semibold text-[#3d0000]">{title}</h3>
        <p className="text-sm text-[#7d6161] leading-relaxed">{body}</p>
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3d0000] hover:text-[#7a0000] flex-shrink-0"
        >
          {cta.label}
          <Icon name="arrow_forward" size="sm" />
        </Link>
      )}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-[#fff0f0] rounded-xl p-4 border border-[#fadbdb]">
      <Icon name="lightbulb" className="text-[#3d0000] mt-0.5" />
      <p className="text-sm text-[#3d0000] leading-relaxed">{children}</p>
    </div>
  )
}
