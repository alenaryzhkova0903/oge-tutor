'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TOPIC_LABELS, type Task } from '@/lib/types'

export default function TopicPage() {
  const router = useRouter()
  const { topic } = useParams<{ topic: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('topic', topic)
        .order('difficulty')
        .order('oge_task_number')

      setTasks(data ?? [])
      setLoading(false)
    })
  }, [topic, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }

  const label = TOPIC_LABELS[topic] ?? topic

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 max-w-2xl mx-auto">
      <Link href="/practice" className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Все темы
      </Link>
      <h1 className="text-2xl font-bold mb-6">{label}</h1>

      {tasks.length === 0 ? (
        <p className="text-gray-500">Задач пока нет. Репетитор добавит их скоро.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/practice/task/${task.id}`}
              className="bg-white border rounded-xl px-5 py-4 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase tracking-wide">
                  Задание {task.oge_task_number} · {task.subtopic ?? label}
                </span>
                <span className="text-xs text-gray-400">
                  {'★'.repeat(task.difficulty)}{'☆'.repeat(3 - task.difficulty)}
                </span>
              </div>
              <p className="text-gray-800 line-clamp-2">{task.question_text}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
