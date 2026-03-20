import Link from 'next/link'
import { Footer } from '@/components/layout/footer'

export const metadata = {
  title: 'Terms of Service — ViralSlideMaker',
}

export default function TermsOfServicePage() {
  return (
    <div className="bg-[#fff8f7] text-[#281718] min-h-screen">
      <nav className="border-b border-[#dbc1bc]/20 py-4 px-8">
        <Link href="/" className="text-xl font-semibold tracking-tighter text-[#3d0000]">
          ViralSlideMaker
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-bold text-[#3d0000] mb-2">Terms of Service</h1>
        <p className="text-sm text-[#7d6161] mb-12">Last updated: March 20, 2026</p>

        <div className="prose prose-sm max-w-none text-[#55423f] space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ViralSlideMaker (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and ViralSlideMaker.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">2. Description of Service</h2>
            <p>
              ViralSlideMaker is an AI-powered platform that generates carousel slide content for social media platforms including TikTok, Instagram, and LinkedIn. The Service uses artificial intelligence to create text content and pairs it with stock photography to produce downloadable carousel images.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">3. Account Registration</h2>
            <p>To use certain features of the Service, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update your account information if it changes</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
            </ul>
            <p className="mt-3">
              You must be at least 13 years old to create an account. If you are under 18, you represent that you have parental or guardian consent to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">4. Subscription Plans and Billing</h2>
            <p>
              ViralSlideMaker offers Free, Plus, and Pro subscription tiers. Each tier includes a monthly allocation of carousel generation credits:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Free:</strong> 5 carousels per month</li>
              <li><strong>Plus:</strong> 12 carousels per month</li>
              <li><strong>Pro:</strong> 30 carousels per month</li>
            </ul>
            <p className="mt-3">
              Paid subscriptions are billed on a recurring basis (monthly or annually). By subscribing, you authorize us to charge your payment method through Stripe. Credits reset at the beginning of each billing cycle and do not roll over. You may cancel your subscription at any time; access continues until the end of the current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Generate content that is illegal, harmful, threatening, abusive, defamatory, or otherwise objectionable</li>
              <li>Create misleading or deceptive content, including misinformation</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Attempt to reverse engineer, decompile, or extract source code from the Service</li>
              <li>Use automated scripts or bots to access the Service in a manner that exceeds reasonable use</li>
              <li>Resell, redistribute, or white-label the Service without authorization</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive usage patterns that degrade service quality for other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">6. Content Ownership</h2>
            <h3 className="text-base font-semibold text-[#3d0000] mb-2">Your Content</h3>
            <p>
              You retain ownership of the prompts and topics you submit to the Service. The carousel content generated by our AI based on your prompts is yours to use for personal and commercial purposes, including posting on social media platforms.
            </p>

            <h3 className="text-base font-semibold text-[#3d0000] mb-2 mt-4">Stock Images</h3>
            <p>
              Carousel backgrounds may include stock photography sourced from Pexels. These images are provided under the Pexels license, which permits free use for personal and commercial purposes. Attribution is not required but appreciated.
            </p>

            <h3 className="text-base font-semibold text-[#3d0000] mb-2 mt-4">Our Content</h3>
            <p>
              The ViralSlideMaker platform, including its design, code, templates, branding, and documentation, remains our intellectual property. You may not copy, modify, or distribute any part of the platform itself.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">7. AI-Generated Content</h2>
            <p>
              Content generated by ViralSlideMaker is produced by artificial intelligence and may not always be accurate, complete, or appropriate. You are responsible for reviewing all generated content before publishing. We do not guarantee that AI-generated content will be free from errors, biases, or inaccuracies.
            </p>
            <p className="mt-3">
              We do not use your private content or prompts to train our AI models. Your data is processed solely to generate the requested output.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">8. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access to the Service. We may temporarily suspend the Service for maintenance, updates, or circumstances beyond our control. We are not liable for any losses resulting from service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, ViralSlideMaker shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising out of or related to your use of the Service.
            </p>
            <p className="mt-3">
              Our total liability for any claim arising from or related to the Service shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">10. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will meet your specific requirements or expectations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless ViralSlideMaker, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">12. Termination</h2>
            <p>
              We may terminate or suspend your account at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page and updating the &ldquo;Last updated&rdquo; date. Your continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#3d0000] mb-3">15. Contact</h2>
            <p>
              For questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@viralslidemaker.com" className="text-[#3d0000] underline">legal@viralslidemaker.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
