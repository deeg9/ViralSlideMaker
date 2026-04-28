import { NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTemplate } from '@/lib/render/templates/index'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import type { Slide } from '@/lib/types/slide'

export const maxDuration = 300

const DIEGO_USER_ID = 'ed8ca688-ec50-4c8c-834e-1b9f562eee8a'
const SEED_PREFIX = '[seed] '

interface SeedEntry {
  templateId: string
  title: string
  description: string
  tags: string[]
  slides: Slide[]
}

const PEXELS = {
  productivity: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  sleep: 'https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  fitness: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  finance: 'https://images.pexels.com/photos/315788/pexels-photo-315788.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  mindset: 'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  storytime: 'https://images.pexels.com/photos/3771074/pexels-photo-3771074.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  cooking: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  travel: 'https://images.pexels.com/photos/2356045/pexels-photo-2356045.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  tech: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  design: 'https://images.pexels.com/photos/196645/pexels-photo-196645.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  humor: 'https://images.pexels.com/photos/3812944/pexels-photo-3812944.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  tutorial: 'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
}

function makeSlide(hook: string, body: string, image: string, isCta = false): Slide {
  return {
    hook_text: hook,
    body_text: body,
    image_query: '',
    is_cta: isCta,
    background_url: image,
    pexels_photo_id: null,
  }
}

const SEED_ENTRIES: SeedEntry[] = [
  {
    templateId: 'bold-minimal',
    title: '5 Habits That Saved My Mornings',
    description: 'Tiny tweaks I made over 30 days that doubled my deep work output.',
    tags: ['productivity', 'hooks', 'mindset'],
    slides: [
      makeSlide('STOP HITTING SNOOZE.', 'Here are 5 morning habits that changed everything for my focus.', PEXELS.productivity),
      makeSlide('1. NO PHONE FOR 30 MIN', 'The first thing you see in the morning sets the entire tone of your day.', PEXELS.mindset),
      makeSlide('2. DRINK 16OZ OF WATER', 'You wake up dehydrated. Hydrate before caffeine — your brain will thank you.', PEXELS.fitness),
      makeSlide('3. 2-MIN COLD SHOWER', 'Releases dopamine for hours. The hardest thing you do all day, done first.', PEXELS.sleep),
      makeSlide('4. WRITE THE 3 BIG ONES', 'Three priorities. Not ten. Three. Everything else is noise.', PEXELS.tutorial),
      makeSlide('5. MOVE FOR 10 MINUTES', 'Walk, stretch, lift. Doesn’t matter what — just move before email.', PEXELS.fitness),
      makeSlide('FOLLOW FOR MORE', 'New routines every Sunday. Save this one for tomorrow morning.', PEXELS.productivity, true),
    ],
  },
  {
    templateId: 'dark-gradient',
    title: 'How I Sleep 8 Hours Every Night',
    description: 'The boring routine that beat my insomnia in 2 weeks.',
    tags: ['sleep', 'mindset', 'tutorial'],
    slides: [
      makeSlide('I SLEPT 4 HOURS A NIGHT', 'For two years. Until I rebuilt my evening from scratch.', PEXELS.sleep),
      makeSlide('PHONE OUT OF THE BEDROOM', 'Buy a $15 alarm clock. Charge your phone in the kitchen.', PEXELS.tech),
      makeSlide('SAME BEDTIME. EVERY NIGHT.', 'Within 30 minutes. Your body learns the rhythm faster than you think.', PEXELS.sleep),
      makeSlide('NO CAFFEINE AFTER 2PM', 'Half-life is 6 hours. That 3pm coffee is still active at midnight.', PEXELS.cooking),
      makeSlide('COOL ROOM, WARM SOCKS', 'Drop the thermostat to 65. Wear socks. Trust me.', PEXELS.sleep),
      makeSlide('SAVE FOR YOUR INSOMNIA', 'You don’t need pills. You need a routine.', PEXELS.mindset, true),
    ],
  },
  {
    templateId: 'soft-pastel',
    title: 'A Beginner’s Guide to Investing $100',
    description: 'No jargon, no apps you don’t need. Just the basics.',
    tags: ['finance', 'tutorial'],
    slides: [
      makeSlide('I started with $100.', 'Not a fortune. Not a get-rich-quick. Just consistency.', PEXELS.finance),
      makeSlide('Step 1: Pay yourself first.', 'Auto-transfer 10% of every paycheck the day it lands.', PEXELS.finance),
      makeSlide('Step 2: Index funds.', 'VTI, VOO, or your country’s equivalent. Boring beats exciting.', PEXELS.tech),
      makeSlide('Step 3: Don’t check it daily.', 'You’re investing for 30 years, not 30 days.', PEXELS.mindset),
      makeSlide('Step 4: Increase 1% yearly.', 'Compound your habits, not just your money.', PEXELS.productivity),
      makeSlide('Save and start tomorrow.', 'Future you will thank present you.', PEXELS.finance, true),
    ],
  },
  {
    templateId: 'neon-pop',
    title: 'POV: You Just Got Your First DSLR',
    description: 'Five settings to never touch as a beginner.',
    tags: ['design', 'tutorial', 'tech'],
    slides: [
      makeSlide('JUST BOUGHT A DSLR?', 'These are the 5 settings I wish someone told me to ignore.', PEXELS.design),
      makeSlide('1. SHOOT IN MANUAL', 'Aperture priority is fine. Manual is for control freaks.', PEXELS.tutorial),
      makeSlide('2. RAW VS JPEG', 'RAW is bigger but recoverable. Always shoot RAW.', PEXELS.tech),
      makeSlide('3. NEVER ZOOM IN POST', 'Crop sparingly. Move your feet.', PEXELS.design),
      makeSlide('4. FORGET PRESETS', 'Learn the histogram first. Filters are a crutch.', PEXELS.tutorial),
      makeSlide('5. TAKE 100 BAD PHOTOS', 'Then 100 better ones. Then 100 great ones.', PEXELS.mindset, true),
    ],
  },
  {
    templateId: 'clean-serif',
    title: 'The Quiet Joys of Travel',
    description: 'Six tiny things that made my year of nomadic life worth it.',
    tags: ['travel', 'storytime', 'mindset'],
    slides: [
      makeSlide('I lived out of a backpack for a year.', 'These are the moments I keep coming back to.', PEXELS.travel),
      makeSlide('Coffee in a strange city.', 'You don’t know the language. The barista smiles anyway.', PEXELS.cooking),
      makeSlide('A train without WiFi.', 'You finally read the book. The countryside finally watches back.', PEXELS.travel),
      makeSlide('Dinner with strangers.', 'They invited you because you were alone. You stay until 1 AM.', PEXELS.storytime),
      makeSlide('A sunset you didn’t plan.', 'You turn the corner and the sky cracks open.', PEXELS.travel),
      makeSlide('Fork to start your own list.', 'Travel writes you. You don’t write travel.', PEXELS.mindset, true),
    ],
  },
  {
    templateId: 'news-drop',
    title: 'BREAKING: AI Just Wrote a Hit Song',
    description: 'And it charted. Here’s why that matters for every creator.',
    tags: ['tech', 'storytime'],
    slides: [
      makeSlide('AI WROTE A TOP-10 SONG', 'Last week, no one knew. This week, every label is panicking.', PEXELS.tech),
      makeSlide('IT TOOK 12 MINUTES.', 'Lyrics, melody, mix. The producer didn’t touch a fader.', PEXELS.tech),
      makeSlide('LISTENERS DIDN’T KNOW.', 'They voted it song of the week. The artist? Doesn’t exist.', PEXELS.mindset),
      makeSlide('WHAT THIS MEANS FOR YOU', 'Taste is the only moat now. Tools are commoditized overnight.', PEXELS.design),
      makeSlide('SAVE THIS POST', 'Bookmark for the inevitable industry shake-up.', PEXELS.tech, true),
    ],
  },
  {
    templateId: 'news-cyan',
    title: 'The Productivity App Industry Is Dying',
    description: 'And the tool that’s replacing all of them is older than you think.',
    tags: ['tech', 'productivity', 'tutorial'],
    slides: [
      makeSlide('PRODUCTIVITY APPS ARE DYING', 'Notion, Asana, Monday — user growth is flat across the board.', PEXELS.tech),
      makeSlide('WHY? TOO MANY FEATURES.', 'You spend more time configuring than doing the work.', PEXELS.productivity),
      makeSlide('THE REPLACEMENT?', 'A pen. A notebook. A weekly review. That’s it.', PEXELS.mindset),
      makeSlide('STUDY: 41% MORE OUTPUT', 'When professionals switched from apps to paper for two weeks.', PEXELS.tutorial),
      makeSlide('TRY IT FOR ONE WEEK', 'Cancel the subscriptions. Buy a $5 notebook. See what happens.', PEXELS.productivity, true),
    ],
  },
  {
    templateId: 'highlight-bar',
    title: 'Mindset Tricks That Actually Worked',
    description: 'Stoicism without the bro-speak.',
    tags: ['mindset', 'storytime'],
    slides: [
      makeSlide('STOICISM, BUT NORMAL', '5 mental tricks that survived my hardest year.', PEXELS.mindset),
      makeSlide('NAME THE FEELING', 'Anxious? Say it out loud. The brain calms within seconds.', PEXELS.mindset),
      makeSlide('THE 10/10/10 RULE', 'Will this matter in 10 minutes? 10 months? 10 years?', PEXELS.productivity),
      makeSlide('MEMENTO MORI', 'You’ll be dead. Most things stop mattering.', PEXELS.mindset),
      makeSlide('CONTROL VS CONCERN', 'Worried about it? Can you change it? If no, drop it.', PEXELS.mindset),
      makeSlide('SAVE THIS FOR TUESDAY', 'You’ll need it.', PEXELS.mindset, true),
    ],
  },
  {
    templateId: 'magazine',
    title: 'Inside the Studio of a Working Designer',
    description: 'A Tuesday in the life of someone who ships every week.',
    tags: ['design', 'storytime', 'tutorial'],
    slides: [
      makeSlide('Inside a designer’s Tuesday.', 'No glamour. Just the actual day.', PEXELS.design),
      makeSlide('7:30am — Coffee + sketch', 'Pen on paper for 20 minutes. No screens.', PEXELS.cooking),
      makeSlide('9:00am — Deep work block', 'Two hours, phone in another room. The actual designing happens here.', PEXELS.design),
      makeSlide('12:00pm — Walk + voice notes', 'Best ideas show up between bites of a sandwich.', PEXELS.travel),
      makeSlide('3:00pm — Critique + revise', 'Show the work. Take the punches. Fix what’s broken.', PEXELS.design),
      makeSlide('Save the studio routine.', 'Try it for one week. Measure your output.', PEXELS.tutorial, true),
    ],
  },
  {
    templateId: 'quote-card',
    title: 'Quotes I Read Once a Week',
    description: 'The 7 lines that have steered my career for a decade.',
    tags: ['mindset', 'storytime'],
    slides: [
      makeSlide('"Discipline equals freedom."', '— Jocko Willink. Read this one out loud.', PEXELS.mindset),
      makeSlide('"You can’t cheat the work."', '— Steven Pressfield, The War of Art.', PEXELS.productivity),
      makeSlide('"Comparison is the thief of joy."', '— Theodore Roosevelt. Especially online.', PEXELS.mindset),
      makeSlide('"Make it work, then make it pretty."', '— every senior engineer ever.', PEXELS.tutorial),
      makeSlide('"The cave you fear..."', '"...holds the treasure you seek." — Joseph Campbell.', PEXELS.travel),
      makeSlide('Bookmark for hard weeks.', 'You’ll have them. These help.', PEXELS.mindset, true),
    ],
  },
  {
    templateId: 'y2k-pop',
    title: 'My 90s Childhood, Ranked',
    description: 'No one asked. I made a list anyway.',
    tags: ['humor', 'storytime'],
    slides: [
      makeSlide('I WAS A 90s KID.', 'Ranking the things that defined my childhood.', PEXELS.humor),
      makeSlide('5. SLAP BRACELETS.', 'Briefly amazing. Briefly dangerous. Briefly banned.', PEXELS.humor),
      makeSlide('4. POG SLAMMERS.', 'Currency in elementary school. Worthless by 1996.', PEXELS.storytime),
      makeSlide('3. BLOCKBUSTER FRIDAYS.', 'A whole experience. Be kind, rewind.', PEXELS.storytime),
      makeSlide('2. SATURDAY CARTOONS.', 'You woke up at 6am. By choice.', PEXELS.humor),
      makeSlide('1. DIAL-UP INTERNET.', 'You had to choose: phone calls or AOL. We didn’t survive. We thrived.', PEXELS.tech),
      makeSlide('Add yours in comments.', 'I want to hear what beat dial-up.', PEXELS.humor, true),
    ],
  },
  {
    templateId: 'bold-yellow',
    title: 'Things I’d Tell My Younger Self',
    description: 'A letter from 35 to 22.',
    tags: ['mindset', 'storytime'],
    slides: [
      makeSlide('DEAR 22-YEAR-OLD ME', 'Read this when you don’t feel ready. (You won’t feel ready.)', PEXELS.storytime),
      makeSlide('SAY YES MORE.', 'The dumb meetings, the awkward dinners. That’s where it happens.', PEXELS.mindset),
      makeSlide('DON’T DEFEND YOURSELF.', 'When someone misjudges you, let your work do the talking.', PEXELS.productivity),
      makeSlide('DATE THE QUIET ONE.', 'You know which one. You’re ignoring them.', PEXELS.storytime),
      makeSlide('CALL YOUR PARENTS.', 'They’re not always going to pick up.', PEXELS.mindset),
      makeSlide('YOU TURN OUT FINE.', 'Don’t blow it. Save this and re-read at 25.', PEXELS.mindset, true),
    ],
  },
]

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'carousel'
  )
}

function nanoidSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

async function renderHero(slide: Slide, templateId: string, origin: string): Promise<Buffer> {
  const template = getTemplate(templateId)
  const effectiveTemplate = mergeWithBrandKit(template, null)
  const element = buildSlideElement(slide, effectiveTemplate, null, 'free', origin)
  const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)
  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })
  return Buffer.from(await imageResponse.arrayBuffer())
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Refusing to seed in production' }, { status: 403 })
  }

  const expectedToken = process.env.ADMIN_SEED_TOKEN
  const auth = request.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!expectedToken || provided !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const origin = new URL(request.url).origin

  const seeded: Array<{ slug: string; title: string; templateId: string }> = []
  const errors: Array<{ title: string; error: string }> = []

  for (const entry of SEED_ENTRIES) {
    try {
      // 1. Insert project
      const { data: projectRow, error: projectErr } = await admin
        .from('projects')
        .insert({
          user_id: DIEGO_USER_ID,
          title: SEED_PREFIX + entry.title,
          slide_data: entry.slides,
          template_id: entry.templateId,
          generation_status: 'complete',
        })
        .select('id')
        .single()
      if (projectErr || !projectRow) {
        errors.push({ title: entry.title, error: `project insert: ${projectErr?.message ?? 'no row'}` })
        continue
      }

      // 2. Render hero from slide 1 using the chosen template
      let heroBuffer: Buffer
      try {
        heroBuffer = await renderHero(entry.slides[0], entry.templateId, origin)
      } catch (err) {
        errors.push({ title: entry.title, error: `render: ${(err as Error).message}` })
        continue
      }

      // 3. Upload hero PNG
      const heroPath = `${DIEGO_USER_ID}/${crypto.randomUUID()}.png`
      const { error: uploadErr } = await admin.storage
        .from('hero-thumbnails')
        .upload(heroPath, heroBuffer, { contentType: 'image/png', upsert: false })
      if (uploadErr) {
        errors.push({ title: entry.title, error: `upload: ${uploadErr.message}` })
        continue
      }
      const { data: pub } = admin.storage.from('hero-thumbnails').getPublicUrl(heroPath)
      const heroUrl = pub.publicUrl

      // 4. Insert published_carousels with retry on slug collision
      let inserted = false
      let lastError = ''
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        const slug = slugify(entry.title) + '-' + nanoidSuffix()
        const { error: insertErr } = await admin.from('published_carousels').insert({
          owner_id: DIEGO_USER_ID,
          source_project_id: projectRow.id,
          slug,
          title: entry.title,
          description: entry.description,
          hero_image_url: heroUrl,
          slide_data: entry.slides,
          tags: entry.tags,
        })
        if (!insertErr) {
          inserted = true
          seeded.push({ slug, title: entry.title, templateId: entry.templateId })
          break
        }
        lastError = insertErr.message
        if (!/duplicate key/i.test(insertErr.message)) break
      }
      if (!inserted) {
        // Best-effort cleanup of the orphan hero
        await admin.storage.from('hero-thumbnails').remove([heroPath])
        errors.push({ title: entry.title, error: `published insert: ${lastError}` })
      }
    } catch (err) {
      errors.push({ title: entry.title, error: `unexpected: ${(err as Error).message}` })
    }
  }

  // Refresh popularity_score so seeded carousels sort correctly on Trending tab
  await admin.rpc('refresh_popularity_score')

  return NextResponse.json({
    seeded: seeded.length,
    items: seeded,
    errors,
  })
}

export async function DELETE(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Refusing to run in production' }, { status: 403 })
  }
  const expectedToken = process.env.ADMIN_SEED_TOKEN
  const auth = request.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!expectedToken || provided !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Match seed projects by their [seed] title prefix
  const { data: seedProjects } = await admin
    .from('projects')
    .select('id')
    .eq('user_id', DIEGO_USER_ID)
    .like('title', SEED_PREFIX + '%')
  const seedProjectIds = (seedProjects ?? []).map((p) => p.id as string)

  // Find published_carousels descended from those projects
  const { data: rows } = seedProjectIds.length
    ? await admin
        .from('published_carousels')
        .select('id, hero_image_url')
        .in('source_project_id', seedProjectIds)
    : { data: [] as Array<{ id: string; hero_image_url: string | null }> }

  const ids = (rows ?? []).map((r) => r.id as string)
  const heroPaths: string[] = []
  for (const r of rows ?? []) {
    const url = r.hero_image_url as string | null
    if (!url) continue
    const marker = '/object/public/hero-thumbnails/'
    const idx = url.indexOf(marker)
    if (idx !== -1) heroPaths.push(url.slice(idx + marker.length).split('?')[0])
  }

  if (ids.length > 0) {
    await admin.from('published_carousels').delete().in('id', ids)
  }
  if (heroPaths.length > 0) {
    await admin.storage.from('hero-thumbnails').remove(heroPaths)
  }
  if (seedProjectIds.length > 0) {
    await admin.from('projects').delete().in('id', seedProjectIds)
  }

  return NextResponse.json({
    deleted: { rows: ids.length, files: heroPaths.length, projects: seedProjectIds.length },
  })
}
