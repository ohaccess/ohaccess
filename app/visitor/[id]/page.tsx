'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import VisitorDetail from '@/app/_components/VisitorDetail'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Standalone, mobile-optimized visitor page — the destination of the agent's
// SMS/email "view & add notes" link. Requires login; if the agent isn't signed
// in, bounce them through /login and back here. RLS guarantees they can only
// load their own visitors.
export default function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [visitor, setVisitor] = useState<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    const run = async () => {
      let session = (await supabase.auth.getSession()).data.session
      if (!session) session = (await supabase.auth.refreshSession()).data.session
      if (!session) {
        window.location.href = `/login?next=${encodeURIComponent(`/visitor/${id}`)}`
        return
      }
      const { data } = await supabase.from('visitors').select('*').eq('id', id).maybeSingle()
      if (data) { setVisitor(data); setStatus('ready') }
      else setStatus('notfound')
    }
    run()
  }, [id])

  const wrap = { minHeight: '100vh', background: '#f5f5f7', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' }

  return (
    <main style={wrap}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 200, color: '#1d1d1f', letterSpacing: '-0.5px' }}>oh<span style={{ fontWeight: 700 }}>ACCESS</span></div>
          <a href="/dashboard" style={{ fontSize: '13px', color: '#6e6e73', textDecoration: 'none' }}>Dashboard →</a>
        </div>

        <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #d1d1d6', padding: '22px' }}>
          {status === 'loading' && <div style={{ color: '#6e6e73', fontSize: '14px', textAlign: 'center', padding: '20px' }}>Loading visitor…</div>}
          {status === 'notfound' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', marginBottom: '6px' }}>Visitor not found</div>
              <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: 1.5 }}>This visitor doesn&apos;t exist, or isn&apos;t one of yours. <a href="/dashboard" style={{ color: '#0071e3' }}>Go to your dashboard</a>.</div>
            </div>
          )}
          {status === 'ready' && visitor && (
            <VisitorDetail
              visitor={visitor}
              supabase={supabase}
              onDelete={() => { window.location.href = '/dashboard' }}
            />
          )}
        </div>
      </div>
    </main>
  )
}
