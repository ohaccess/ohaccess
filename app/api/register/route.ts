import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createShortUrl(destinationUrl: string, agentId: string, openHouseId: string, urlType: string): Promise<string> {
  let code = generateCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase.from('short_urls').select('code').eq('code', code).single()
    if (!data) break
    code = generateCode()
    attempts++
  }
  const { error } = await supabase.from('short_urls').insert({
    code,
    destination_url: destinationUrl,
    agent_id: agentId,
    open_house_id: openHouseId,
    url_type: urlType
  })
  if (error) console.error('Short URL creation error:', error)
  return `https://ohaccess.com/r/${code}`
}

export async function POST(request: Request) {
  console.log('Registration API called')
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      purchasingTimeline,
      openHouseId
    } = await request.json()

    // Get open house details
    const { data: openHouse, error: ohError } = await supabase
      .from('open_houses')
      .select('*, profiles(*)')
      .eq('id', openHouseId)
      .single()

    if (ohError || !openHouse) {
      return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
    }

    const agent = openHouse.profiles
    const codeWord = openHouse.code_word
    const streetAddress = openHouse.street_address || openHouse.property_address
    const fullAddress = openHouse.property_address
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'short'
    })

    // Save visitor to database
    const { error: visitorError } = await supabase
      .from('visitors')
      .insert({
        open_house_id: openHouseId,
        agent_id: openHouse.agent_id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        purchasing_timeline: purchasingTimeline,
        source: 'ohaccess'
      })

    if (visitorError) {
      return NextResponse.json({ error: 'Failed to save visitor' }, { status: 500 })
    }

    const agentTier = agent?.tier || 'free'
    const isPro = ['pro', 'team', 'brokerage'].includes(agentTier)

    // Block trial users who have exceeded 50 registrations
    if (!isPro) {
      const { count } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', openHouse.agent_id)
      if ((count || 0) > 50) {
        return NextResponse.json({
          error: 'This agent has exceeded their free trial limit. Please ask them to upgrade to Pro at ohaccess.com'
        }, { status: 403 })
      }
    }

    // Generate short URLs
    let listingShortUrl = ''
    let agentShortUrl = ''

    console.log('listing_url:', openHouse.listing_url)
    console.log('landing_page_url:', agent?.landing_page_url)

    if (openHouse.listing_url) {
      listingShortUrl = await createShortUrl(
        openHouse.listing_url,
        openHouse.agent_id,
        openHouseId,
        'listing'
      )
      console.log('listing short url created:', listingShortUrl)
    }

    if (agent?.landing_page_url) {
      agentShortUrl = await createShortUrl(
        agent.landing_page_url,
        openHouse.agent_id,
        openHouseId,
        'agent'
      )
      console.log('agent short url created:', agentShortUrl)
    }

    // Build SMS body — keep under 160 chars
    let smsBody = `Your access code for ${streetAddress} is ${codeWord}. Share at door for entry.`
    if (listingShortUrl) smsBody += ` Listing: ${listingShortUrl}`
    if (agentShortUrl) smsBody += ` Agent: ${agentShortUrl}`

    console.log('SMS body:', smsBody)
    console.log('SMS length:', smsBody.length)

    // ① VISITOR SMS
    await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone
    })

    console.log('Visitor SMS sent')

    // ② VISITOR EMAIL
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: email,
      cc: isPro && agent?.email ? [agent.email] : [],
      subject: `Your ohACCESS code: ${codeWord}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">

          <!-- Header -->
          <div style="background: ${agent?.primary_color || '#1d1d1f'}; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your access code is ready</div>
          </div>

          <!-- Body -->
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">

            <!-- Code word -->
            <div style="background: #f5f5f7; border: 1px dashed #d1d1d6; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your Access Codeword</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d1d1f;"><q>${codeWord}</q></div>
              <div style="font-size: 12px; color: #6e6e73; margin-top: 8px;">Share codeword with host at the door to gain access.</div>
            </div>

            <!-- Property details -->
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #6e6e73; line-height: 1.8;">
              <strong style="color: #1d1d1f;">${fullAddress}</strong><br/>
              📅 ${openHouse.open_house_date}<br/>
              🕒 ${openHouse.open_house_hours}<br/>
              🛏 ${openHouse.bedrooms || '—'} bed · 🛁 ${openHouse.bathrooms || '—'} bath · 📐 ${openHouse.square_footage || '—'} sq ft <br/>
              💰 ${openHouse.listing_price || '—'}<br/>
              ${listingShortUrl ? `📝<a href="${listingShortUrl}" style="color: #0071e3; font-weight: 600; font-size: 13px;">Full listing details </a>` : ''}
            </div>

            <!-- Agent card -->
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center;">
                ${agent?.headshot_url ? `<img src="${agent.headshot_url}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #d1d1d6;margin-right:20px;" />` : ''}
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #1d1d1f;">${agent?.full_name || 'Your Agent'}</div>
                  <div style="font-size: 12px; color: #6e6e73;">${agent?.brokerage || ''}</div>
                  ${agent?.display_email ? `<div style="font-size: 12px; color: #0071e3;">${agent.display_email}</div>` : ''}
                  ${agent?.phone ? `<div style="font-size: 12px; color: #6e6e73;">${agent.phone}</div>` : ''}
                  ${agentShortUrl ? `<div><a href="${agentShortUrl}" style="font-size: 12px; color: #0071e3;">Agent information</a></div>` : ''}
                </div>
              </div>
              ${agent?.logo_url ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5ea; text-align: center;"><img src="${agent.logo_url}" style="max-height:80px;width:80%;object-fit:contain;" /></div>` : ''}
            </div>

            <!-- Footer -->
            <div style="margin-top: 16px; padding: 12px; background: #f5f5f7; border-radius: 8px; font-size: 11px; color: #6e6e73; text-align: center; line-height: 1.6;">
              By registering you agreed to the ohACCESS Terms of Service.<br/>
              You consent to be contacted by the listing agent.<br/>
              Reply STOP to any text to opt out · <a href="https://ohaccess.com/privacy" style="color: #6e6e73;">Privacy Policy</a>
            </div>

          </div>
        </div>
      `
    })

    console.log('Visitor email sent')

    // ③ AGENT SMS ALERT (Pro+ only)
    if (isPro && agent?.phone) {
      await twilioClient.messages.create({
        body: `ohACCESS Alert: New visitor at ${streetAddress}. ${firstName} ${lastName}, ${phone}, ${email}, Timeline: ${purchasingTimeline}, Time: ${now}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: agent.phone
      })
      console.log('Agent SMS sent')
    }

    console.log('All messages sent successfully')
    return NextResponse.json({ success: true, codeWord: codeWord })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}