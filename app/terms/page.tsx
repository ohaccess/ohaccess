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
          <div style={{ fontSize: '13px', color: '#6e6e73' }}>For individuals registering at an open house · Version 1.5 · Effective Date: June 1, 2026 · ohaccess.com</div>
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

          <Section title="1A. Your Alternative to Acceptance">
            <p>If you do not wish to provide the consent described in Section 2 or otherwise agree to these Terms, you are not required to do so. You are equally free to view this listing — or any other listed property — through other means available under applicable real estate practice rules.</p>
            <p style={{ marginTop: '10px' }}>In particular, you may schedule a private showing of this or any other listed property with a licensed real estate buyer&apos;s agent of your own choosing. Pursuant to the National Association of REALTORS® (NAR) policy changes that took effect on August 17, 2024 in connection with the settlement of In re Real Estate Commission Antitrust Litigation (Burnett v. NAR), an MLS-Participant buyer&apos;s agent must enter into a written buyer representation agreement with you before showing you a home. Most buyer&apos;s agents can prepare such an agreement at the time of showing, and the agreement&apos;s terms — including compensation — are negotiable between you and the agent you select.</p>
            <p style={{ marginTop: '10px' }}>Acceptance of these Terms and use of the ohACCESS registration flow is required <strong>only</strong> as a condition of attending an open house through the ohACCESS platform. It is not a precondition to viewing this or any other listed property by any other lawful means, and choosing not to register here in no way limits your access to the broader real estate market, your right to engage the buyer&apos;s agent of your choice, or your right to view this specific property at a future open house or by private appointment.</p>
          </Section>

          <Section title="1B. Access Is at the Discretion of the Seller and Hosting Agent">
            <p>Attendance at an open house is a privilege extended by the property owner and the hosting Agent, not a right. ohACCESS is a technology platform that facilitates registration and codeword-based verification; it does not grant, control, or guarantee access to any listed property. Completion of the ohACCESS registration flow and receipt of an access code does not entitle you to enter the property.</p>
            <p style={{ marginTop: '10px' }}>The hosting Agent and the property owner expressly reserve the right, exercisable in their sole and reasonable judgment, to refuse admission to, condition entry of, or remove from the premises any person at any time, including (without limitation) when doing so is necessary to protect the safety of attendees or occupants, secure the property, comply with capacity limits or scheduling, respond to suspected impairment or threatening behavior, or comply with any applicable law, regulation, or instruction from law enforcement.</p>
            <p style={{ marginTop: '10px' }}><strong>Non-Discrimination.</strong> Any refusal, conditioning, or removal must be made in a manner that complies with the federal Fair Housing Act (42 U.S.C. §§ 3601 et seq.), the Civil Rights Act of 1866 (42 U.S.C. § 1981), the Americans with Disabilities Act where applicable, and all state and local fair-housing and anti-discrimination laws. The hosting Agent and the property owner may not refuse or condition access on the basis of race, color, national origin, religion, sex (including sexual orientation and gender identity), familial status, disability, age, marital status, source of income, military or veteran status, or any other class protected under federal, state, or local law in the jurisdiction where the property is located. Section 7 of the ohACCESS Subscriber Terms of Service independently prohibits any ohACCESS account holder from engaging in discriminatory access decisions and treats any such conduct as grounds for immediate termination of the account holder&apos;s ohACCESS subscription.</p>
            <p style={{ marginTop: '10px' }}><strong>If You Believe You Were Refused Unlawfully.</strong> If you believe you were refused access in violation of fair-housing or anti-discrimination law, you may file a complaint with the U.S. Department of Housing and Urban Development at <strong>1-800-669-9777</strong> or hud.gov, contact your state attorney general or state real estate commission, and/or report the incident to ohACCESS at privacy@ohaccess.com. ohACCESS will preserve any registration and access-related records associated with the incident pursuant to a good-faith complaint or lawful request, consistent with our internal retention policies.</p>
            <p style={{ marginTop: '10px' }}><strong>ohACCESS Disclaimer.</strong> ohACCESS is not a party to any access decision, does not direct the hosting Agent&apos;s or property owner&apos;s discretion regarding admission, and disclaims any liability arising from an Agent&apos;s or property owner&apos;s decision to grant, refuse, condition, or terminate access to an open house, except to the extent ohACCESS&apos;s own conduct independently violates applicable law.</p>
          </Section>

          <Section title="1C. Purpose of ohACCESS — Security, Follow-Up, and Related Services">
            <p>ohACCESS is, first and foremost, a safety and security tool for property owners and the real estate professionals who host open houses. An open house is an invitation to view a private home; it is not an offer of open, anonymous, or unvetted access to anyone. The primary purpose of the registration and codeword verification you complete is to confirm that each visitor has provided genuine, reachable contact information and to create a record of attendance — measures that deter anonymous or fraudulent entry and support the safety and security of the property, its occupants, and the hosting Agent.</p>
            <p style={{ marginTop: '10px' }}>ohACCESS verifies only that the phone number and/or email address you provide are valid and reachable, by delivering an access code to them. <strong>ohACCESS does not conduct background checks, criminal-history checks, or identity verification beyond this contact-information confirmation, and does not screen, vouch for, or guarantee the safety, identity, or intentions of any visitor, Agent, or other person.</strong> Sections 1B (Discretion of Access) and 11 (Indemnity) continue to apply.</p>
            <p style={{ marginTop: '10px' }}><strong>Access codes.</strong> Any access code issued to you is provided solely for your own attendance at the specific open house for which you registered. Access codes are personal to you, non-transferable, and may be single-use and time-limited. Sharing your code with, or using a code on behalf of, another person is prohibited, and — as stated in Section 1B — presenting an access code does not by itself entitle you or anyone else to enter the property.</p>
            <p style={{ marginTop: '10px' }}>The hosting Agent also uses ohACCESS to follow up with you regarding the property you visited and other real estate services, as described in Sections 2, 4, and 8, and ohACCESS may facilitate introductions to the categories of real estate–related service providers described in Section 5. These follow-up and service-provider purposes operate alongside, and are secondary to, the security purpose described above.</p>
          </Section>

          <Section title="1D. Conduct at the Property; Photography and Recording">
            <p>An open house takes place in a private residence. Unless the hosting Agent or property owner expressly permits it, you agree not to photograph, video-record, audio-record, livestream, or otherwise capture or transmit images or recordings of the interior of the property or of other attendees while on the premises.</p>
            <p style={{ marginTop: '10px' }}>You further agree to follow the reasonable instructions of the hosting Agent; to refrain from opening closets, drawers, safes, or personal belongings except as the Agent permits; and to respect the privacy, property, and safety of the owner, occupants, and other attendees. The hosting Agent and property owner may condition or withdraw your access for failure to comply, consistent with Section 1B.</p>
          </Section>

          <Section title="2. Express Written Consent to Be Contacted">
            <p>By submitting this form, you provide your <strong>express written consent</strong> — as that term is defined under the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, and applicable state laws — to be contacted by the Agent, their affiliated brokerage, and ohACCESS via:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Telephone calls to the number you provided, including calls made using an automatic telephone dialing system (ATDS) or an artificial or prerecorded voice</li>
              <li style={{ marginBottom: '8px' }}>SMS and MMS text messages to the number you provided</li>
              <li style={{ marginBottom: '8px' }}>Email messages to the email address you provided</li>
            </ul>
            <p>This contact may be regarding the specific property you registered to visit, other available properties, market updates, or real estate services, transactions, and homeownership.</p>
          </Section>

          <Section title="3. Do Not Call Registry Override">
            You acknowledge and agree that your express written consent provided through this form constitutes a valid exemption to any registration you may have on the National Do Not Call Registry, any state Do Not Call list, or any internal suppression list maintained by the Agent, their brokerage, ohACCESS, or any of ohACCESS&apos;s authorized third-party partners. This consent overrides any prior Do Not Call registration with respect to contact from these parties regarding real estate services and related products, as recognized under 47 C.F.R. § 64.1200(c)(2)(ii) and applicable FTC regulations. Your consent is also intended to constitute the prior express invitation or permission required under applicable state telemarketing laws, including the Texas Business &amp; Commerce Code (Chapters 302 and 305) and analogous statutes in other states, to the extent such consent is recognized thereunder.
          </Section>

          <Section title="4. Established Business Relationship">
            By voluntarily registering for an open house hosted by the Agent, you acknowledge an established business relationship (EBR) with the Agent and their affiliated brokerage, as defined under applicable FTC and FCC regulations. This EBR supports the right to contact you regarding real estate services and related products and services for a period of up to 3 months from the date of your most recent registration or interaction, unless you validly exercise your right to opt out.
          </Section>

          <Section title="5. Data Sharing with Third-Party Partners">
            <p><strong>Current practice:</strong> ohACCESS does not currently share your registration information with the third-party business partners listed below. The consent you provide in this Section 5 is forward-looking — it permits, but does not require, ohACCESS to engage in such sharing in the future without obtaining additional consent. If and when ohACCESS begins active third-party data sharing, the categories of recipients will be those listed in this Section 5 and no others, and we will update our <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a> and notify subscribers as required by Section 14 of these Terms.</p>
            <p style={{ marginTop: '10px' }}>If you select the box to share your information with our third-party business partners, you expressly consent to ohACCESS sharing your registration information — including your name, email address, phone number, purchasing timeline, and open house attendance details — with ohACCESS&apos;s authorized third-party business partners, which may include only:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Mortgage lenders and loan originators</li>
              <li style={{ marginBottom: '8px' }}>Title companies and closing attorneys</li>
              <li style={{ marginBottom: '8px' }}>Real estate attorneys</li>
              <li style={{ marginBottom: '8px' }}>Home inspection companies</li>
              <li style={{ marginBottom: '8px' }}>Moving and relocation companies</li>
              <li style={{ marginBottom: '8px' }}>Home warranty providers</li>
              <li style={{ marginBottom: '8px' }}>Homeowner&apos;s insurance providers</li>
              <li style={{ marginBottom: '8px' }}>Other real estate transaction service providers</li>
            </ul>
            <p>If such sharing begins, these third-party partners may contact you independently regarding their products and services. ohACCESS is not responsible for the communications or practices of third-party partners. Each third-party partner&apos;s contact with you is governed by their own terms of service and privacy policy.</p>
            <p style={{ marginTop: '10px' }}><strong>You have the right to opt out of third-party data sharing at any time</strong> by emailing privacy@ohaccess.com with the subject line &quot;Opt Out of Third-Party Sharing,&quot; even before any such sharing has begun. OhACCESS will process opt-out requests within ten (10) business days for future sharing. Please allow up to sixty (60) days for any sharing opt-out request to go into effect. Data already shared with third-party partners prior to your opt-out request cannot be recalled.</p>
          </Section>

          <Section title="5A. Data Retention">
            We retain your registration information only as long as needed for the purposes described in these Terms and our <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>. As described in Section 5 of the <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>, visitor registration data is retained for up to three (3) years from the date of collection, or until the hosting Agent deletes their ohACCESS account, whichever comes first, after which it is permanently deleted — subject to any legal obligation to retain certain records. You may request deletion of your data at any time by emailing privacy@ohaccess.com; see the <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a> for details and timing.
          </Section>

          <Section title="5B. California Residents and Other State Privacy Rights">
            If you are a resident of California or another U.S. state with a comprehensive consumer-privacy law, you may have additional rights regarding your personal information — including the right to know what we collect, to access, correct, or delete it, and to opt out of any &quot;sale&quot; or &quot;sharing&quot; of it. <strong>ohACCESS does not sell personal information to data brokers.</strong> These rights, and how to exercise them, are described in Section 7 of our <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>. California residents may opt out of any sale or sharing by emailing privacy@ohaccess.com with the subject line &quot;California Opt Out&quot;; residents of other states may email privacy@ohaccess.com with the subject line &quot;[State] Privacy Request.&quot;
          </Section>

          <Section title="6. How to Opt Out of All Communications">
            <p>You may withdraw your consent and opt out of future communications from ohACCESS at any time using any of the following methods:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Text messages:</strong> Reply STOP, QUIT, CANCEL, UNSUBSCRIBE, or END to any text message you receive</li>
              <li style={{ marginBottom: '8px' }}><strong>Email:</strong> Click the &quot;Unsubscribe&quot; link in any email, or reply with &quot;Unsubscribe&quot; in the subject line</li>
              <li style={{ marginBottom: '8px' }}><strong>Phone:</strong> State verbally that you wish to be placed on the do-not-call list</li>
              <li style={{ marginBottom: '8px' }}><strong>Written request:</strong> Email privacy@ohaccess.com</li>
              <li style={{ marginBottom: '8px' }}><strong>Third-party sharing opt-out:</strong> Email privacy@ohaccess.com with subject line &quot;Opt Out of Third-Party Sharing&quot;</li>
            </ul>
            <p>Opt-out requests will be processed within ten (10) business days, but please allow up to thirty (30) days for such request to go into effect. Transactional messages you request such as your access code confirmation are not affected by marketing opt-outs.</p>
          </Section>

          <Section title="7. Accuracy of Information and Eligibility">
            You represent and warrant that all information you provide in the registration form — including your name, phone number, and email address — is accurate, current, and belongs to you. Providing false or third-party contact information is a violation of these Terms and may constitute fraud. ohACCESS reserves the right to deny access to any visitor suspected of providing false information. You further represent and warrant that you are at least 18 years of age. ohACCESS is not intended for use by individuals under 18, and we do not knowingly collect personal information from minors; if you believe a minor has submitted information through the platform, contact privacy@ohaccess.com and we will delete it promptly (see our <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>).
          </Section>

          <Section title="8. No Agency Relationship Created">
            <p>Your registration through ohACCESS and any subsequent communications from the hosting Agent or their affiliated brokerage are for <strong>informational and marketing communication purposes only</strong>. Nothing in these Terms, the registration process, or any follow-up communication from the Agent shall be construed as creating a real estate agency relationship, fiduciary duty, or representation agreement between you and the Agent or their brokerage.</p>
            <p style={{ marginTop: '10px' }}>No agency relationship — including but not limited to buyer representation, seller representation, or dual agency — is established by your attendance at an open house, your registration through ohACCESS, or any communications that follow. Any formal real estate representation relationship requires a separate, signed written representation agreement between you and a licensed real estate professional, in accordance with applicable state law and National Association of REALTORS® guidelines.</p>
            <p style={{ marginTop: '10px' }}>The Agent&apos;s follow-up communications are intended solely to provide you with information about available properties and real estate services. You are under no obligation to work with the Agent or their brokerage as a result of your registration or any subsequent communications.</p>
          </Section>

          <Section title="9. Platform Role">
            ohACCESS is a technology platform that facilitates open house registration and visitor verification on behalf of real estate agents and brokerages. ohACCESS is not a real estate broker, agent, or party to any real estate transaction. All subsequent communications you receive from the Agent are from the Agent directly, not from ohACCESS, unless explicitly stated otherwise. Communications from ohACCESS&apos;s third-party partners are the sole responsibility of those partners.
          </Section>

          <Section title="9A. Open House Scheduling, Cancellation, and Force Majeure">
            <p>Open houses are scheduled and conducted at the discretion of the hosting Agent and the property owner. An open house for which you register may be rescheduled, relocated, shortened, or canceled, and the property may be taken off market, placed under contract, or otherwise made unavailable, at any time and without notice to you. Neither ohACCESS nor the hosting Agent guarantees that any open house will take place as listed or that any property will be available for viewing.</p>
            <p style={{ marginTop: '10px' }}>Neither ohACCESS nor the hosting Agent is liable for any failure or delay — including the unavailability of the platform or of any open house — caused by events beyond its reasonable control, including acts of God, severe weather, fire, power, utility or network failures, labor disputes, governmental or law-enforcement action, public-health emergencies, or other force-majeure events.</p>
          </Section>

          <Section title="10. Intellectual Property">
            <p>All software, content, design, code, copyrights, trademarks, logos, trade secrets, patents, patent applications, and materials on the ohACCESS platform are the exclusive property of ohACCESS, LLC and are protected by applicable intellectual property laws. The ohACCESS visitor verification mechanic is the subject of U.S. Provisional Patent Application No. 64/071,134. Unauthorized use, reproduction, or distribution of any ohACCESS materials is strictly prohibited.</p>
            <p style={{ marginTop: '10px' }}>If you provide ohACCESS with any feedback, suggestions, or ideas regarding the ohACCESS platform or website, you grant ohACCESS a perpetual, irrevocable, royalty-free, worldwide license to use and incorporate that feedback into our services without any compensation or obligation to you.</p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OHACCESS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, OR OTHER INTANGIBLE LOSSES, ARISING FROM YOUR USE OF THE PLATFORM, YOUR ATTENDANCE AT AN OPEN HOUSE, YOUR DENIAL OF ENTRY TO ANY OPEN HOUSE, ANY COMMUNICATIONS YOU RECEIVE FROM AN AGENT OR THIRD-PARTY PARTNER, OR ANY DATA SHARING AUTHORIZED BY THESE TERMS, WHETHER BASED IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE, AND EVEN IF OHACCESS HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p style={{ marginTop: '10px' }}>YOUR USE OF THIS PLATFORM IS AT YOUR OWN RISK. IN NO EVENT SHALL OHACCESS&apos;S TOTAL CUMULATIVE LIABILITY TO YOU EXCEED ONE HUNDRED U.S. DOLLARS ($100).</p>
            <p style={{ marginTop: '10px' }}>The limitations in this Section 11 apply notwithstanding the failure of essential purpose of any limited remedy.</p>
          </Section>

          <Section title="12. Indemnification">
            YOU AGREE TO INDEMNIFY, DEFEND, AND HOLD HARMLESS OHACCESS, LLC, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND THIRD-PARTY PARTNERS FROM AND AGAINST ANY AND ALL CLAIMS, DAMAGES, LOSSES, LIABILITIES, COSTS, AND EXPENSES (INCLUDING REASONABLE ATTORNEYS&apos; FEES) ARISING FROM (A) YOUR USE OF THE PLATFORM; (B) YOUR VIOLATION OF THESE TERMS; (C) YOUR PROVISION OF FALSE, INACCURATE, OR THIRD-PARTY CONTACT INFORMATION; OR (D) ANY CLAIM BY A THIRD PARTY ARISING FROM CONTACT INFORMATION YOU SUBMITTED THAT DID NOT BELONG TO YOU.
          </Section>

          <Section title="13. Governing Law, Arbitration & Class Action Waiver">
            <p><strong>13.1 Governing Law.</strong> These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles.</p>
            <p style={{ marginTop: '10px' }}><strong>13.2 Binding Arbitration.</strong> Any dispute, claim, or controversy arising out of or relating to these Terms or your use of the platform shall be resolved through final and binding arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, conducted in Tarrant County, Texas, or remotely by videoconference at the arbitrator&apos;s discretion. The arbitrator&apos;s award shall be binding and may be entered as a judgment in any court of competent jurisdiction. Either party may seek emergency injunctive relief in any court of competent jurisdiction in aid of arbitration.</p>
            <p style={{ marginTop: '10px' }}><strong>13.3 JURY TRIAL WAIVER.</strong> YOU AND OHACCESS EACH KNOWINGLY AND VOLUNTARILY WAIVE ANY RIGHT TO A TRIAL BY JURY FOR ANY DISPUTE ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM.</p>
            <p style={{ marginTop: '10px' }}><strong>13.4 CLASS ACTION WAIVER.</strong> ALL CLAIMS BETWEEN YOU AND OHACCESS MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, MASS, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE OR JOIN MORE THAN ONE PERSON&apos;S CLAIMS AND MAY NOT PRESIDE OVER ANY FORM OF REPRESENTATIVE OR CLASS PROCEEDING. IF A COURT DECIDES THAT APPLICABLE LAW PRECLUDES ENFORCEMENT OF ANY OF THIS PARAGRAPH&apos;S LIMITATIONS AS TO A PARTICULAR CLAIM, THEN THAT CLAIM (AND ONLY THAT CLAIM) MUST BE SEVERED FROM THE ARBITRATION AND BROUGHT IN COURT.</p>
            <p style={{ marginTop: '10px' }}><strong>13.5 Severability.</strong> If any provision of these Terms is held invalid, illegal, or unenforceable by a court or arbitrator of competent jurisdiction, that provision will be enforced to the maximum extent permissible and the remaining provisions will remain in full force and effect. This general severability provision applies in addition to, and does not limit, the specific severance rule in Section 13.4.</p>
          </Section>

          <Section title="14. Changes to These Terms">
            ohACCESS reserves the right to modify these Terms at any time. When we make material changes, the updated Terms will be posted at this URL with a new effective date and version number. Continued use of the platform after the effective date constitutes acceptance of the revised Terms. We encourage you to review these Terms periodically. These Terms are <strong>Version 1.5</strong>, with an <strong>Effective Date of June 1, 2026</strong>; the version number and effective date in effect at any time are also shown at the top of this document.
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
