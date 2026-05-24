'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { type Task } from '@/lib/types'
import NavBar from '@/components/NavBar'
import Formula from '@/components/Formula'

const EXAM_SECONDS = 14100 // 3 ч 55 мин

type Answer = { taskId: string; answer: string; correct: boolean | null }

type Phase = 'loading' | 'intro' | 'exam' | 'results'

export default function ExamPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [tasks, setTasks] = useState<Task[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState('')
  const [isTutor, setIsTutor] = useState(false)
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUserId(session.user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single() as { data: { role: string } | null }
      if (profile?.role === 'tutor') setIsTutor(true)

      // Load one random task per OGE task number 1–25
      const { data: all } = await supabase.from('tasks').select('*')
      if (!all) return

      const byNumber: Record<number, Task[]> = {}
      for (const t of all as Task[]) {
        if (!byNumber[t.oge_task_number]) byNumber[t.oge_task_number] = []
        byNumber[t.oge_task_number].push(t)
      }

      const selected: Task[] = []
      for (let n = 1; n <= 25; n++) {
        const group = byNumber[n]
        if (group?.length) {
          selected.push(group[Math.floor(Math.random() * group.length)])
        }
      }

      setTasks(selected)
      setAnswers(selected.map((t) => ({ taskId: t.id, answer: '', correct: null })))
      setPhase('intro')
    })
  }, [router])

  const finish = useCallback(async (finalAnswers: Answer[]) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('results')

    const supabase = createClient()
    const elapsed = Math.round((Date.now() - startRef.current) / 1000)
    const inserts = finalAnswers
      .filter((a) => a.answer.trim())
      .map((a) => ({
        user_id: userId,
        task_id: a.taskId,
        student_answer: a.answer.trim(),
        is_correct: a.correct ?? false,
        time_spent_seconds: elapsed,
      }))
    if (inserts.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('attempts') as any).insert(inserts)
    }
  }, [userId])

  function startExam() {
    startRef.current = Date.now()
    setTimeLeft(EXAM_SECONDS)
    setPhase('exam')
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish(answers)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function handleAnswer() {
    const trimmed = input.trim()
    if (!trimmed) return
    const task = tasks[current]
    const isCorrect = trimmed.toLowerCase() === task.correct_answer.trim().toLowerCase()
    const updated = answers.map((a, i) =>
      i === current ? { ...a, answer: trimmed, correct: isCorrect } : a
    )
    setAnswers(updated)
    setInput('')

    if (current + 1 < tasks.length) {
      setCurrent(current + 1)
    } else {
      finish(updated)
    }
  }

  function handleSkip() {
    setInput('')
    if (current + 1 < tasks.length) {
      setCurrent(current + 1)
    } else {
      finish(answers)
    }
  }

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`
  }

  const role = isTutor ? 'tutor' : 'student'

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar role={role} />
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h1 className="text-2xl font-bold mb-2">Пробный экзамен ОГЭ</h1>
          <p className="text-gray-500 mb-6">
            25 заданий · 3 часа 55 минут · Все темы
          </p>
          <div className="bg-white border rounded-2xl p-6 mb-8 text-left text-sm text-gray-600 space-y-2">
            <p>• По одному заданию на каждый номер ОГЭ (1–25)</p>
            <p>• Задания выбираются случайно из банка</p>
            <p>• Ответы вводятся так же, как на реальном экзамене</p>
            <p>• Результаты сохраняются в статистику</p>
          </div>
          <button
            onClick={startExam}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition w-full"
          >
            Начать экзамен
          </button>
          <Link href="/practice" className="block mt-4 text-sm text-gray-400 hover:text-gray-600">
            Вернуться к практике
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'exam') {
    const task = tasks[current]
    const progress = ((current) / tasks.length) * 100
    const isLow = timeLeft < 600

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500 font-medium">
            Задание {current + 1} / {tasks.length}
          </span>
          <span className={`font-mono font-bold text-base ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
            {fmt(timeLeft)}
          </span>
          <button
            onClick={() => finish(answers)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Завершить
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="max-w-xl mx-auto px-4 py-6">
          {/* Task number badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
              Задание №{task.oge_task_number}
            </span>
            <span className="text-xs text-gray-400">
              {'★'.repeat(task.difficulty)}{'☆'.repeat(3 - task.difficulty)}
            </span>
          </div>

          <div className="bg-white border rounded-2xl p-6 mb-4">
            {task.image_url && (
              <img
                src={task.image_url}
                alt=""
                className="max-w-full max-h-56 object-contain rounded-lg mb-4 mx-auto block"
              />
            )}
            <p className="text-lg text-gray-900 leading-relaxed mb-6">
              <Formula>{task.question_text}</Formula>
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); handleAnswer() }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ответ"
                autoFocus
                inputMode="decimal"
                className="flex-1 border rounded-lg px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-lg transition disabled:opacity-40"
              >
                →
              </button>
            </form>
          </div>

          <button
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-600 w-full text-center py-2"
          >
            Пропустить задание
          </button>

          {/* Mini navigator */}
          <div className="flex flex-wrap gap-1.5 mt-6">
            {tasks.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                  i === current
                    ? 'bg-blue-600 text-white'
                    : answers[i].answer
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white border text-gray-500'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Results
  const correct = answers.filter((a) => a.correct).length
  const answered = answers.filter((a) => a.answer).length
  const score = correct <= 8 ? 2 : correct <= 14 ? 3 : correct <= 20 ? 4 : 5

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role={role} />
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white border rounded-2xl p-6 mb-4 text-center">
          <div className="text-5xl mb-3">
            {score === 5 ? '🏆' : score === 4 ? '🎯' : score === 3 ? '📚' : '💪'}
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{correct} / 25</p>
          <p className="text-gray-500 mb-4">правильных ответов</p>
          <div className={`inline-block px-4 py-1 rounded-full font-bold text-lg ${
            score === 5 ? 'bg-green-100 text-green-700' :
            score === 4 ? 'bg-blue-100 text-blue-700' :
            score === 3 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            Оценка: {score}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Отвечено: {answered} из 25 · Пропущено: {25 - answered}
          </p>
        </div>

        {/* Per-task breakdown */}
        <div className="flex flex-col gap-2 mb-6">
          {tasks.map((task, i) => {
            const ans = answers[i]
            const status = !ans.answer ? 'skip' : ans.correct ? 'ok' : 'err'
            return (
              <div key={task.id} className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 ${
                status === 'ok' ? 'border-green-200' : status === 'err' ? 'border-red-200' : 'border-gray-100'
              }`}>
                <span className="text-lg mt-0.5">
                  {status === 'ok' ? '✅' : status === 'err' ? '❌' : '⬜'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">Задание №{task.oge_task_number}</p>
                  <p className="text-sm text-gray-700 truncate">{task.question_text}</p>
                  {ans.answer && (
                    <p className="text-xs mt-1">
                      <span className={ans.correct ? 'text-green-600' : 'text-red-500'}>
                        Твой ответ: {ans.answer}
                      </span>
                      {!ans.correct && (
                        <span className="text-gray-500"> · Верно: {task.correct_answer}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setCurrent(0)
              setInput('')
              setAnswers(tasks.map((t) => ({ taskId: t.id, answer: '', correct: null })))
              startExam()
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
          >
            Пройти снова
          </button>
          <Link
            href="/practice"
            className="text-center border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition"
          >
            К практике
          </Link>
        </div>
      </div>
    </div>
  )
}
