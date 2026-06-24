export const metadata = {
  title: 'SMS Opt-In Consent Proof — ohACCESS',
  description:
    'Proof of express SMS opt-in consent for ohACCESS open-house access codes. For carrier toll-free verification review.',
}

export default function OptInProof() {
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
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#c9963a', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Verified Visitor Check-In
        </div>
      </nav>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 40px' }}>
        {/* Heading */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#6e6e73', marginBottom: '8px' }}>
            Carrier Compliance · SMS Opt-In Evidence
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
            SMS Opt-In Consent Proof
          </h1>
          <div style={{ fontSize: '14px', color: '#3a3a3c', lineHeight: '1.7' }}>
            This page documents how end users provide express consent to receive a one-time SMS access code from ohACCESS.
            It is provided as opt-in evidence for toll-free messaging verification.
          </div>
        </div>

        {/* Business identity */}
        <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '20px 24px', marginBottom: '40px', fontSize: '14px', lineHeight: '1.8', color: '#3a3a3c' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#6e6e73', marginBottom: '10px' }}>Business Identity</div>
          <div><strong>Legal business name:</strong> OHACCESS LLC</div>
          <div><strong>Brand / DBA:</strong> ohACCESS</div>
          <div><strong>Website:</strong> https://www.ohaccess.com</div>
          <div><strong>Use case:</strong> Two transactional message types — (1) <strong>one-time access codes</strong> (two-factor/verification) sent to open-house visitors, and (2) <strong>account notifications</strong> sent to the hosting real estate agent when a new visitor registers. No marketing messages are sent through this number.</div>
        </div>

        {/* Workflow steps */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '16px' }}>How consent is collected</h2>
        <ol style={{ fontSize: '14px', lineHeight: '1.8', color: '#3a3a3c', paddingLeft: '20px', marginBottom: '40px' }}>
          <li style={{ marginBottom: '10px' }}>
            <strong>Encounter the QR code.</strong> A visitor sees a branded ohACCESS flyer posted on printed signage outside
            the open-house property (shown below).
          </li>
          <li style={{ marginBottom: '10px' }}>
            <strong>Scan and reach the branded registration page.</strong> Scanning the QR code opens the ohACCESS
            registration page for that specific open house (shown below).
          </li>
          <li style={{ marginBottom: '10px' }}>
            <strong>Enter number and give express consent.</strong> The visitor enters their mobile number and taps
            &ldquo;Request Access Code.&rdquo; The consent disclosure shown directly below the button captures express written
            consent at the moment of submission.
          </li>
          <li>
            <strong>Receive the one-time SMS code.</strong> The visitor immediately receives a one-time SMS access code to
            present at the door.
          </li>
        </ol>

        {/* Image 1: flyer */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>1. The QR signage visitors see at the property</h2>
        <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>Posted on printed signage outside each open house.</div>
        <div style={{ border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'hidden', marginBottom: '40px', background: '#000' }}>
          <img src="/verification/optin-flyer.png" alt="ohACCESS open-house QR signage flyer" style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>

        {/* Image 2: registration form */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>2. The branded registration page reached after scanning</h2>
        <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>Consent is captured at submission, with the disclosure shown directly below the button.</div>
        <div style={{ border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'hidden', marginBottom: '40px', maxWidth: '420px' }}>
          <img src="/verification/optin-form.png" alt="ohACCESS open-house registration page with SMS consent disclosure" style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>

        {/* Consent text verbatim */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '16px' }}>Exact consent language shown on the page</h2>
        <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '20px 24px', marginBottom: '40px', fontSize: '14px', lineHeight: '1.75', color: '#1d1d1f' }}>
          <p style={{ marginBottom: '12px' }}>
            &ldquo;By entering your number and tapping <strong>Request Access Code</strong>, you agree to receive a one-time
            SMS access code from ohACCESS to enter this open house. Message &amp; data rates may apply. Reply STOP to opt out,
            HELP for help.&rdquo;
          </p>
          <p>
            &ldquo;You also agree to the <strong>ohACCESS Terms of Service &amp; Privacy Policy</strong>, and consent to be
            contacted by the listing agent via phone, text, and email about this and other properties.&rdquo;
          </p>
        </div>

        {/* Sample message — message type 1 */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>Message type 1 — one-time access code (to the visitor)</h2>
        <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>The verification/2FA code a visitor receives after opting in above.</div>
        <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '20px 24px', marginBottom: '40px', fontSize: '14px', lineHeight: '1.75', color: '#1d1d1f', fontFamily: 'monospace' }}>
          ohACCESS: Your one-time entry code for 123 Main St is 4827. Show this text at the door to gain access. Msg &amp; data
          rates may apply. Reply STOP to opt out, HELP for help.
        </div>

        {/* Sample message — message type 2 */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>Message type 2 — new-visitor account notification (to the hosting agent)</h2>
        <div style={{ fontSize: '13px', color: '#3a3a3c', marginBottom: '16px', lineHeight: '1.7' }}>
          The hosting real estate agent is an ohACCESS <strong>account holder</strong>. When they create their account they
          provide their own mobile number and agree to receive operational SMS alerts about their open houses. They receive a
          transactional notification each time a new visitor registers. Agents can stop these any time by replying STOP.
        </div>
        <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '20px 24px', marginBottom: '40px', fontSize: '14px', lineHeight: '1.75', color: '#1d1d1f', fontFamily: 'monospace' }}>
          ohACCESS Alert: A new visitor just registered at your 123 Main St open house. Open your ohACCESS dashboard to view
          their details. Reply STOP to opt out, HELP for help.
        </div>

        {/* Policy links */}
        <div style={{ fontSize: '14px', color: '#3a3a3c', lineHeight: '1.8', borderTop: '1px solid #e5e5ea', paddingTop: '24px' }}>
          <div><strong>Privacy Policy:</strong> <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline' }}>https://www.ohaccess.com/privacy</a></div>
          <div><strong>Terms of Service:</strong> <a href="/terms" style={{ color: '#0071e3', textDecoration: 'underline' }}>https://www.ohaccess.com/terms</a></div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#1d1d1f', padding: '24px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ fontSize: '11px', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>
          Verified Open House Check-In · OHACCESS LLC
        </div>
      </footer>
    </main>
  )
}
