'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TOPIC_LABELS, type TopicStats, type Attempt, type Task } from '@/lib/types'
import NavBar from '@/components/NavBar'

interface DailyTask {
  id: string
  oge_task_number: number
  topic: string
  question_text: string
  doneToday: boolean
}

export default function PracticePage() {
  const router = useRouter()
  const [stats, setStats] = useState<Record<string, TopicStats>>({})
  const [streak, setStreak] = useState(0)
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const today = new Date().toISOString().slice(0, 10)

      const [
        profileRes,
        attemptsRes,
        tasksRes,
        todayAttemptsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('role, streak_days').eq('id', session.user.id).single() as unknown as Promise<{ data: { role: string; streak_days: number } | null }>,
        supabase.from('attempts').select('is_correct, task_id').eq('user_id', session.user.id),
        supabase.from('tasks').select('id, topic, oge_task_number, question_text'),
        supabase.from('attempts').select('task_id').eq('user_id', session.user.id).gte('created_at', today),
      ])

      const profile = profileRes.data
      if (profile?.role === 'tutor') { router.replace('/dashboard'); return }
      setStreak(profile?.streak_days ?? 0)

      const { data: attempts } = attemptsRes
      const { data: tasks } = tasksRes
      const { data: todayAttempts } = todayAttemptsRes

      if (!tasks) { setLoading(false); return }

      // Topic stats
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

      // Daily tasks — 5 random tasks, 1 from each of 5 buckets of task numbers
      const todayTaskIds = new Set((todayAttempts ?? []).map((a: { task_id: string }) => a.task_id))
      const buckets = [
        tasks.filter((t: Task) => t.oge_task_number <= 5),
        tasks.filter((t: Task) => t.oge_task_number >= 6 && t.oge_task_number <= 10),
        tasks.filter((t: Task) => t.oge_task_number >= 11 && t.oge_task_number <= 15),
        tasks.filter((t: Task) => t.oge_task_number >= 16 && t.oge_task_number <= 20),
        tasks.filter((t: Task) => t.oge_task_number >= 21),
      ]

      // Seed random by today's date so tasks are same all day
      const dateSeed = parseInt(today.replace(/-/g, ''), 10)
      const daily: DailyTask[] = buckets.map((bucket) => {
        if (!bucket.length) return null
        const t = bucket[dateSeed % bucket.length] as Task
        return {
          id: t.id,
          oge_task_number: t.oge_task_number,
          topic: t.topic,
          question_text: t.question_text,
          doneToday: todayTaskIds.has(t.id),
        }
      }).filter(Boolean) as DailyTask[]

      setDailyTasks(daily)
      setLoading(false)
    })
  }, [router])

  function topicColor(s: TopicStats) {
    if (s.total === 0) return 'bg-gray-100 text-gray-600'
    if (s.percent < 60) return 'bg-red-50 border-red-200 text-red-700'
    if (s.percent < 80) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    return 'bg-green-50 border-green-200 text-green-700'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>

  const doneCount = dailyTasks.filter((t) => t.doneToday).length

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="student" />
      <div className="px-4 pb-8 max-w-2xl mx-auto">

        {/* Streak banner */}
        {streak > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="font-bold text-orange-800">{streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд!</p>
              <p className="text-xs text-orange-600">Так держать — занимайся каждый день</p>
            </div>
          </div>
        )}

        {/* Daily tasks */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">Задачи дня</h2>
            <span className="text-sm text-gray-400">{doneCount}/{dailyTasks.length} выполнено</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-1.5 bg-green-500 rounded-full transition-all"
              style={{ width: `${dailyTasks.length ? (doneCount / dailyTasks.length) * 100 : 0}%` }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {dailyTasks.map((t) => (
              <Link
                key={t.id}
                href={`/practice/task/${t.id}`}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition ${
                  t.doneToday
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <span className="text-xl">{t.doneToday ? '✅' : '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{t.question_text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Задание №{t.oge_task_number} · {TOPIC_LABELS[t.topic]}</p>
                </div>
                {!t.doneToday && <span className="text-blue-400 text-sm shrink-0">→</span>}
              </Link>
            ))}
          </div>
        </div>

        {/* Topics */}
        <h1 className="text-xl font-bold mb-2">Все темы</h1>
        <p className="text-gray-500 text-sm mb-4">
          Красный — нужна проработка, зелёный — хорошо.
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
