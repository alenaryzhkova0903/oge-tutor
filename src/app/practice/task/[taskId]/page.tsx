'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TOPIC_LABELS, type Task } from '@/lib/types'
import NavBar from '@/components/NavBar'
import Formula from '@/components/Formula'
import MathKeyboard from '@/components/MathKeyboard'

type State = 'answering' | 'correct' | 'wrong'

async function updateStreak(userId: string) {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_practice_date')
    .eq('id', userId)
    .single() as { data: { streak_days: number; last_practice_date: string | null } | null }

  if (!profile) return
  if (profile.last_practice_date === today) return // уже практиковались сегодня

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const wasYesterday = profile.last_practice_date === yesterday.toISOString().slice(0, 10)
  const newStreak = wasYesterday ? (profile.streak_days ?? 0) + 1 : 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('profiles') as any).update({
    streak_days: newStreak,
    last_practice_date: today,
  }).eq('id', userId)
}

export default function TaskPage() {
  const router = useRouter()
  const { taskId } = useParams<{ taskId: string }>()
  const [task, setTask] = useState<Task | null>(null)
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState<State>('answering')
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [userId, setUserId] = useState('')
  const [isTutor, setIsTutor] = useState(false)
  const startTime = useRef(Date.now())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUserId(session.user.id)

      const [{ data: taskData }, { data: profile }] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('profiles').select('role').eq('id', session.user.id).single() as unknown as Promise<{ data: { role: string } | null }>,
      ])

      setTask(taskData)
      if (profile?.role === 'tutor') {
        setIsTutor(true)
        setShowSolution(true)
      }
    })
  }, [taskId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!task || !userId || state !== 'answering') return

    const trimmed = answer.trim().toLowerCase()
    const correct = task.correct_answer.trim().toLowerCase()
    const isCorrect = trimmed === correct

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('attempts') as any).insert({
      user_id: userId,
      task_id: task.id,
      student_answer: answer.trim(),
      is_correct: isCorrect,
      time_spent_seconds: Math.round((Date.now() - startTime.current) / 1000),
    })

    if (isCorrect) await updateStreak(userId)
    setState(isCorrect ? 'correct' : 'wrong')
  }

  function handleRetry() {
    setAnswer('')
    setState('answering')
    setShowHint(false)
    if (!isTutor) setShowSolution(false)
    startTime.current = Date.now()
  }

  if (!task) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }

  const topicLabel = TOPIC_LABELS[task.topic] ?? task.topic
  const role = isTutor ? 'tutor' : 'student'

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role={role} />

      <div className="px-4 pb-8 max-w-xl mx-auto">
        <Link href={`/practice/topic/${task.topic}`} className="text-sm text-blue-600 hover:underline mb-4 block">
          ← {topicLabel}
        </Link>

        <div className="bg-white border rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Задание {task.oge_task_number}
            </span>
            <div className="flex items-center gap-2">
              {isTutor && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                  Репетитор
                </span>
              )}
              <span className="text-xs text-gray-400">
                {'★'.repeat(task.difficulty)}{'☆'.repeat(3 - task.difficulty)}
              </span>
            </div>
          </div>

          {task.image_url && (
            <div className="mb-4 flex justify-center">
              <img
                src={task.image_url}
                alt="Иллюстрация к задаче"
                className="max-w-full max-h-64 rounded-lg border border-gray-100 object-contain"
              />
            </div>
          )}

          <p className="text-lg text-gray-900 leading-relaxed mb-6">
            <Formula>{task.question_text}</Formula>
          </p>

          {isTutor && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 mb-4">
              <span className="text-xs text-purple-500 uppercase tracking-wide">Правильный ответ</span>
              <p className="font-mono font-semibold text-purple-900 mt-0.5">{task.correct_answer}</p>
            </div>
          )}

          {!isTutor && state === 'answering' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Твой ответ"
                  autoFocus
                  className="flex-1 border rounded-lg px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!answer.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition disabled:opacity-40 text-base"
                >
                  Ответить
                </button>
              </div>
              <MathKeyboard value={answer} onChange={setAnswer} inputRef={inputRef} />
            </form>
          )}

          {!isTutor && state === 'correct' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-semibold text-lg">Верно!</p>
              <p className="text-green-600 text-sm mt-1">Ответ: {task.correct_answer}</p>
            </div>
          )}

          {!isTutor && state === 'wrong' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 font-semibold text-lg">Неверно</p>
              <p className="text-red-600 text-sm mt-1">Твой ответ: {answer}</p>
            </div>
          )}
        </div>

        {task.hint && !isTutor && state === 'answering' && (
          <button
            onClick={() => setShowHint(!showHint)}
            className="text-sm text-blue-600 hover:underline mb-2 block"
          >
            {showHint ? 'Скрыть подсказку' : 'Показать подсказку'}
          </button>
        )}
        {showHint && task.hint && !isTutor && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 mb-4 text-blue-800 text-sm">
            {task.hint}
          </div>
        )}

        {task.solution && (isTutor || state !== 'answering') && (
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="text-sm text-blue-600 hover:underline mb-2 block"
          >
            {showSolution ? 'Скрыть решение' : 'Показать решение'}
          </button>
        )}
        {showSolution && task.solution && (
          <div className={`border rounded-xl px-5 py-3 mb-4 text-sm whitespace-pre-wrap ${isTutor ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            {task.solution}
          </div>
        )}

        {task.hint && isTutor && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 mb-4 text-blue-800 text-sm">
            <span className="text-xs text-blue-400 uppercase tracking-wide block mb-1">Подсказка ученику</span>
            {task.hint}
          </div>
        )}

        {!isTutor && state !== 'answering' && (
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition text-base"
            >
              Попробовать снова
            </button>
            <Link
              href={`/practice/topic/${task.topic}`}
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition text-base"
            >
              Следующая задача
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
