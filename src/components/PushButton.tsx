'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type State = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function PushButton({ userId }: { userId: string }) {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setState('denied'); return }

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    })
  }, [])

  async function subscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    })

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('push_subscriptions') as any).upsert({
      user_id: userId,
      subscription: sub.toJSON(),
    }, { onConflict: 'user_id' })

    setState('subscribed')
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()

    const supabase = createClient()
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    setState('unsubscribed')
  }

  if (state === 'loading' || state === 'unsupported') return null
  if (state === 'denied') return (
    <p className="text-xs text-gray-400">Уведомления заблокированы в настройках браузера</p>
  )

  return state === 'subscribed' ? (
    <button
      onClick={unsubscribe}
      className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition"
    >
      🔔 Уведомления включены — отключить
    </button>
  ) : (
    <button
      onClick={subscribe}
      className="flex items-center gap-2 text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-4 py-2 rounded-lg transition"
    >
      🔔 Включить напоминания о занятиях
    </button>
  )
}
