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
          <div style={{ fontSize: '13px', color: '#6e6e73' }}>Applies to both open house visitors and ohACCESS account holders · Version 1.3 · Effective Date: July 20, 2026 · ohaccess.com</div>
        </div>

        {/* Tab links */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Visitor Terms</a>
          <a href="/subscriber-terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Subscriber Terms</a>
          <a href="/privacy" style={{ padding: '8px 18px', borderRadius: '8px', background: '#1d1d1f', color: 'white', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Privacy Policy</a>
        </div>

        <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#3a3a3c' }}>

          <Section title="1. Introduction">
            <p>ohACCESS, LLC (&quot;ohACCESS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a Texas limited liability company, operates ohaccess.com and provides a QR-code-based open house visitor verification platform. This Privacy Policy explains how we collect, use, share, and protect personal information from three distinct groups of people:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '10px' }}>
              <li style={{ marginBottom: '6px' }}><strong>Open House Visitors</strong> — individuals who register at an open house through an ohACCESS-powered form</li>
              <li style={{ marginBottom: '6px' }}><strong>Subscribers</strong> — real estate agents, teams, and brokerages who hold an ohACCESS account</li>
              <li><strong>Website Visitors</strong> – individuals using our website (ohaccess.com) that are not Open House Visitors or Subscribers.</li>
            </ul>
            <p style={{ marginTop: '12px' }}>Sections that apply specifically to one group are clearly labeled. Where a section is unlabeled, it applies to both Open House Visitors and Subscribers, except for Sections 5-13 that apply to all three groups. By using ohACCESS in either capacity, you agree to the practices described here.</p>
          </Section>

          <Section title="1A. Our Role: Controller vs. Processor">
            <p>For most data covered by this Policy, ohACCESS is the &quot;controller&quot; (or &quot;business&quot; under the CCPA) — meaning we determine why and how the data is processed. This includes data about Subscribers and Open House Visitors, themselves, and usage data and technical information about the Service.</p>
            <p style={{ marginTop: '10px' }}>For <strong>Visitor data collected through a Subscriber&apos;s open house registrations</strong>, ohACCESS acts as a &quot;processor&quot; (or &quot;service provider&quot;) on behalf of the Subscriber, who is the controller of that data. The Subscriber is primarily responsible for honoring Visitor data subject requests; ohACCESS will reasonably assist as described in our <a href="/subscriber-terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Subscriber Terms of Service</a>.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>From Open House Visitors (collectively, &ldquo;Visitor Data&rdquo;):</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '16px' }}>
              <li style={{ marginBottom: '8px' }}>Full name</li>
              <li style={{ marginBottom: '8px' }}>Email address</li>
              <li style={{ marginBottom: '8px' }}>Phone number</li>
              <li style={{ marginBottom: '8px' }}>Purchasing timeline preference</li>
              <li style={{ marginBottom: '8px' }}>Date, time, and property address of the open house attended</li>
              <li style={{ marginBottom: '8px' }}>Device type and browser information (collected automatically)</li>
              <li style={{ marginBottom: '8px' }}>IP address (collected automatically)</li>
              <li style={{ marginBottom: '8px' }}>Phone number metadata obtained from our telecommunications provider, including carrier name and line type (e.g., mobile, landline, or VoIP), used for verification, security, and fraud-prevention purposes</li>
              <li style={{ marginBottom: '8px' }}>Automatically-collected usage data and technical information related to your session and usage data, date and time of access to the website, device type and operating system, internet service provider, browser type and version, and internet protocol address</li>
            </ul>
            <p><strong>From Subscribers (real estate agents, teams, and brokerages) (collectively &ldquo;Subscriber Data&rdquo;):</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '16px' }}>
              <li style={{ marginBottom: '8px' }}>Account identity: full name, email address, phone number, password (stored hashed)</li>
              <li style={{ marginBottom: '8px' }}>Profile information: brokerage name, license number, profile photo, business logo, branding colors, contact details displayed to Visitors</li>
              <li style={{ marginBottom: '8px' }}>Open house listing details (address, dates, hours, price, property attributes)</li>
              <li style={{ marginBottom: '8px' }}>Team/brokerage relationships (if applicable): brokerage you belong to, role within that brokerage, agents on your roster</li>
              <li style={{ marginBottom: '8px' }}>Billing and payment information: card last-4, billing address, subscription plan, payment history (full card numbers are handled exclusively by Stripe and never touch ohACCESS servers)</li>
              <li style={{ marginBottom: '8px' }}>Communications you send through the Service: SMS and email content generated for Visitors, plus delivery status from Twilio and Resend</li>
              <li style={{ marginBottom: '8px' }}>Usage data: pages viewed, features used, open houses created, visitors verified, login timestamps, IP address, device type, browser information</li>
              <li style={{ marginBottom: '8px' }}>Support correspondence: any messages you send to support@ohaccess.com or legal@ohaccess.com</li>
              <li style={{ marginBottom: '8px' }}>Automatically-collected usage data and technical information related to your session and usage data, date and time of access to the website, device type and operating system, internet service provider, browser type and version, and internet protocol address</li>
            </ul>
            <p><strong>From Website Visitors</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li>Automatically-collected usage data and technical information related to your session and usage data, date and time of access to the website, device type and operating system, internet service provider, browser type and version, and internet protocol address</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p><strong>For Open House Visitors, we use Visitor Data to:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '16px' }}>
              <li style={{ marginBottom: '8px' }}>Deliver your access code via SMS and email</li>
              <li style={{ marginBottom: '8px' }}>Verify your identity at the open house entrance</li>
              <li style={{ marginBottom: '8px' }}>Provide the hosting Agent with your contact information and purchasing timeline for follow-up</li>
              <li style={{ marginBottom: '8px' }}>Share your information with authorized third-party business partners with your consent as described in Section 4</li>
              <li style={{ marginBottom: '8px' }}>Maintain records of open house attendance</li>
              <li style={{ marginBottom: '8px' }}>Detect, prevent, and investigate fraud, misuse, security incidents, and threats to the safety of property owners, agents, and other visitors</li>
              <li style={{ marginBottom: '8px' }}>Improve the ohACCESS platform and user experience</li>
              <li style={{ marginBottom: '8px' }}>Comply with legal obligations</li>
            </ul>
            <p><strong>For Subscribers, we use Subscriber Data to:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '16px' }}>
              <li style={{ marginBottom: '8px' }}>Provide, operate, and maintain the Service</li>
              <li style={{ marginBottom: '8px' }}>Authenticate you and secure your account</li>
              <li style={{ marginBottom: '8px' }}>Process subscription payments and send billing notices</li>
              <li style={{ marginBottom: '8px' }}>Generate Visitor-facing emails and SMS messages using your brand assets and contact info</li>
              <li style={{ marginBottom: '8px' }}>Send service notifications, security alerts, and product updates</li>
              <li style={{ marginBottom: '8px' }}>Provide customer support and respond to inquiries</li>
              <li style={{ marginBottom: '8px' }}>Detect, prevent, and respond to fraud, abuse, security incidents, and violations of our <a href="/subscriber-terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Subscriber Terms</a></li>
              <li style={{ marginBottom: '8px' }}>Generate aggregate, anonymized analytics about platform usage for marketing and improving user experience</li>
              <li style={{ marginBottom: '8px' }}>Comply with legal, tax, and regulatory obligations</li>
            </ul>
            <p><strong>For Website Visitors, we use your information to:</strong></p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Improve website performance</li>
              <li style={{ marginBottom: '8px' }}>Remember user preferences</li>
              <li style={{ marginBottom: '8px' }}>Improve user experience</li>
            </ul>
          </Section>

          <Section title="3A. Subscriber Visibility Within Teams and Brokerages">
            <p>If you are a Subscriber and you join (or are added to) a Team or Brokerage account, the brokerage administrator(s) of that account will have visibility into your activity within the Service, including: the open houses you create, the Visitors who register at your open houses, your branding assets (which may be overridden by brokerage-level branding), and your account status (active, invited, suspended).</p>
            <p style={{ marginTop: '10px' }}>Brokerage administrators do <strong>not</strong> have access to: your password or authentication credentials, your private support correspondence with ohACCESS, your personal billing details (if you have an individual Subscription that predates joining the brokerage), or activity outside the Service.</p>
            <p style={{ marginTop: '10px' }}>If your brokerage account is closed or you are removed from the brokerage, you will be notified by email, your individual account will be preserved, and you will be prompted to select a personal Subscription plan to continue using the Service.</p>
          </Section>

          <Section title="4. Data Sharing with Third Parties">
            <p>ohACCESS shares Visitor Data with the following categories of third parties:</p>
            <p style={{ marginTop: '12px' }}><strong>Hosting Agents and Brokerages:</strong> The real estate agent and their affiliated brokerage receive your full registration record including name, email, phone, purchasing timeline, and timestamp.</p>
            <p style={{ marginTop: '12px' }}><strong>Authorized Business Partners:</strong> With your express written consent provided when you select the box to share your information with our third-party business partners, ohACCESS may share your contact information and purchasing intent data with authorized third-party business partners including mortgage lenders, title companies, real estate attorneys, home inspectors, moving companies, home warranty providers, homeowner&apos;s insurance providers, and other real estate transaction service providers. These partners may contact you independently regarding their products and services. We do not control the means and methods in which third parties contact you. While ohACCESS will process your opt-out requests for future sharing with third parties pursuant to Section 5 of the <a href="/terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Visitor Terms</a>, you should notify any third party directly if you wish to no longer be contacted by them.</p>
            <p style={{ marginTop: '12px' }}><strong>Service Providers (Sub-processors):</strong> ohACCESS uses the following service providers who process data on our behalf. Each is bound by data protection terms substantially similar to those in this Policy:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Supabase, Inc.</strong> — Secure database storage and authentication</li>
              <li style={{ marginBottom: '8px' }}><strong>Twilio Inc.</strong> — SMS delivery and phone number verification/lookup services</li>
              <li style={{ marginBottom: '8px' }}><strong>Resend, Inc.</strong> — Email delivery</li>
              <li style={{ marginBottom: '8px' }}><strong>Stripe, Inc.</strong> — Payment processing (Stripe is responsible for the security of full payment card data)</li>
              <li style={{ marginBottom: '8px' }}><strong>Vercel, Inc.</strong> — Platform hosting</li>
              <li style={{ marginBottom: '8px' }}><strong>Google LLC (Maps Platform)</strong> — Address autocomplete and geocoding for Subscriber listing entry</li>
            </ul>
            <p style={{ marginTop: '8px' }}>We will provide notice of any new sub-processor that materially processes personal data.</p>
            <p style={{ marginTop: '12px' }}><strong>Legal Requirements:</strong> We may disclose your information if required by law, court order, or governmental authority.</p>
            <p style={{ marginTop: '12px' }}><strong>We do not sell your personal information to data brokers or unaffiliated third parties for their independent marketing purposes.</strong> All third-party sharing is limited to authorized business partners in the real estate transaction ecosystem as described above and consented to through the registration form.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain visitor registration data for up to <strong>3 years</strong> from the date of collection. After this period, data is permanently deleted from our systems.</p>
            <p style={{ marginTop: '12px' }}>Automatically collected technical information relating to Open House Visitors — including IP address, device and browser information, and phone number metadata such as carrier name and line type — is retained on the same schedule: up to <strong>3 years</strong> from the date of collection.</p>
            <p style={{ marginTop: '12px' }}>Agent account data is retained for the duration of the account and for up to 2 years following account closure for legal and compliance purposes. If any subscriber wishes to retain a copy of their data, they should request a copy prior to such deletion timeline either through your account dashboard or by emailing privacy@ohaccess.com.</p>
            <p style={{ marginTop: '12px' }}>You may request deletion of your data at any time by contacting privacy@ohaccess.com. We will process deletion requests within 30 days, subject to any legal obligations to retain certain records.</p>
          </Section>

          <Section title="6. Your Privacy Rights">
            <p>Depending on your state of residence, you may have the following rights:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li style={{ marginBottom: '8px' }}><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li style={{ marginBottom: '8px' }}><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li style={{ marginBottom: '8px' }}><strong>Portability:</strong> Request an export of your data in a structured, machine-readable format</li>
              <li style={{ marginBottom: '8px' }}><strong>Opt-out of third-party sharing:</strong> Email privacy@ohaccess.com with subject &quot;Opt Out of Third-Party Sharing&quot;</li>
              <li style={{ marginBottom: '8px' }}><strong>Opt-out of marketing communications:</strong> See opt-out instructions in the <a href="/terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Visitor Terms of Service</a></li>
              <li style={{ marginBottom: '8px' }}><strong>Limit the use of your information</strong>: Request we only use your data as necessary to provide our service</li>
              <li style={{ marginBottom: '8px' }}><strong>Complaint:</strong> Lodge a complaint with your state&apos;s consumer protection authority</li>
            </ul>
            <p>To exercise any of these rights, contact us at privacy@ohaccess.com. We will respond within 30 days.</p>
            <p style={{ marginTop: '10px' }}><strong>Subscribers</strong> can additionally exercise most of these rights directly through their account dashboard (data export via CSV, profile updates, account closure). For Visitor data held in your Subscriber account, you are the controller and must process Visitor requests directly; ohACCESS will assist upon written request.</p>
          </Section>

          <Section title="7. State Privacy Rights (US)">
            <p><strong>7.1 California (CCPA / CPRA).</strong> If you are a California resident, you have the right to know what personal information we collect, use, disclose, and &quot;sell&quot; or &quot;share&quot; (as those terms are defined under the California Consumer Privacy Act as amended by the California Privacy Rights Act); to delete your personal information; to correct inaccurate information; to limit the use of sensitive personal information; and to opt out of the sale or sharing of your personal information. ohACCESS does not sell personal information to data brokers; however, our forward-looking authorization in Section 5 of the <a href="/terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Visitor Terms</a> to share data with authorized business partners may, if activated, constitute a &quot;sale&quot; or &quot;share&quot; under California law. To opt out, email privacy@ohaccess.com with subject &quot;California Opt Out&quot; and we will respond within fifteen (15) days unless a longer period is permitted by law.</p>
            <p style={{ marginTop: '10px' }}><strong>7.2 Texas (TDPSA).</strong> If you are a Texas resident, you have rights under the Texas Data Privacy and Security Act (effective July 1, 2024), including the rights to confirm processing, access, correct, delete, port, and opt out of targeted advertising, sale, and certain profiling. To exercise these rights, email privacy@ohaccess.com with subject &quot;Texas Privacy Request.&quot;</p>
            <p style={{ marginTop: '10px' }}><strong>7.3 Other US States.</strong> Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), Oregon (OCPA), Montana (MCDPA), Delaware (DPDPA), Iowa (ICDPA), New Hampshire (NHDPA), New Jersey (NJDPA), Tennessee (TIPA), Indiana (ICDPA), Minnesota (MCDPA), Maryland (MODPA), Nebraska (NDPA), Kentucky (KCDPA), Rhode Island (RIDTPPA), and other states with comprehensive privacy laws may have substantially similar rights. To exercise rights under your state&apos;s law, email privacy@ohaccess.com with the subject line &quot;[State] Privacy Request.&quot; We respond within thirty (30) days (or up to forty-five (45) days where additional time is permitted by the applicable law).</p>
            <p style={{ marginTop: '10px' }}><strong>7.4 Non-Discrimination.</strong> We will not discriminate against you for exercising any privacy right.</p>
            <p style={{ marginTop: '10px' }}><strong>7.5 Authorized Agents.</strong> You may designate an authorized agent to submit a request on your behalf. We may require verification of your identity and the agent&apos;s authority.</p>
            <p style={{ marginTop: '10px' }}><strong>7.6 Appeals.</strong> If we decline a privacy request, depending on your jurisdiction, you may have a right to appeal to our decision by replying to our response with the subject line &quot;Appeal.&quot; We will review and respond within forty-five (45) to sixty (60) days, depending on your state of residence. If your appeal is denied, you may contact your state attorney general.</p>
          </Section>

          <Section title="7A. Jurisdictional Scope">
            The Service is intended for use only by individuals and businesses located in the United States. We do not target the Service to residents of the European Economic Area, the United Kingdom, Switzerland, Canada, or other non-US jurisdictions, and we do not represent that the Service complies with GDPR, UK GDPR, PIPEDA, or other non-US data protection laws. If you access the Service from outside the United States, you do so at your own risk and consent to the collection and transfer of your information to the United States for processing.
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
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Visitor Terms</a>
          <a href="/subscriber-terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Subscriber Terms</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="mailto:privacy@ohaccess.com" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>© 2026 ohACCESS. All rights reserved. · <span style={{ fontWeight: '600' }}>Patent Pending</span></div>
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
