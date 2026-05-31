import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'ViralSlideMaker — AI Carousel Creator',
  description: 'Transform your ideas into editorial-grade carousel presentations instantly',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}

// Mobile foundation (v2.17 / Phase 91 / FOUND-01): viewport-fit=cover is the
// ONLY App-Router-supported way to populate env(safe-area-inset-*). Until this
// ships, every safe-area inset reads 0 and the fixed bottom nav collides with
// the home indicator. Never set userScalable:false / maximumScale (WCAG 1.4.4).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
