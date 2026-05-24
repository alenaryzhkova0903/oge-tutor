import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, title, body, url } = await req.json()
    if (!subscription) return NextResponse.json({ error: 'No subscription' }, { status: 400 })

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url }),
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Push error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
