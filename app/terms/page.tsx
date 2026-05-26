export default function Terms() {
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
          <h1 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '8px' }}>Visitor Terms of Service</h1>
          <div style={{ fontSize: '13px', color: '#6e6e73' }}>For individuals registering at an open house · Effective Date: June 1, 2026 · ohaccess.com</div>
          <div style={{ fontSize: '13px', color: '#6e6e73', marginTop: '8px' }}>If you are a real estate agent, team, or brokerage holding an ohACCESS account, see the <a href="/subscriber-terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Subscriber Terms of Service</a>.</div>
        </div>

        {/* Tab links */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#1d1d1f', color: 'white', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Visitor Terms</a>
          <a href="/subscriber-terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Subscriber Terms</a>
          <a href="/privacy" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Privacy Policy</a>
        </div>

        <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#3a3a3c' }}>

          <Section title="1. Acceptance of Terms">
            By submitting the open house registration form on any ohACCESS-powered page, you (&quot;Visitor&quot;) agree to be bound by these Terms of Service. If you do not agree, do not submit the form. Your submission constitutes a legally binding agreement between you and ohACCESS, LLC (&quot;ohACCESS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), and between you and the real estate agent or brokerage hosting the open house (&quot;Agent&quot;). These Terms apply each time you register for any open house through the ohACCESS platform, regardless of location or hosting agent.
          </Section>

          <Section title="2. Express Written Consent to Be Contacted">
            <p>By submitting this form, you provide your <strong>express written consent</strong> — as that term is defined under the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, and applicable state laws — to be contacted by the Agent, their affiliated brokerage, ohACCESS, and ohACCESS&apos;s authorized third-party partners via:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '12px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Telephone calls to the number you provided, including calls made using an automatic telephone dialing system (ATDS) or an artificial or prerecorded voice</li>
              <li style={{ marginBottom: '8px' }}>SMS and MMS text messages to the number you provided</li>
              <li style={{ marginBottom: '8px' }}>Email messages to the email address you provided</li>
            </ul>
            <p>This contact may be regarding the specific property you registered to visit, other available properties, market updates, real estate services, mortgage and lending services, title and closing services, home inspection services, moving services, home warranty products, homeowner&apos;s insurance, and other products and services related to real estate transactions and homeownership.</p>
          </Section>

          <Section title="3. Do Not Call Registry Override">
            You acknowledge and agree that your express written consent provided through this form constitutes a valid exemption to any registration you may have on the National Do Not Call Registry, any state Do Not Call list, or any internal suppression list maintained by the Agent, their brokerage, ohACCESS, or any of ohACCESS&apos;s authorized third-party partners. This consent overrides any prior Do Not Call registration with respect to contact from these parties regarding real estate services and related products, as recognized under 47 C.F.R. § 64.1200(c)(2)(ii) and applicable FTC regulations.
          </Section>

          <Section title="4. Established Business Relationship">
            By voluntarily registering for an open house hosted by the Agent, you acknowledge an established business relationship (EBR) with the Agent, their affiliated brokerage, and ohACCESS, as defined under applicable FTC and FCC regulations. This EBR supports the right to contact you regarding real estate services and related products and services for a period of up to 18 months from the date of your most recent registration or interaction.
          </Section>

          <Section title="5. Data Sharing with Third-Party Partners">
            <p>By submitting this form, you expressly consent to ohACCESS sharing your registration information — including your name, email address, phone number, purchasing timeline, and open house attendance details — with ohACCESS&apos;s authorized third-party business partners, which may include but are not limited to:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '12px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Mortgage lenders and loan originators</li>
              <li style={{ marginBottom: '8px' }}>Title companies and closing attorneys</li>
              <li style={{ marginBottom: '8px' }}>Real estate attorneys</li>
              <li style={{ marginBottom: '8px' }}>Home inspection companies</li>
              <li style={{ marginBottom: '8px' }}>Moving and relocation companies</li>
              <li style={{ marginBottom: '8px' }}>Home warranty providers</li>
              <li style={{ marginBottom: '8px' }}>Homeowner&apos;s insurance providers</li>
              <li style={{ marginBottom: '8px' }}>Other real estate transaction service providers</li>
            </ul>
            <p>These third-party partners may contact you independently regarding their products and services. ohACCESS is not responsible for the communications or practices of third-party partners. Each third-party partner&apos;s contact with you is governed by their own terms of service and privacy policy.</p>
            <p style={{ marginTop: '12px' }}><strong>You have the right to opt out of third-party data sharing at any time</strong> by emailing privacy@ohaccess.com with the subject line &quot;Opt Out of Third-Party Sharing.&quot; Opt-out requests will be honored within 10 business days for future sharing. Data already shared with third-party partners prior to your opt-out request cannot be recalled.</p>
          </Section>

          <Section title="6. How to Opt Out of All Communications">
            <p>You may withdraw your consent and opt out of future communications at any time using any of the following methods:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '12px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Text messages:</strong> Reply STOP, QUIT, CANCEL, UNSUBSCRIBE, or END to any text message you receive</li>
              <li style={{ marginBottom: '8px' }}><strong>Email:</strong> Click the &quot;Unsubscribe&quot; link in any email, or reply with &quot;Unsubscribe&quot; in the subject line</li>
              <li style={{ marginBottom: '8px' }}><strong>Phone:</strong> State verbally that you wish to be placed on the do-not-call list</li>
              <li style={{ marginBottom: '8px' }}><strong>Written request:</strong> Email privacy@ohaccess.com</li>
              <li style={{ marginBottom: '8px' }}><strong>Third-party sharing opt-out:</strong> Email privacy@ohaccess.com with subject line &quot;Opt Out of Third-Party Sharing&quot;</li>
            </ul>
            <p>Opt-out requests will be honored within 10 business days. Transactional messages such as your access code confirmation are not affected by marketing opt-outs.</p>
          </Section>

          <Section title="7. Accuracy of Information">
            You represent and warrant that all information you provide in the registration form — including your name, phone number, and email address — is accurate, current, and belongs to you. Providing false or third-party contact information is a violation of these Terms and may constitute fraud. ohACCESS reserves the right to deny access to any visitor suspected of providing false information.
          </Section>
        <Section title="8. No Agency Relationship Created">
        <p>Your registration through ohACCESS and any subsequent communications from the hosting Agent or their affiliated brokerage are for <strong>informational and marketing communication purposes only</strong>. Nothing in these Terms, the registration process, or any follow-up communication from the Agent shall be construed as creating a real estate agency relationship, fiduciary duty, or representation agreement between you and the Agent or their brokerage.</p>
        <p style={{ marginTop: '12px' }}>No agency relationship — including but not limited to buyer representation, seller representation, or dual agency — is established by your attendance at an open house, your registration through ohACCESS, or any communications that follow. Any formal real estate representation relationship requires a separate, signed written representation agreement between you and a licensed real estate professional, in accordance with applicable state law and National Association of REALTORS® guidelines.</p>
        <p style={{ marginTop: '12px' }}>The Agent&apos;s follow-up communications are intended solely to provide you with information about available properties and real estate services. You are under no obligation to work with the Agent or their brokerage as a result of your registration or any subsequent communications.</p>
        </Section>
          <Section title="9. Platform Role">
            ohACCESS is a technology platform that facilitates open house registration and visitor verification on behalf of real estate agents and brokerages. ohACCESS is not a real estate broker, agent, or party to any real estate transaction. All subsequent communications you receive from the Agent are from the Agent directly, not from ohACCESS, unless explicitly stated otherwise. Communications from ohACCESS&apos;s third-party partners are the sole responsibility of those partners.
          </Section>

          <Section title="10. Intellectual Property">
            All content, design, code, and materials on the ohACCESS platform are the exclusive property of ohACCESS, LLC and are protected by applicable intellectual property laws. The ohACCESS visitor verification mechanic is the subject of a provisional patent filing under David Ryan Sheehan. Unauthorized use, reproduction, or distribution of any ohACCESS materials is strictly prohibited.
          </Section>

          <Section title="11. Limitation of Liability">
            ohACCESS shall not be liable for any direct, indirect, incidental, special, exemplary, or consequential damages arising from your use of the platform, your attendance at an open house, any communications you receive from an Agent or third-party partner, or any data sharing authorized by these Terms. Your use of this platform is at your own risk. In no event shall ohACCESS&apos;s total liability to you exceed the amount of $100.
          </Section>

          <Section title="12. Indemnification">
            You agree to indemnify, defend, and hold harmless ohACCESS, LLC, its officers, directors, employees, agents, and third-party partners from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from your use of the platform, your violation of these Terms, or your provision of false or inaccurate information.
          </Section>

          <Section title="13. Governing Law & Dispute Resolution">
            These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved through binding arbitration in Tarrant County, Texas, under the rules of the American Arbitration Association, except that either party may seek injunctive relief in any court of competent jurisdiction. You waive any right to a jury trial or to participate in a class action lawsuit.
          </Section>

          <Section title="14. Changes to These Terms">
            ohACCESS reserves the right to modify these Terms at any time. We will notify registered agents of material changes via email. Continued use of the platform constitutes acceptance of the revised Terms. The effective date at the top of this page reflects the most recent update.
          </Section>

          <Section title="15. Contact Information">
            <p>For any questions about these Terms, opt-out requests, or data sharing inquiries:</p>
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