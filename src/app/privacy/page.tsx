import Link from 'next/link'
import { Footer } from '@/components/layout/footer'

export const metadata = {
  title: 'Privacy Policy — ViralSlideMaker',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[#fff8f7] text-[#281718] min-h-screen">
      <nav className="border-b border-[#dbc1bc]/20 py-4 px-8">
        <Link href="/" className="text-xl font-semibold tracking-tighter text-[#3d0000]">
          ViralSlideMaker
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-bold text-[#3d0000] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#7d6161] mb-12">Last updated: March 20, 2026</p>

        <div className="prose prose-sm max-w-none text-[#55423f] space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">1. Introduction</h2>
            <p>
              ViralSlideMaker (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the ViralSlideMaker platform, an AI-powered carousel content creation service. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>
            <p>
              By accessing or using ViralSlideMaker, you agree to this Privacy Policy. If you do not agree with the terms of this policy, please do not access the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-[#3d0000] mb-2">Personal Information</h3>
            <p>When you create an account, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Account credentials</li>
              <li>Payment and billing information (processed securely through Stripe)</li>
            </ul>

            <h3 className="text-base font-semibold text-[#3d0000] mb-2 mt-4">Usage Data</h3>
            <p>We automatically collect certain information when you use our service:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Content prompts and topics you submit for carousel generation</li>
              <li>Generated carousel content and slide data</li>
              <li>Template and style preferences</li>
              <li>Device information, browser type, and IP address</li>
              <li>Pages visited, features used, and interaction patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve our carousel generation service</li>
              <li>Process your content prompts through our AI systems to generate carousels</li>
              <li>Manage your account and subscription</li>
              <li>Send you service-related communications and updates</li>
              <li>Process payments and prevent fraud</li>
              <li>Analyze usage patterns to improve our platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">4. AI and Third-Party Services</h2>
            <p>
              ViralSlideMaker uses third-party AI services (including Google Gemini) to generate carousel content based on your prompts. When you submit a topic for carousel generation:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your prompt text is sent to our AI provider to generate slide content</li>
              <li>We do not use your private content to train AI models</li>
              <li>Generated content is stored in your account and is not shared with other users</li>
            </ul>
            <p className="mt-3">
              We also use Pexels to provide stock photography for carousel backgrounds. Image searches are based on AI-generated queries related to your topic, not your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service providers:</strong> Supabase (database and authentication), Stripe (payments), Google (AI generation), Pexels (stock images), Vercel (hosting and analytics)</li>
              <li><strong>Legal requirements:</strong> When required by law, regulation, or legal process</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure authentication via Supabase, and row-level security on our database. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time by contacting us. We will delete or anonymize your data within 30 days of such a request, unless retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability (receive your data in a structured format)</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-3">
              California residents have additional rights under the CCPA, including the right to know what personal information is collected and the right to opt out of the sale of personal information (which we do not do).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">9. Cookies and Analytics</h2>
            <p>
              We use Vercel Analytics to understand how our platform is used. We may use essential cookies for authentication and session management. We do not use third-party advertising cookies or trackers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">10. Children&apos;s Privacy</h2>
            <p>
              ViralSlideMaker is not intended for use by anyone under the age of 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected data from a child under 13, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &ldquo;Last updated&rdquo; date. Your continued use of the service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your data, please contact us at{' '}
              <a href="mailto:privacy@viralslidemaker.com" className="text-[#3d0000] underline">privacy@viralslidemaker.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
