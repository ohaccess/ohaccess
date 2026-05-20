import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const buffer = await QRCode.toBuffer(url, {
      width: 512,
      margin: 2,
      color: {
        dark: '#1d1d1f',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })

    const uint8Array = new Uint8Array(buffer)

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="ohaccess-qr.png"',
      }
    })
  } catch (error) {
    console.error('QR code error:', error)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
