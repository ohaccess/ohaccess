export default function SubscriberTerms() {
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
          <h1 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '8px' }}>Subscriber Terms of Service</h1>
          <div style={{ fontSize: '13px', color: '#6e6e73' }}>For real estate agents, teams, and brokerages who hold an ohACCESS account · Version 1.2 · Effective Date: June 1, 2026 · ohaccess.com</div>
        </div>

        {/* Tab links */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Visitor Terms</a>
          <a href="/subscriber-terms" style={{ padding: '8px 18px', borderRadius: '8px', background: '#1d1d1f', color: 'white', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Subscriber Terms</a>
          <a href="/privacy" style={{ padding: '8px 18px', borderRadius: '8px', background: '#f5f5f7', color: '#1d1d1f', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid #d1d1d6' }}>Privacy Policy</a>
        </div>

        <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#3a3a3c' }}>

          <Section title="1. Acceptance of Terms">
            These Subscriber Terms of Service (&quot;Terms&quot;) form a binding agreement between you (&quot;Subscriber,&quot; &quot;you,&quot; or &quot;your&quot;) and ohACCESS, LLC, a Texas limited liability company (&quot;ohACCESS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an ohACCESS account, accessing the ohACCESS platform, or using any feature of the Service in any capacity other than as a Visitor registering at an open house, you represent that you have read, understood, and agree to be bound by these Terms. If you are entering into these Terms on behalf of a company, brokerage, team, or other legal entity, you represent that you have the authority to bind that entity to these Terms, and the terms &quot;Subscriber&quot; and &quot;you&quot; refer to that entity. If you do not agree to these Terms, you may not access or use the Service.
          </Section>

          <Section title="2. Definitions">
            <p><strong>&quot;Service&quot;</strong> means the ohACCESS web application, APIs, dashboards, email and SMS delivery services, QR code generation, and related features made available at ohaccess.com or any subdomain.</p>
            <p style={{ marginTop: '10px' }}><strong>&quot;Subscriber Account&quot;</strong> means the account you create to access the Service, including any team or brokerage account you are designated as administrator of.</p>
            <p style={{ marginTop: '10px' }}><strong>&quot;Visitor&quot;</strong> means an individual who registers at an open house through an ohACCESS-powered registration form. Visitor relationships with ohACCESS are governed by the separate Visitor Terms of Service.</p>
            <p style={{ marginTop: '10px' }}><strong>&quot;Subscriber Data&quot;</strong> means data and content you input into the Service, including listings, branding assets, agent profiles, and Visitor registration records collected through your account.</p>
            <p style={{ marginTop: '10px' }}><strong>&quot;Subscription&quot;</strong> means the plan you select (Trial, Pro, Team, or Brokerage) and the recurring fees, if any, associated with it.</p>
          </Section>

          <Section title="3. Eligibility & Account Registration">
            <p>To register a Subscriber Account, you must (a) be at least 18 years old; (b) be legally able to enter into binding contracts; (c) provide accurate, current, and complete account information; (d) maintain and promptly update your account information; and (e) if claiming to act on behalf of a brokerage, be authorized to do so. You are solely responsible for all activity that occurs under your account, for maintaining the confidentiality of your login credentials, and for notifying us promptly of any unauthorized use.</p>
            <p style={{ marginTop: '10px' }}>You may not (i) share your account credentials with any other person, (ii) create more than one account for the same individual, or (iii) create an account using false or misleading identity information.</p>
          </Section>

          <Section title="4. Plans, Subscriptions, and Billing">
            <p><strong>4.1 Plans.</strong> ohACCESS offers tiered Subscriptions including a free Trial, Pro, Team, and Brokerage plans. Current plan features and pricing are published at ohaccess.com and may be updated from time to time. The plan you select governs the features available to your Subscriber Account, including registration limits, agent SMS alerts, brand customization, team management, and seat counts.</p>
            <p style={{ marginTop: '10px' }}><strong>4.2 Free Trial.</strong> The Trial plan permits up to 25 Visitor registrations across your account at no charge and does not require a payment method. Trial accounts do not automatically convert to a paid Subscription; you must explicitly select a paid plan to continue use beyond the Trial limit.</p>
            <p style={{ marginTop: '10px' }}><strong>4.3 Recurring Billing &amp; Auto-Renewal.</strong> Paid Subscriptions are billed in advance on a recurring basis (monthly, annually, or two-year, depending on the cycle you select) and automatically renew at the end of each billing cycle for an identical term unless cancelled at least thirty (30) days before the renewal date. By providing a payment method, you authorize ohACCESS (through our payment processor, Stripe, Inc.) to charge that payment method for each recurring fee.</p>
            <p style={{ marginTop: '10px' }}><strong>4.4 Price Changes.</strong> We may change Subscription prices at any time. Price changes apply to your account at the start of your next billing cycle and will be communicated to you by email at least thirty (30) days in advance. Your continued use of the Service after a price change takes effect constitutes acceptance of the new price. Founding-member or promotional pricing, where offered, applies only to the cycles explicitly described in the promotion.</p>
            <p style={{ marginTop: '10px' }}><strong>4.5 Failed Payments.</strong> If a payment fails, we may suspend your access to paid features until the payment is resolved. After repeated unsuccessful attempts to charge your payment method, we may terminate your Subscription. You remain responsible for all fees accrued before suspension or termination.</p>
            <p style={{ marginTop: '10px' }}><strong>4.6 Cancellation.</strong> You may cancel your Subscription at any time through your account settings or by emailing support@ohaccess.com at least thirty (30) days before your next billing cycle. Cancellation takes effect at the end of your then-current paid billing cycle; you retain access to paid features through that date.</p>
            <p style={{ marginTop: '10px' }}><strong>4.7 Refunds.</strong> Except where required by applicable law, all fees are non-refundable. We do not provide refunds or credits for partial billing periods, unused features, or downgrades. Annual and two-year prepaid Subscriptions are non-refundable in full or in part.</p>
            <p style={{ marginTop: '10px' }}><strong>4.8 Taxes.</strong> Fees are exclusive of any applicable taxes. You are responsible for paying any taxes assessed in connection with your Subscription, except for taxes based on ohACCESS&apos;s income or gross receipts.</p>
          </Section>

          <Section title="5. License to Use the Service">
            Subject to your compliance with these Terms and timely payment of all fees, ohACCESS grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Service during the term of your Subscription solely for your internal business purposes as a real estate professional, team, or brokerage. All rights not expressly granted in these Terms are reserved by ohACCESS.
          </Section>

          <Section title="6. Subscriber Data & Ownership">
            <p><strong>6.1 Ownership.</strong> As between you and ohACCESS, you own all Subscriber Data, including Visitor registration records collected through your account. We claim no ownership over your listings, branding, agent profiles, or Visitor data.</p>
            <p style={{ marginTop: '10px' }}><strong>6.2 License to ohACCESS.</strong> You grant ohACCESS a worldwide, royalty-free license to host, reproduce, copy, transmit, display, and process Subscriber Data solely as necessary to (a) provide the Service to you, (b) prevent or address security or technical issues, (c) comply with legal obligations, and (d) generate aggregated, anonymized analytics that cannot reasonably be used to identify you or any individual.</p>
            <p style={{ marginTop: '10px' }}><strong>6.3 Accuracy.</strong> You are responsible for the accuracy, legality, and quality of all Subscriber Data, including ensuring that any third-party content (logos, headshots, listing photos) is properly licensed for your use.</p>
            <p style={{ marginTop: '10px' }}><strong>6.4 Export.</strong> You may export Visitor data from your account at any time as CSV during the term of your Subscription and, upon written request, for up to thirty (30) days after termination. After that period, we may permanently delete your data in accordance with our retention policies.</p>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to, and will not permit any user under your account to:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Upload, import, paste, or otherwise introduce into the Service any Visitor contact information (name, phone number, email address, or other personal identifier) that was not collected through an ohACCESS-powered Visitor registration form. The Service is designed exclusively for in-person, opt-in open-house registrations; introducing externally sourced contacts misrepresents consent, violates these Terms, and is grounds for immediate termination;</li>
              <li style={{ marginBottom: '8px' }}>Use the Service to send messages unrelated to real estate services or follow-up regarding the specific property at which the Visitor registered;</li>
              <li style={{ marginBottom: '8px' }}>Send any further communication (SMS, email, call, or otherwise) to a Visitor after they have opted out via &quot;STOP&quot; or equivalent SMS reply, email unsubscribe, written request, or verbal request, regardless of channel — including by re-importing the opted-out Visitor&apos;s number into a different ohACCESS account, agent, or brokerage you control;</li>
              <li style={{ marginBottom: '8px' }}>Use the Service in violation of the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, the FTC Telemarketing Sales Rule (TSR), state Do Not Call laws, state mini-TCPA statutes (including but not limited to the Florida Telephone Solicitation Act, Washington CEMA, and Oklahoma TCPA), or any other applicable telecommunications, marketing, or consumer protection law;</li>
              <li style={{ marginBottom: '8px' }}>Perform reverse-lookup, append, enrichment, skip-tracing, or any similar process on Visitor contact data using third-party services or databases not authorized by these Terms;</li>
              <li style={{ marginBottom: '8px' }}>Share, sell, rent, license, sublicense, or transfer Visitor data collected through the Service to any third party (including affiliated brokerages, loan officers, title companies, or co-marketing partners) except (a) as expressly authorized by the Visitor through the ohACCESS registration consent flow, or (b) as required by law;</li>
              <li style={{ marginBottom: '8px' }}>Use Visitor data collected through the Service for any purpose not disclosed to the Visitor at the time of registration, including but not limited to lead-list resale, broker referral schemes, mortgage cross-marketing, or training of artificial intelligence or machine learning systems;</li>
              <li style={{ marginBottom: '8px' }}>Reverse engineer, decompile, scrape, web-scrape, or attempt to extract source code, data structures, or proprietary algorithms from the Service;</li>
              <li style={{ marginBottom: '8px' }}>Circumvent or attempt to circumvent rate limits, seat limits, authentication, billing, opt-out enforcement, the trial registration cap, or any other technical or contractual restriction;</li>
              <li style={{ marginBottom: '8px' }}>Use the Service to send spam, phishing messages, malware, or any unlawful, fraudulent, defamatory, harassing, threatening, or otherwise harmful content;</li>
              <li style={{ marginBottom: '8px' }}>Insert any malicious software or program that could compromise the ohACCESS platform, steal confidential information, or disrupt the Service (commonly referred to as malware, ransomware, viruses, worms, spyware, adware, Trojan horse or backdoors);</li>
              <li style={{ marginBottom: '8px' }}>Use the Service to create false or misleading listings (other than the creation of a limited number &quot;test&quot; listings to test the Service prior to using the Service for Visitors of an actual open house);</li>
              <li style={{ marginBottom: '8px' }}>Use the Service to discriminate against Visitors or to steer Visitors toward or away from properties in violation of the Fair Housing Act, the Equal Credit Opportunity Act, state fair-housing laws, or any other anti-discrimination law;</li>
              <li style={{ marginBottom: '8px' }}>Refuse, condition, or terminate open-house access for any Visitor on the basis of race, color, national origin, religion, sex (including sexual orientation and gender identity), familial status, disability, age, marital status, source of income, military or veteran status, or any other class protected under federal, state, or local law in the jurisdiction where the property is located. The right of the seller and the hosting Agent to refuse access for legitimate, articulable, non-pretextual security or safety reasons (for example, visibly impaired, armed, or threatening behavior; capacity limits; lawful instruction from law enforcement) is not impaired by this provision. However, the burden of contemporaneously documenting and demonstrating a legitimate, non-pretextual basis for any refusal rests entirely with the Subscriber, and ohACCESS may suspend or terminate the Subscriber Account upon a good-faith determination that access decisions have been made on a prohibited basis. Subscribers are encouraged to retain a brief written record of the date, time, and articulable safety basis for any access refusal;</li>
              <li style={{ marginBottom: '8px' }}>Use the Service to compete with ohACCESS, build a competing product, or benchmark the Service for the benefit of a competitor;</li>
              <li style={{ marginBottom: '8px' }}>Permit any individual other than the account holder (or, in the case of Team and Brokerage plans, properly invited team members within the seat limit) to access your account.</li>
            </ul>
            <p>Violation of this Section 7 may result in immediate suspension or termination of your Subscriber Account without refund or notice, in addition to any other remedies available to ohACCESS at law or in equity. ohACCESS may also act on credible reports of Section 7 violations from Visitors, carriers (including via complaint volume reported through Twilio or other delivery providers), regulators, or the public. ohACCESS&apos;s determination of whether a violation has occurred is final for purposes of suspension or termination under these Terms.</p>
          </Section>

          <Section title="8. TCPA, CAN-SPAM & Marketing Compliance">
            <p><strong>8.1 Your Responsibility.</strong> You acknowledge and agree that you are the &quot;sender&quot; under the CAN-SPAM Act and the party initiating contact under the TCPA for all messages sent through the Service to Visitors, including the initial codeword delivery, transactional confirmations, and any follow-up marketing communications. <strong>You are solely responsible for ensuring that all such communications comply with the TCPA, CAN-SPAM, the FTC&apos;s Telemarketing Sales Rule, applicable state Do Not Call laws, state mini-TCPA statutes, and any other applicable law in the jurisdiction(s) where Visitors are located.</strong></p>
            <p style={{ marginTop: '10px' }}><strong>8.2 No Screening by ohACCESS.</strong> ohACCESS DOES NOT verify, validate, or screen any phone number, email address, or other contact information submitted by a Visitor through a registration form, and ohACCESS DOES NOT independently confirm that the person submitting the form owns or has authority to use that contact information. You acknowledge that Visitor-submitted contact data may be inaccurate, mistyped, or — in rare cases — provided by a person who does not own the contact information. The risk and liability arising from such inaccuracies (including any TCPA, TSR, or state-law claim by a non-Visitor recipient of a misdirected message) rest entirely with you as the sender.</p>
            <p style={{ marginTop: '10px' }}><strong>8.3 Consent Records.</strong> ohACCESS provides the Visitor consent capture flow and retains consent records on your behalf for the duration of your account. Upon termination, we will provide consent records to you upon written request for a period of up to thirty (30) days. You are responsible for retaining your own copies of consent records, and regularly consulting do not call registries and your internal suppression lists, as may be required by law. ohACCESS&apos;s consent records reflect what the Visitor submitted; they do not constitute a representation by ohACCESS that the submission was accurate or made by the actual owner of the contact information.</p>
            <p style={{ marginTop: '10px' }}><strong>8.4 Opt-Out Handling.</strong> The Service honors &quot;STOP,&quot; &quot;QUIT,&quot; &quot;CANCEL,&quot; &quot;UNSUBSCRIBE,&quot; and &quot;END&quot; SMS replies at the carrier level. You are responsible for (a) honoring opt-out requests received through any other channel (email reply, phone call, in-person request, written request, or social media), (b) ensuring no further communications are sent to opted-out Visitors through ohACCESS or any other means under your control, including via re-entry of the opted-out number into a different account, agent profile, or brokerage roster you control, (c) maintaining your own suppression list of opt-outs received outside the Service, and (d) regularly consulting your suppression lists and other do not call registries as required by applicable law.</p>
            <p style={{ marginTop: '10px' }}><strong>8.5 Carrier &amp; Regulatory Risk.</strong> You acknowledge that wireless carriers, A2P 10DLC registries, toll-free verification authorities, and regulators may suspend, throttle, or block messages based on content, complaint volume, or carrier-level filtering decisions outside ohACCESS&apos;s control. ohACCESS is not responsible for messages blocked, delayed, or filtered by carriers or regulators, and no refund will be issued for any period during which your messages are subject to such filtering.</p>
            <p style={{ marginTop: '10px' }}><strong>8.6 Indemnity for Compliance Failures.</strong> Your obligation to indemnify ohACCESS for TCPA, CAN-SPAM, TSR, DNC, mini-TCPA, Fair Housing, and related claims is set forth in Section 14.</p>
          </Section>

          <Section title="9. Privacy & Data Processing">
            <p><strong>9.1 Privacy Policy.</strong> Our collection, use, and sharing of personal information is described in our <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>, which is incorporated into these Terms by reference.</p>
            <p style={{ marginTop: '10px' }}><strong>9.2 Roles.</strong> With respect to Visitor data collected through your account, you act as the &quot;data controller&quot; (or &quot;business&quot; under the CCPA) and ohACCESS acts as the &quot;data processor&quot; (or &quot;service provider&quot;). We will process Visitor data only in accordance with your reasonable instructions, these Terms, and applicable law.</p>
            <p style={{ marginTop: '10px' }}><strong>9.3 Sub-processors.</strong> You authorize ohACCESS to engage the following sub-processors in providing the Service: Supabase, Inc. (database and authentication), Twilio Inc. (SMS delivery), Resend, Inc. (email delivery), Stripe, Inc. (payment processing), and Vercel, Inc. (hosting). We will provide reasonable advance notice of any new sub-processor that materially processes Visitor data and will be responsible for our sub-processors&apos; compliance with these Terms.</p>
            <p style={{ marginTop: '10px' }}><strong>9.4 Security.</strong> ohACCESS implements reasonable administrative, technical, and physical safeguards designed to protect Subscriber Data, including encryption in transit, access controls, and audit logging. No system is perfectly secure, and ohACCESS does not warrant that the Service will be uninterrupted or error-free.</p>
            <p style={{ marginTop: '10px' }}><strong>9.5 Data Subject Requests.</strong> If you receive a request from a Visitor to access, correct, delete, or port their data, you are primarily responsible for responding. ohACCESS will provide reasonable assistance upon written request.</p>
          </Section>

          <Section title="10. Confidentiality">
            Each party may disclose to the other certain non-public information designated as confidential or that a reasonable person would understand to be confidential (&quot;Confidential Information&quot;). The receiving party will (a) use Confidential Information only to perform under these Terms, (b) protect it using at least the same degree of care it uses to protect its own confidential information of similar sensitivity (but no less than reasonable care), and (c) not disclose it to any third party except to employees, contractors, and advisors with a need to know and bound by confidentiality obligations no less protective than these. This Section does not apply to information that is publicly available, independently developed without violating any obligation of confidentiality, or required to be disclosed by law (subject to the disclosing party&apos;s right to obtain a protective order prior to the disclosure of such information).
          </Section>

          <Section title="11. Intellectual Property">
            <p>ohACCESS or its licensors retain all right, title, and interest in and to the Service, including, without limitation, all software, code, designs, patents, patent applications, copyrights, trademarks, logos, trade secrets, and content, as well as any modifications, updates, revisions or enhancements thereto (excluding Subscriber Data). No license is granted to you except as expressly set forth in Section 5. The &quot;ohACCESS&quot; name and logo are trademarks of ohACCESS, LLC and may not be used without our prior written consent. The ohACCESS visitor verification mechanism is the subject of U.S. Provisional Patent Application No. 64/071,134.</p>
            <p style={{ marginTop: '10px' }}>If you provide ohACCESS with any feedback, suggestions, or ideas regarding the Service, you grant ohACCESS a perpetual, irrevocable, royalty-free, worldwide license to use and incorporate that feedback into the Service without any compensation or obligation to you.</p>
          </Section>

          <Section title="12. Service Availability, Modifications & Disclaimers">
            <p><strong>12.1 Availability.</strong> We will use commercially reasonable efforts to make the Service available 24/7, excluding scheduled maintenance, emergency maintenance, and circumstances beyond our reasonable control (including failures of third-party services such as Supabase, Twilio, Resend, Stripe, Vercel, Google, or telecommunications carriers). We do not commit to any specific uptime percentage and no service-level credits are offered.</p>
            <p style={{ marginTop: '10px' }}><strong>12.2 SMS &amp; Email Deliverability.</strong> SMS and email delivery depends on third-party carriers, registries, and providers whose performance is outside ohACCESS&apos;s control. We do not warrant that any specific message will be delivered, delivered on time, delivered to the intended recipient, or received without modification or filtering.</p>
            <p style={{ marginTop: '10px' }}><strong>12.3 Visitor Data Accuracy.</strong> ohACCESS DOES NOT verify the accuracy, ownership, or authority-to-use of any Visitor-submitted phone number, email address, name, or other contact information. We do not screen for typos, transposed digits, deliberate misrepresentation, or numbers belonging to a person other than the registering Visitor. <strong>ohACCESS does not conduct background checks, criminal-history checks, or identity verification beyond this contact-information confirmation, and does not screen, vouch for, or guarantee the safety, identity, or intentions of any visitor, or other person</strong>.</p>
            <p style={{ marginTop: '10px' }}>You acknowledge that you, as the Subscriber and sender of follow-up communications, bear the sole risk and liability for any consequence arising from Visitor-submitted data that turns out to be inaccurate.</p>
            <p style={{ marginTop: '10px' }}><strong>12.4 Modifications.</strong> We may modify, add, deprecate, or remove features at any time. We will provide reasonable notice of any material adverse change to the Service.</p>
            <p style={{ marginTop: '10px' }}><strong>12.5 DISCLAIMERS.</strong> THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY OF VISITOR-SUBMITTED DATA, FREEDOM FROM CARRIER FILTERING, AND ANY WARRANTIES ARISING OUT OF COURSE OF DEALING OR USAGE OF TRADE. OHACCESS DOES NOT WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS, OPERATE WITHOUT INTERRUPTION OR ERROR, OR BE FREE FROM VULNERABILITIES OR HARMFUL COMPONENTS. OHACCESS MAKES NO REPRESENTATION THAT ANY MESSAGE SENT THROUGH THE SERVICE COMPLIES WITH ANY APPLICABLE LAW; COMPLIANCE IS YOUR SOLE RESPONSIBILITY.</p>
          </Section>

          <Section title="13. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL OHACCESS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE, WHETHER BASED IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE, EVEN IF OHACCESS HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p style={{ marginTop: '10px' }}>OHACCESS&apos;S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU TO OHACCESS IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).</p>
            <p style={{ marginTop: '10px' }}>The limitations in this Section 13 apply notwithstanding the failure of essential purpose of any limited remedy.</p>
          </Section>

          <Section title="14. Indemnification">
            <p><strong>14.1 SUBSCRIBER INDEMNITY.</strong> YOU WILL DEFEND, INDEMNIFY, AND HOLD HARMLESS OHACCESS, ITS AFFILIATES, AND THEIR RESPECTIVE OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND AGENTS FROM AND AGAINST ANY AND ALL THIRD-PARTY CLAIMS, DAMAGES, LOSSES, LIABILITIES, COSTS, AND EXPENSES (INCLUDING REASONABLE ATTORNEYS&apos; FEES, EXPERT FEES, AND COURT COSTS) ARISING OUT OF OR RELATED TO:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>(a) your use of the Service in violation of these Terms or any applicable law, regulation, or rule;</li>
              <li style={{ marginBottom: '8px' }}>(b) Subscriber Data, including, without limitation, any claim that Subscriber Data infringes, misappropriates, or violates a third party&apos;s intellectual property, privacy, publicity, or contractual rights;</li>
              <li style={{ marginBottom: '8px' }}>(c) any message sent by you, or on your behalf, through the Service, including all claims under the Telephone Consumer Protection Act (47 U.S.C. § 227 and 47 C.F.R. § 64.1200), the CAN-SPAM Act (15 U.S.C. §§ 7701–7713), the FTC Telemarketing Sales Rule (16 C.F.R. Part 310), federal or state Do Not Call rules, state mini-TCPA or telephone solicitation statutes (including but not limited to the Florida Telephone Solicitation Act, Washington CEMA, and Oklahoma TCPA);</li>
              <li style={{ marginBottom: '8px' }}>(d) any claim under the Fair Housing Act, the Equal Credit Opportunity Act, and any analogous federal, state, or local law;</li>
              <li style={{ marginBottom: '8px' }}>(e) any claim by a person who received a message you sent through the Service alleging they did not consent, did not own the phone number or email address used, or are not the Visitor who submitted the registration — regardless of whether the inaccuracy originated from Visitor input;</li>
              <li style={{ marginBottom: '8px' }}>(f) any data subject request, regulatory inquiry, or class action arising from your handling of Visitor data; or</li>
              <li style={{ marginBottom: '8px' }}>(g) your gross negligence, willful misconduct, or fraud.</li>
            </ul>
            <p><strong>14.2 ohACCESS Indemnity.</strong> ohACCESS will defend, indemnify, and hold harmless Subscriber from and against third-party claims alleging that the Service, as provided by ohACCESS and used in strict accordance with these Terms, infringes a U.S. patent, copyright, or trademark; provided that this indemnity does not apply to claims arising from (a) Subscriber Data or Visitor data, (b) modifications to the Service not made by ohACCESS, (c) combination of the Service with any third-party product, service, or data, or (d) use of the Service in violation of these Terms.</p>
            <p style={{ marginTop: '10px' }}><strong>14.3 Procedure.</strong> The indemnified party must (i) promptly notify the indemnifying party of the claim in writing, (ii) give the indemnifying party sole control of the defense and settlement (provided that no settlement may admit liability or impose non-monetary obligations on the indemnified party without its prior written consent), and (iii) provide reasonable cooperation at the indemnifying party&apos;s reasonable expense.</p>
            <p style={{ marginTop: '10px' }}><strong>14.4 Sole Remedy.</strong> Section 14.2 sets forth ohACCESS&apos;s sole and exclusive liability, and Subscriber&apos;s sole and exclusive remedy, for any third-party claim of intellectual property infringement.</p>
          </Section>

          <Section title="15. Term & Termination">
            <p><strong>15.1 Term.</strong> These Terms commence when you create a Subscriber Account and continue until terminated.</p>
            <p style={{ marginTop: '10px' }}><strong>15.2 Termination by You.</strong> You may terminate your account at any time by cancelling your Subscription and closing your account through account settings or by emailing support@ohaccess.com.</p>
            <p style={{ marginTop: '10px' }}><strong>15.3 Termination by ohACCESS.</strong> We may suspend or terminate your access to the Service immediately and without liability if (a) you breach these Terms; (b) your account remains in unpaid status after notice; (c) we reasonably believe your activity poses a security risk, legal risk, or risk of harm to other users or third parties; or (d) we are required to do so by law.</p>
            <p style={{ marginTop: '10px' }}><strong>15.4 Effect of Termination.</strong> Upon termination, your right to access the Service immediately ceases. Sections 4.7 (Refunds), 6 (Subscriber Data), 7 (Acceptable Use), 8 (Marketing Compliance and indemnity references therein), 10 (Confidentiality), 11 (IP), 12.3 (Visitor Data Accuracy) and 12.5 (Disclaimers), 13 (Limitation of Liability), 14 (Indemnification), 15.4, 16, 17, 18, 19, and 20 survive termination.</p>
          </Section>

          <Section title="16. Data Retention After Termination">
            Upon termination, ohACCESS will retain your Subscriber Data for thirty (30) days during which you may request export. After that period, we may delete your Subscriber Data from production systems. Visitor consent records and certain financial records may be retained for longer periods as required by law (typically up to seven years). Anonymized or aggregated data derived from Subscriber Data may be retained indefinitely.
          </Section>

          <Section title="17. Modifications to These Terms">
            We may modify these Terms from time to time. If we make a material change, we will notify you by email or through the Service at least thirty (30) days before the change takes effect. Your continued use of the Service after the change takes effect constitutes acceptance of the modified Terms. If you do not agree to the modified Terms, your sole remedy is to cancel your Subscription before the change takes effect.
          </Section>

          <Section title="18. Governing Law & Dispute Resolution">
            <p><strong>18.1 Governing Law.</strong> These Terms are governed by the laws of the State of Texas, without regard to its conflict-of-laws principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply.</p>
            <p style={{ marginTop: '10px' }}><strong>18.2 Venue.</strong> Any dispute, claim, or controversy arising out of or related to these Terms or the Service that is not subject to arbitration under Section 18.3 will be brought exclusively in the state or federal courts located in Tarrant County, Texas, and the parties consent to the personal jurisdiction of such courts.</p>
            <p style={{ marginTop: '10px' }}><strong>18.3 Informal Resolution.</strong> Before filing any claim, you agree to first attempt to resolve the dispute informally by emailing support@ohaccess.com with a written description of the claim. The parties will work in good faith for at least thirty (30) days to resolve the matter informally before any formal proceeding may commence.</p>
            <p style={{ marginTop: '10px' }}><strong>18.4 No Class Actions.</strong> You and ohACCESS agree that any dispute will be brought solely in your individual capacity, and not as a plaintiff or class member in any purported class, collective, or representative proceeding.</p>
          </Section>

          <Section title="19. General Provisions">
            <p><strong>19.1 Entire Agreement.</strong> These Terms (together with the <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>, <a href="/terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>Visitor Terms</a>, and any order forms or addenda referenced herein) constitute the entire agreement between you and ohACCESS regarding the Service and supersede all prior or contemporaneous communications and proposals.</p>
            <p style={{ marginTop: '10px' }}><strong>19.2 No Waiver.</strong> Failure to enforce any provision of these Terms is not a waiver of the right to enforce that or any other provision later.</p>
            <p style={{ marginTop: '10px' }}><strong>19.3 Severability.</strong> If any provision of these Terms is held invalid or unenforceable, the remaining provisions will remain in full force and effect, and the invalid provision will be modified to the minimum extent necessary to make it enforceable.</p>
            <p style={{ marginTop: '10px' }}><strong>19.4 Assignment.</strong> You may not assign or transfer these Terms or your account without ohACCESS&apos;s prior written consent. ohACCESS may assign these Terms in connection with a merger, acquisition, sale of assets, or by operation of law without your consent.</p>
            <p style={{ marginTop: '10px' }}><strong>19.5 Force Majeure.</strong> Neither party is liable for failure to perform, other than for payment of Subscriptions, due to causes beyond its reasonable control, including acts of God, war, terrorism, natural disaster, labor disputes, internet or telecommunications failure, or governmental action.</p>
            <p style={{ marginTop: '10px' }}><strong>19.6 Notices.</strong> Notices to ohACCESS must be sent to legal@ohaccess.com. Notices to you may be sent to the email address associated with your account and are effective when sent.</p>
            <p style={{ marginTop: '10px' }}><strong>19.7 No Agency Relationship.</strong> The parties are independent contractors. These Terms do not create a partnership, joint venture, employment, or agency relationship.</p>
            <p style={{ marginTop: '10px' }}><strong>19.8 Third-Party Beneficiaries.</strong> There are no third-party beneficiaries to these Terms.</p>
          </Section>

          <Section title="20. Contact">
            <p>Questions about these Terms can be sent to legal@ohaccess.com; support requests should go to support@ohaccess.com; and data sharing inquires can be sent to privacy@ohaccess.com.</p>
            <div style={{ background: '#f5f5f7', borderRadius: '12px', padding: '16px 20px', marginTop: '12px', fontSize: '13px' }}>
              <strong>ohACCESS, LLC</strong><br />
              A Texas Limited Liability Company<br />
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
