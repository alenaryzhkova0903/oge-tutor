'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  TOPIC_LABELS,
  computeRecommendations,
  type TopicStats,
  type Attempt,
  type Task,
} from '@/lib/types'
import NavBar from '@/components/NavBar'

export default function ProgressPage() {
  const router = useRouter()
  const [stats, setStats] = useState<TopicStats[]>([])
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: attempts } = await supabase
        .from('attempts')
        .select('is_correct, task_id')
        .eq('user_id', session.user.id)

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, topic')

      if (!tasks || !attempts) { setLoading(false); return }

      const taskMap: Record<string, string> = {}
      tasks.forEach((t: Pick<Task, 'id' | 'topic'>) => { taskMap[t.id] = t.topic })

      const acc: Record<string, { total: number; correct: number }> = {}
      Object.keys(TOPIC_LABELS).forEach((topic) => { acc[topic] = { total: 0, correct: 0 } })

      let total = 0, correct = 0
      attempts.forEach((a: Pick<Attempt, 'is_correct' | 'task_id'>) => {
        total++
        if (a.is_correct) correct++
        const topic = taskMap[a.task_id]
        if (topic && acc[topic]) {
          acc[topic].total++
          if (a.is_correct) acc[topic].correct++
        }
      })

      const result: TopicStats[] = Object.entries(acc).map(([topic, { total, correct }]) => ({
        topic,
        total,
        correct,
        percent: total > 0 ? Math.round((correct / total) * 100) : 0,
      }))

      setStats(result)
      setTotalAttempts(total)
      setTotalCorrect(correct)
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }

  const recommendations = computeRecommendations(stats)
  const overallPercent = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="student" />
      <div className="px-4 pb-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Мой прогресс</h1>

      {/* Overall */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <p className="text-sm text-gray-500 mb-1">Всего решено задач</p>
        <p className="text-3xl font-bold text-gray-900">
          {totalCorrect}/{totalAttempts}
          <span className="text-lg font-normal text-gray-500 ml-2">({overallPercent}%)</span>
        </p>
      </div>

      {/* Recommendations */}
      <h2 className="text-lg font-semibold mb-3">Рекомендации</h2>
      <div className="flex flex-col gap-2 mb-8">
        {recommendations.map((r) => {
          const color =
            r.priority === 'high'
              ? 'bg-red-50 border-red-200 text-red-700'
              : r.priority === 'medium'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
              : 'bg-green-50 border-green-200 text-green-700'
          return (
            <div key={r.topic} className={`border rounded-xl px-5 py-3 ${color}`}>
              <div className="flex justify-between items-center">
                <span className="font-medium">{TOPIC_LABELS[r.topic]}</span>
                <Link
                  href={`/practice/topic/${r.topic}`}
                  className="text-xs underline ml-3 shrink-0"
                >
                  Тренировать
                </Link>
              </div>
              <p className="text-sm mt-0.5 opacity-80">{r.message}</p>
            </div>
          )
        })}
      </div>

      {/* Per-topic table */}
      <h2 className="text-lg font-semibold mb-3">По темам</h2>
      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-500 text-left">
              <th className="px-4 py-3 font-medium">Тема</th>
              <th className="px-4 py-3 font-medium text-right">Верно/Всего</th>
              <th className="px-4 py-3 font-medium text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.topic} className={i < stats.length - 1 ? 'border-b' : ''}>
                <td className="px-4 py-3">
                  <Link href={`/practice/topic/${s.topic}`} className="hover:underline text-blue-700">
                    {TOPIC_LABELS[s.topic]}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {s.correct}/{s.total}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {s.total > 0 ? `${s.percent}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
