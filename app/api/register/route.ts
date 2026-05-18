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
      return NextResponse.json(
        { error: 'Open house not found' },
        { status: 404 }
      )
    }

    const agent = openHouse.profiles
    const codeWord = openHouse.code_word
    const address = openHouse.property_address
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
      return NextResponse.json(
        { error: 'Failed to save visitor' },
        { status: 500 }
      )
    }

    const agentTier = agent?.tier || 'free'
    const isPro = ['pro', 'team', 'brokerage'].includes(agentTier)

    console.log('Attempting to send visitor SMS to:', phone)

    // ① VISITOR SMS
    await twilioClient.messages.create({
      body: `ohACCESS: The codeword for ${address} is ${codeWord}. Show at the door for entry. Agent: ${agent?.full_name || 'Your Agent'} ${agent?.phone || ''}`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone
    })

    console.log('Attempting to send visitor email to:', email)

    // ② VISITOR EMAIL
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: email,
      cc: isPro && agent?.email ? [agent.email] : [],
      subject: `🏠 Your ohACCESS code: ${codeWord}`,
      html: `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your access code is ready</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
            ${isPro && openHouse.property_photo_url ? `<img src="${openHouse.property_photo_url}" style="width:100%;border-radius:10px;margin-bottom:16px;" />` : ''}
            <div style="background: #f5f5f7; border: 1px dashed #d1d1d6; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; margin-bottom: 6px;">YOUR ACCESS CODE</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d1d1f;">${codeWord}</div>
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #6e6e73; line-height: 1.6;">
              📍 ${address}<br/>
              📅 ${openHouse.open_house_date} · ${openHouse.open_house_hours}<br/>
              🛏 ${openHouse.bedrooms}bd · 🛁 ${openHouse.bathrooms}ba · ${openHouse.square_footage}<br/>
              💰 ${openHouse.listing_price}
            </div>
            <div style="display: flex; align-items: center; gap: 12px; background: #f5f5f7; border-radius: 10px; padding: 12px;">
              ${isPro && agent?.headshot_url ? `<img src="${agent.headshot_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" />` : ''}
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #1d1d1f;">${agent?.full_name || 'Your Agent'}</div>
                <div style="font-size: 12px; color: #6e6e73;">${agent?.brokerage || ''}</div>
                <div style="font-size: 12px; color: #0071e3;">${agent?.phone || ''}</div>
              </div>
            </div>
            <div style="margin-top: 16px; padding: 12px; background: #f5f5f7; border-radius: 8px; font-size: 11px; color: #6e6e73; text-align: center; line-height: 1.6;">
              By registering you agreed to the ohACCESS Terms of Service. You consent to be contacted by the listing agent. Reply STOP to any text to opt out.
            </div>
          </div>
        </div>
      `
    })

    // ③ AGENT SMS ALERT (Pro+ only)
    if (isPro && agent?.phone) {
      await twilioClient.messages.create({
        body: `ohACCESS Alert: New visitor at ${address}. ${firstName} ${lastName}, ${phone}, ${email}, Timeline: ${purchasingTimeline}, Time: ${now}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: agent.phone
      })
    }
  console.log('All messages sent successfully')
    return NextResponse.json({
      success: true,
      codeWord: codeWord
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}