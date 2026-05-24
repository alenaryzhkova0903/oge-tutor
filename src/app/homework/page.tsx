'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { type Assignment, type Task } from '@/lib/types'
import NavBar from '@/components/NavBar'
import Formula from '@/components/Formula'

type HWItem = Assignment & { task: Task }

export default function HomeworkPage() {
  const router = useRouter()
  const [items, setItems] = useState<HWItem[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, boolean | null>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single() as { data: { role: string } | null }
      if (profile?.role === 'tutor') { router.replace('/dashboard'); return }

      const { data } = await supabase
        .from('assignments')
        .select('*, task:tasks(*)')
        .eq('student_id', session.user.id)
        .order('due_date', { ascending: true, nullsFirst: false })

      setItems((data as unknown as HWItem[]) ?? [])
      setLoading(false)
    })
  }, [router])

  async function handleSubmit(item: HWItem) {
    const answer = (answers[item.id] ?? '').trim()
    if (!answer) return

    const isCorrect = answer.toLowerCase() === item.task.correct_answer.trim().toLowerCase()
    setResults((prev) => ({ ...prev, [item.id]: isCorrect }))

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Save attempt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('attempts') as any).insert({
      user_id: session.user.id,
      task_id: item.task_id,
      student_answer: answer,
      is_correct: isCorrect,
      time_spent_seconds: 0,
    })

    // Mark done if correct
    if (isCorrect) {
      await supabase.from('assignments').update({ is_done: true }).eq('id', item.id)
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_done: true } : i))
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>

  const pending = items.filter((i) => !i.is_done)
  const done = items.filter((i) => i.is_done)

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="student" />
      <div className="max-w-xl mx-auto px-4 pb-10">
        <h1 className="text-2xl font-bold mb-1">Домашние задания</h1>
        <p className="text-sm text-gray-400 mb-6">
          {pending.length === 0 ? 'Все выполнены 🎉' : `Осталось: ${pending.length}`}
        </p>

        {items.length === 0 && (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-400">
            Репетитор ещё не назначил заданий
          </div>
        )}

        {/* Pending */}
        <div className="flex flex-col gap-4 mb-8">
          {pending.map((item) => {
            const result = results[item.id]
            const overdue = item.due_date && new Date(item.due_date) < new Date()
            return (
              <div key={item.id} className="bg-white border rounded-2xl p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      Задание №{item.task.oge_task_number}
                    </span>
                    <span className="text-xs text-gray-400">
                      {'★'.repeat(item.task.difficulty)}{'☆'.repeat(3 - item.task.difficulty)}
                    </span>
                  </div>
                  {item.due_date && (
                    <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                      {overdue ? '⚠️ ' : ''}до {new Date(item.due_date).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>

                {/* Question */}
                {item.task.image_url && (
                  <img src={item.task.image_url} alt="" className="max-h-40 object-contain rounded-lg mb-3 mx-auto block" />
                )}
                <p className="text-gray-800 leading-relaxed mb-4">
                  <Formula>{item.task.question_text}</Formula>
                </p>

                {/* Answer area */}
                {result === undefined || result === null ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSubmit(item) }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={answers[item.id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Твой ответ"
                      inputMode="decimal"
                      className="flex-1 border rounded-lg px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!(answers[item.id] ?? '').trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-40"
                    >
                      →
                    </button>
                  </form>
                ) : result ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-green-700 font-semibold">Верно! ✓</p>
                    <p className="text-green-600 text-sm mt-0.5">Задание выполнено</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                      <p className="text-red-700 font-semibold">Неверно</p>
                      <p className="text-red-500 text-sm mt-0.5">Твой ответ: {answers[item.id]}</p>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        setResults((prev) => ({ ...prev, [item.id]: null }))
                        setAnswers((prev) => ({ ...prev, [item.id]: '' }))
                      }}
                    >
                      <button type="submit" className="w-full border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                        Попробовать снова
                      </button>
                    </form>
                  </div>
                )}

                {/* Hint after wrong */}
                {result === false && item.task.hint && (
                  <p className="text-xs text-blue-600 mt-2">💡 {item.task.hint}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Done */}
        {done.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-gray-400 mb-3">Выполнено ({done.length})</h2>
            <div className="flex flex-col gap-2">
              {done.map((item) => (
                <div key={item.id} className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-green-500 text-lg">✅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.task.question_text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Задание №{item.task.oge_task_number}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
