'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  TOPIC_LABELS,
  computeRecommendations,
  type Profile,
  type TopicStats,
  type Attempt,
  type Task,
} from '@/lib/types'

export default function StudentDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<Profile | null>(null)
  const [stats, setStats] = useState<TopicStats[]>([])
  const [recentAttempts, setRecentAttempts] = useState<(Attempt & { question_text: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (myProfile?.role !== 'tutor') { router.replace('/practice'); return }

      const [{ data: profile }, { data: attempts }, { data: tasks }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('attempts').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('id, topic, question_text'),
      ])

      if (!profile) { router.replace('/dashboard'); return }
      setStudent(profile)

      if (!tasks || !attempts) { setLoading(false); return }

      const taskMap: Record<string, { topic: string; question_text: string }> = {}
      tasks.forEach((t: Pick<Task, 'id' | 'topic'> & { question_text: string }) => {
        taskMap[t.id] = { topic: t.topic, question_text: t.question_text }
      })

      const acc: Record<string, { total: number; correct: number }> = {}
      Object.keys(TOPIC_LABELS).forEach((topic) => { acc[topic] = { total: 0, correct: 0 } })

      attempts.forEach((a: Attempt) => {
        const info = taskMap[a.task_id]
        if (info && acc[info.topic]) {
          acc[info.topic].total++
          if (a.is_correct) acc[info.topic].correct++
        }
      })

      setStats(
        Object.entries(acc).map(([topic, { total, correct }]) => ({
          topic,
          total,
          correct,
          percent: total > 0 ? Math.round((correct / total) * 100) : 0,
        }))
      )

      setRecentAttempts(
        attempts.slice(0, 10).map((a: Attempt) => ({
          ...a,
          question_text: taskMap[a.task_id]?.question_text ?? '—',
        }))
      )
      setLoading(false)
    })
  }, [id, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }
  if (!student) return null

  const recommendations = computeRecommendations(stats)

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Дашборд
      </Link>
      <h1 className="text-2xl font-bold mb-1">{student.full_name}</h1>
      <p className="text-gray-400 text-sm mb-6">{student.id}</p>

      {/* Recommendations */}
      <h2 className="text-lg font-semibold mb-3">Рекомендации</h2>
      <div className="flex flex-col gap-2 mb-8">
        {recommendations.slice(0, 5).map((r) => {
          const color =
            r.priority === 'high'
              ? 'bg-red-50 border-red-200 text-red-700'
              : r.priority === 'medium'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
              : 'bg-green-50 border-green-200 text-green-700'
          return (
            <div key={r.topic} className={`border rounded-xl px-5 py-3 ${color}`}>
              <span className="font-medium">{TOPIC_LABELS[r.topic]}</span>
              <p className="text-sm mt-0.5 opacity-80">{r.message}</p>
            </div>
          )
        })}
      </div>

      {/* Recent attempts */}
      <h2 className="text-lg font-semibold mb-3">Последние 10 попыток</h2>
      {recentAttempts.length === 0 ? (
        <p className="text-gray-500 text-sm">Ещё нет ни одной попытки.</p>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          {recentAttempts.map((a, i) => (
            <div key={a.id} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t' : ''}`}>
              <span className={`mt-0.5 text-lg ${a.is_correct ? 'text-green-500' : 'text-red-400'}`}>
                {a.is_correct ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{a.question_text}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ответ: <span className="font-mono">{a.student_answer}</span>
                  {' · '}
                  {new Date(a.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
