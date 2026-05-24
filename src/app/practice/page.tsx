'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TOPIC_LABELS, type TopicStats, type Attempt, type Task } from '@/lib/types'
import NavBar from '@/components/NavBar'

export default function PracticePage() {
  const router = useRouter()
  const [stats, setStats] = useState<Record<string, TopicStats>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single() as { data: { role: string } | null, error: unknown }
      if (profile?.role === 'tutor') { router.replace('/dashboard'); return }

      const { data: attempts } = await supabase
        .from('attempts').select('is_correct, task_id').eq('user_id', session.user.id)

      const { data: tasks } = await supabase
        .from('tasks').select('id, topic')

      if (!tasks) { setLoading(false); return }

      const taskMap: Record<string, string> = {}
      tasks.forEach((t: Pick<Task, 'id' | 'topic'>) => { taskMap[t.id] = t.topic })

      const acc: Record<string, { total: number; correct: number }> = {}
      Object.keys(TOPIC_LABELS).forEach((topic) => { acc[topic] = { total: 0, correct: 0 } })

      ;(attempts ?? []).forEach((a: Pick<Attempt, 'is_correct' | 'task_id'>) => {
        const topic = taskMap[a.task_id]
        if (topic && acc[topic]) {
          acc[topic].total++
          if (a.is_correct) acc[topic].correct++
        }
      })

      const result: Record<string, TopicStats> = {}
      Object.entries(acc).forEach(([topic, { total, correct }]) => {
        result[topic] = { topic, total, correct, percent: total > 0 ? Math.round((correct / total) * 100) : 0 }
      })
      setStats(result)
      setLoading(false)
    })
  }, [router])

  function topicColor(s: TopicStats) {
    if (s.total === 0) return 'bg-gray-100 text-gray-600'
    if (s.percent < 60) return 'bg-red-50 border-red-200 text-red-700'
    if (s.percent < 80) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    return 'bg-green-50 border-green-200 text-green-700'
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="student" />
      <div className="px-4 pb-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Практика</h1>
        <p className="text-gray-500 text-sm mb-6">
          Выбери тему для тренировки. Красный — нужна проработка, зелёный — хорошо.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {Object.entries(TOPIC_LABELS).map(([topic, label]) => {
            const s = stats[topic] ?? { topic, total: 0, correct: 0, percent: 0 }
            return (
              <Link
                key={topic}
                href={`/practice/topic/${topic}`}
                className={`border rounded-xl px-5 py-4 flex items-center justify-between hover:shadow-sm transition ${topicColor(s)}`}
              >
                <span className="font-medium">{label}</span>
                <span className="text-sm font-mono">
                  {s.total > 0 ? `${s.correct}/${s.total} (${s.percent}%)` : 'Ещё нет решений'}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
