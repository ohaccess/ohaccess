export default function Privacy() {
  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 40px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '22px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
        </a>
        <a href="/login" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
          Get started free
        </a>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 40px' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#6e6e73', marginBottom: '8px' }}>ohACCESS Legal</div>
          <h1 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '8px' }}>Privacy Policy</h1>
          <div style={{ fontSize: '13px', color: '#6e6e73' }}>Effective Date: June 1, 2026 · Last Updated: June 1, 2026 · ohaccess.com</div>
        </div>

        {/* Tab links */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
          <a href="/terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Terms of Service</a>
          <a href="/privacy" style={{ padding: '8px 18px', borderRadius: '8px', background: '#1d1d1f', color: 'white', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Privacy Policy</a>
        </div>

        <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#3a3a3c' }}>

          <Section title="1. Introduction">
            ohACCESS, LLC (&quot;ohACCESS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates ohaccess.com and provides a QR-code-based open house visitor verification platform. This Privacy Policy explains how we collect, use, share, and protect personal information from visitors who register at open houses powered by ohACCESS, as well as from real estate agents and brokerages who use our platform. By using ohACCESS, you agree to the practices described in this Privacy Policy.
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>From Open House Visitors:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '16px' }}>
              <li style={{ marginBottom: '8px' }}>Full name</li>
              <li style={{ marginBottom: '8px' }}>Email address</li>
              <li style={{ marginBottom: '8px' }}>Phone number</li>
              <li style={{ marginBottom: '8px' }}>Purchasing timeline preference</li>
              <li style={{ marginBottom: '8px' }}>Date, time, and property address of the open house attended</li>
              <li style={{ marginBottom: '8px' }}>Device type and browser information (collected automatically)</li>
              <li style={{ marginBottom: '8px' }}>IP address (collected automatically)</li>
            </ul>
            <p><strong>From Real Estate Agents:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Name, email address, phone number</li>
              <li style={{ marginBottom: '8px' }}>Brokerage name and license number</li>
              <li style={{ marginBottom: '8px' }}>Profile photo and business assets (if uploaded)</li>
              <li style={{ marginBottom: '8px' }}>Billing and payment information (processed securely by Stripe)</li>
              <li style={{ marginBottom: '8px' }}>Open house listing details</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p><strong>For Open House Visitors, we use your information to:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '16px' }}>
              <li style={{ marginBottom: '8px' }}>Deliver your access code via SMS and email</li>
              <li style={{ marginBottom: '8px' }}>Verify your identity at the open house entrance</li>
              <li style={{ marginBottom: '8px' }}>Provide the hosting Agent with your contact information and purchasing timeline for follow-up</li>
              <li style={{ marginBottom: '8px' }}>Share your information with authorized third-party business partners as described in Section 4</li>
              <li style={{ marginBottom: '8px' }}>Maintain records of open house attendance</li>
              <li style={{ marginBottom: '8px' }}>Improve the ohACCESS platform and user experience</li>
              <li style={{ marginBottom: '8px' }}>Comply with legal obligations</li>
            </ul>
            <p><strong>For Real Estate Agents, we use your information to:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Provide and maintain the ohACCESS platform</li>
              <li style={{ marginBottom: '8px' }}>Process subscription payments</li>
              <li style={{ marginBottom: '8px' }}>Send platform notifications and updates</li>
              <li style={{ marginBottom: '8px' }}>Provide customer support</li>
            </ul>
          </Section>

          <Section title="4. Data Sharing with Third Parties">
            <p>ohACCESS shares visitor data with the following categories of third parties:</p>
            <p style={{ marginTop: '12px' }}><strong>Hosting Agents and Brokerages:</strong> The real estate agent and their affiliated brokerage receive your full registration record including name, email, phone, purchasing timeline, and timestamp.</p>
            <p style={{ marginTop: '12px' }}><strong>Authorized Business Partners:</strong> With your express written consent provided through the registration form, ohACCESS may share your contact information and purchasing intent data with authorized third-party business partners including mortgage lenders, title companies, real estate attorneys, home inspectors, moving companies, home warranty providers, homeowner&apos;s insurance providers, and other real estate transaction service providers. These partners may contact you independently regarding their products and services.</p>
            <p style={{ marginTop: '12px' }}><strong>Service Providers:</strong> ohACCESS uses the following service providers who process data on our behalf:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Twilio</strong> — SMS delivery</li>
              <li style={{ marginBottom: '8px' }}><strong>Resend</strong> — Email delivery</li>
              <li style={{ marginBottom: '8px' }}><strong>Supabase</strong> — Secure database storage</li>
              <li style={{ marginBottom: '8px' }}><strong>Stripe</strong> — Payment processing</li>
              <li style={{ marginBottom: '8px' }}><strong>Vercel</strong> — Platform hosting</li>
            </ul>
            <p><strong>Legal Requirements:</strong> We may disclose your information if required by law, court order, or governmental authority.</p>
            <p style={{ marginTop: '12px' }}><strong>We do not sell your personal information to data brokers or unaffiliated third parties for their independent marketing purposes.</strong> All third-party sharing is limited to authorized business partners in the real estate transaction ecosystem as described above and consented to through the registration form.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain visitor registration data for up to <strong>3 years</strong> from the date of collection, or until the hosting Agent deletes their ohACCESS account, whichever comes first. After this period, data is permanently deleted from our systems.</p>
            <p style={{ marginTop: '12px' }}>Agent account data is retained for the duration of the account and for up to 2 years following account closure for legal and compliance purposes.</p>
            <p style={{ marginTop: '12px' }}>You may request deletion of your data at any time by contacting privacy@ohaccess.com. We will process deletion requests within 30 days, subject to any legal obligations to retain certain records.</p>
          </Section>

          <Section title="6. Your Privacy Rights">
            <p>Depending on your state of residence, you may have the following rights:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li style={{ marginBottom: '8px' }}><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li style={{ marginBottom: '8px' }}><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li style={{ marginBottom: '8px' }}><strong>Opt-out of third-party sharing:</strong> Email privacy@ohaccess.com with subject &quot;Opt Out of Third-Party Sharing&quot;</li>
              <li style={{ marginBottom: '8px' }}><strong>Opt-out of marketing communications:</strong> See opt-out instructions in the Terms of Service</li>
              <li style={{ marginBottom: '8px' }}><strong>Complaint:</strong> Lodge a complaint with your state&apos;s consumer protection authority</li>
            </ul>
            <p>To exercise any of these rights, contact us at privacy@ohaccess.com. We will respond within 30 days.</p>
          </Section>

          <Section title="7. California Privacy Rights (CCPA)">
            If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA). You have the right to know what personal information we collect, use, disclose, and sell. You have the right to delete your personal information. You have the right to opt out of the sale of your personal information. We do not sell personal information to data brokers. However, our sharing of data with authorized business partners as described in Section 4 may constitute a &quot;sale&quot; under California law. To opt out, email privacy@ohaccess.com with subject &quot;California Opt Out.&quot; We will not discriminate against you for exercising your CCPA rights.
          </Section>

          <Section title="8. Security">
            We implement industry-standard security measures to protect your personal information including encrypted data transmission (TLS/SSL), secure cloud database storage with row-level security, access controls and authentication requirements, and regular security reviews. No method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security. In the event of a data breach that affects your rights, we will notify you as required by applicable law.
          </Section>

          <Section title="9. Children's Privacy">
            ohACCESS is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has submitted information through our platform, please contact us at privacy@ohaccess.com and we will delete it promptly.
          </Section>

          <Section title="10. Cookies and Tracking">
            The ohACCESS platform uses minimal session cookies to maintain login state and prevent duplicate form submissions. We do not use third-party advertising cookies, tracking pixels, or behavioral advertising technologies on visitor-facing registration pages. Our marketing website (ohaccess.com) may use analytics tools to understand traffic patterns. You may disable cookies in your browser settings, though this may affect platform functionality.
          </Section>

          <Section title="11. Third-Party Links">
            Our platform may contain links to third-party websites. We are not responsible for the privacy practices of those websites. We encourage you to review the privacy policies of any third-party sites you visit.
          </Section>

          <Section title="12. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify registered agents of material changes via email. The effective date at the top of this page reflects the most recent update. Continued use of the platform constitutes acceptance of the revised Policy.
          </Section>

          <Section title="13. Contact Us">
            <p>For any privacy-related questions, opt-out requests, data deletion requests, or to exercise your privacy rights:</p>
            <div style={{ background: '#f5f5f7', borderRadius: '12px', padding: '16px 20px', marginTop: '12px', fontSize: '13px' }}>
              <strong>ohACCESS, LLC</strong><br />
              privacy@ohaccess.com<br />
              ohaccess.com
            </div>
          </Section>

        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px' }}>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="mailto:privacy@ohaccess.com" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>© 2026 ohACCESS. All rights reserved.</div>
      </footer>
    </main>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f2f2f7' }}>{title}</h2>
      <div>{children}</div>
    </div>
  )
}